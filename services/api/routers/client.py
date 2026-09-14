"""
Client router - endpoints for submitting messages and polling responses.

Handles both manual-approval mode (message is queued for admin review) and
auto-approval mode (input/output policy evaluation + Claude call run in the
background, status returned immediately). Integrates with the message queue,
event bus, policy engine, and provenance store.
"""
from __future__ import annotations

import asyncio
import os
import time
import traceback
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from models.client import ClientMessage, ClientMessageRequest, ClientResponse
from models.provenance import Citation
from services.message_queue import message_queue
from services.event_bus import event_bus
from provenance.events import (
    store_initial_message_prov_event,
    store_policy_evaluation_prov_event,
    store_llm_result_prov_event,
    store_final_response_prov_event,
)
from utils.helpers import iso_utc_now

router = APIRouter(prefix="/api/client", tags=["Client"])


# Import execute_chat lazily to avoid circular imports
_execute_chat = None

def get_execute_chat():
    global _execute_chat
    if _execute_chat is None:
        from services.chat_service import execute_chat
        _execute_chat = execute_chat
    return _execute_chat


async def process_auto_approval_background(
    message_id: str,
    trace_id: str,
    req: ClientMessageRequest,
    request: Request
) -> None:
    """Background async processing for Auto mode messages with policy evaluation."""
    from models.chat import ChatRequest
    from models.envelopes import ClaudeRequestEnvelope
    from services.policy_engine import policy_engine

    try:
        print(f"[CLIENT-AUTO-BG] Starting background processing for {message_id}")

        # Resolve component domains once — used for both input and output policy evaluation.
        # The domain is declared at component registration, not inferred from content.
        _component_domains: List[str] = []
        if req.component_id:
            try:
                from modules.registry import db as reg_db
                _component_domains = await reg_db.get_component_domains(req.component_id)
                if _component_domains:
                    print(f"[CLIENT-AUTO-BG] Component '{req.component_id}' domains: {_component_domains}")
            except Exception as _e:
                print(f"[CLIENT-AUTO-BG] Could not resolve component domains: {_e}")

        # ========== STEP 1: Evaluate Input Policy ==========
        print(f"[CLIENT-AUTO-BG] Evaluating input policies...")
        await event_bus.publish({
            "type": "policy_check_request",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message_id": message_id,
                "policy_type": "input",
                "envelope_type": "policy.input",
                "action": "message.input.evaluate",
                "context": {"history": [h.model_dump() for h in req.history] if req.history else []},
                "payload": {"content": req.message},
                "dry_run": False,
            }
        })
        input_eval = await policy_engine.evaluate_content(
            content=req.message,
            policy_type="input",
            context={"history": [h.model_dump() for h in req.history] if req.history else []},
            domains=_component_domains or None,
            component_id=req.component_id or None,
        )
        
        # Publish input policy evaluation event
        await event_bus.publish({
            "type": "policy_evaluation",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message_id": message_id,
                "policy_type": "input",
                "decision": input_eval.decision,
                "passed": input_eval.passed,
                "violations": [v.model_dump() for v in input_eval.violations],
                "summary": input_eval.summary,
                "evaluation_time_ms": input_eval.evaluation_time_ms
            }
        })
        
        # If input blocked, reject the message
        if input_eval.decision == "BLOCK":
            print(f"[CLIENT-AUTO-BG] Input blocked by policy: {input_eval.summary}")
            
            # Publish rejection event for LiveTab
            await event_bus.publish({
                "type": "hitl_decision",
                "trace_id": trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "trace_id": trace_id,
                    "decision": "DENY",
                    "reviewer": "policy_engine",
                    "reason": input_eval.summary,
                    "original_message": req.message,
                    "timestamp": iso_utc_now(),
                    "review_type": "input_policy_blocked",
                    "error_code": "INPUT_POLICY_VIOLATION",
                    "violations": [v.model_dump() for v in input_eval.violations]
                }
            })
            
            error_resp = ClientResponse(
                message_id=message_id,
                trace_id=trace_id,
                status="rejected",
                reason=f"Input policy violation: {input_eval.summary}",
                error_code="INPUT_POLICY_VIOLATION",
                citation=Citation(
                    reason=input_eval.summary or "Policy violation",
                    references=[v.rule_name for v in input_eval.violations],
                    reviewer="policy_engine",
                    timestamp=iso_utc_now(),
                    decision_type="input_policy_block"
                )
            )
            await message_queue.update_response(message_id, error_resp)
            return
        
        print(f"[CLIENT-AUTO-BG] Input policy passed: {input_eval.decision}")
        
        # Store policy evaluation provenance
        try:
            policy_prov = await store_policy_evaluation_prov_event(
                message_id=message_id,
                trace_id=trace_id,
                decision=input_eval.decision,
                policy_binding_id=f"input-policy-{message_id}",
                original_message=req.message,
                constraints=[v.rule_name for v in input_eval.violations] if input_eval.violations else None,
                requires_hitl=False,
                residual_risk="low" if input_eval.passed else "high",
                request=request
            )
            print(f"[CLIENT-AUTO-BG] Stored input policy evaluation: {policy_prov.event_id}")
        except Exception as e:
            print(f"[CLIENT-AUTO-BG] Error storing policy evaluation: {e}")
        
        # Publish message_approved event
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
        preview_messages = [
            *[{"role": h.role, "content": h.content} for h in (req.history or [])],
            {"role": "user", "content": req.message},
        ]
        claude_params = {
            "model": model,
            "max_tokens": 1200,
            "messages": preview_messages,
        }
        
        envelope_id = str(uuid.uuid4())
        claude_request_envelope = ClaudeRequestEnvelope(
            jsonrpc="2.0",
            id=envelope_id,
            envelope_type="claudeRequest",
            params=claude_params,
            _meta={
                "trace_id": trace_id,
                "message_id": message_id,
                "timestamp": iso_utc_now(),
                "stage": "auto_approval",
            }
        )
        
        message_approved_data = {
            "trace_id": trace_id,
            "message_id": message_id,
            "decision": "ALLOW",
            "reviewer": "auto_system",
            "original_message": req.message,
            "effective_message": req.message,
            "admin_prompt": None,
            "timestamp": iso_utc_now(),
            "claude_request": claude_request_envelope.model_dump(),
            "meta": {
                "message_id": message_id,
                "approved_at": int(time.time() * 1000),
                "auto_mode": True
            }
        }
        
        await event_bus.publish({
            "type": "message_approved",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": message_approved_data
        })
        print(f"[CLIENT-AUTO-BG] Published message_approved event")
        
        # Call Claude API
        chat_req = ChatRequest(
            trace_id=trace_id,
            message=req.message,
            history=req.history,
            max_tokens=1200,
            admin_prompt=None,
        )
        
        print(f"[CLIENT-AUTO-BG] Calling Claude API...")
        execute_chat = get_execute_chat()
        chat_response = await execute_chat(chat_req, request)
        await message_queue.store_chat_response(message_id, chat_response)
        
        print(f"[CLIENT-AUTO-BG] Claude API returned: {len(chat_response.reply)} chars")
        
        # Store LLM result
        try:
            llm_prov = await store_llm_result_prov_event(
                message_id=message_id,
                trace_id=trace_id,
                llm_response=chat_response.reply,
                original_message=req.message,
                request=request
            )
            print(f"[CLIENT-AUTO-BG] Stored LLM result: {llm_prov.event_id}")
        except Exception as e:
            print(f"[CLIENT-AUTO-BG] Error storing LLM result: {e}")
        
        # Publish llm_response_ready event
        llm_response_data = {
            "trace_id": trace_id,
            "message_id": message_id,
            "original_message": req.message,
            "effective_message": req.message,
            "admin_prompt": None,
            "reply": chat_response.reply,
            "claude_model": chat_response.claude_model,
            "claude_request": chat_response.claude_request,
            "claude_response": chat_response.claude_response,
            "timings_ms": chat_response.timings_ms,
            "errors": chat_response.errors,
            "timestamp": iso_utc_now()
        }
        
        await event_bus.publish({
            "type": "llm_response_ready",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": llm_response_data
        })
        print(f"[CLIENT-AUTO-BG] Published llm_response_ready event")
        
        # ========== STEP 3: Evaluate Output Policy ==========
        print(f"[CLIENT-AUTO-BG] Evaluating output policies...")
        await event_bus.publish({
            "type": "policy_check_request",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message_id": message_id,
                "policy_type": "output",
                "envelope_type": "policy.output",
                "action": "message.output.evaluate",
                "context": {
                    "original_message": req.message,
                    "history": [h.model_dump() for h in req.history] if req.history else []
                },
                "payload": {"content": chat_response.reply},
                "dry_run": False,
            }
        })
        output_eval = await policy_engine.evaluate_content(
            content=chat_response.reply,
            policy_type="output",
            context={
                "original_message": req.message,
                "history": [h.model_dump() for h in req.history] if req.history else []
            },
            domains=_component_domains or None,
            component_id=req.component_id or None,
        )
        
        # Publish output policy evaluation event
        await event_bus.publish({
            "type": "policy_evaluation",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message_id": message_id,
                "policy_type": "output",
                "decision": output_eval.decision,
                "passed": output_eval.passed,
                "violations": [v.model_dump() for v in output_eval.violations],
                "summary": output_eval.summary,
                "evaluation_time_ms": output_eval.evaluation_time_ms
            }
        })
        
        # If output blocked, reject the response
        if output_eval.decision == "BLOCK":
            print(f"[CLIENT-AUTO-BG] Output blocked by policy: {output_eval.summary}")
            
            # Publish blocked event for LiveTab
            await event_bus.publish({
                "type": "hitl_decision",
                "trace_id": trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "trace_id": trace_id,
                    "decision": "DENY",
                    "reviewer": "policy_engine",
                    "reason": output_eval.summary,
                    "original_message": req.message,
                    "blocked_content": chat_response.reply[:500],  # Truncate for safety
                    "timestamp": iso_utc_now(),
                    "review_type": "output_policy_blocked",
                    "error_code": "OUTPUT_POLICY_VIOLATION",
                    "violations": [v.model_dump() for v in output_eval.violations]
                }
            })
            
            error_resp = ClientResponse(
                message_id=message_id,
                trace_id=trace_id,
                status="rejected",
                reason=f"Output policy violation: {output_eval.summary}",
                error_code="OUTPUT_POLICY_VIOLATION",
                citation=Citation(
                    reason=output_eval.summary or "Output policy violation",
                    references=[v.rule_name for v in output_eval.violations],
                    reviewer="policy_engine",
                    timestamp=iso_utc_now(),
                    decision_type="output_policy_block"
                )
            )
            await message_queue.update_response(message_id, error_resp)
            return
        
        print(f"[CLIENT-AUTO-BG] Output policy passed: {output_eval.decision}")
        
        # Store final response
        try:
            final_prov = await store_final_response_prov_event(
                message_id=f"{message_id}-final-approved",
                trace_id=trace_id,
                final_response=chat_response.reply,
                original_message=req.message,
                edit_type="auto_approved_original",
                reviewer="auto_system",
                request=request
            )
            print(f"[CLIENT-AUTO-BG] Stored final response: {final_prov.event_id}")
        except Exception as e:
            print(f"[CLIENT-AUTO-BG] Error storing final response: {e}")
        
        # Publish hitl_decision event (enriched with _meta)
        from services.meta_enrichment import build_meta
        llm_response_envelope = await build_meta(
            user_message=req.message,
            chat_response=chat_response,
            input_eval=input_eval,
            output_eval=output_eval,
        )

        approval_trace_data = {
            "trace_id": trace_id,
            "message_id": message_id,
            "decision": "ALLOW",
            "reviewer": "auto_system",
            "reason": "Auto-approved by system",
            "original_message": req.message,
            "approved_content": chat_response.reply,
            "timestamp": iso_utc_now(),
            "review_type": "secondary_review_approved",
            "llm_response": llm_response_envelope
        }
        
        await event_bus.publish({
            "type": "hitl_decision",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": approval_trace_data
        })
        print(f"[CLIENT-AUTO-BG] Published auto-approval decision")
        
        # Update final response status
        auto_citation = Citation(
            reason="Automatically approved and processed by system",
            references=["Auto-approval policy", "System policy evaluation"],
            reviewer="auto_system",
            timestamp=iso_utc_now(),
            decision_type="auto_approval"
        )
        completed_resp = ClientResponse(
            message_id=message_id,
            trace_id=trace_id,
            status="completed",
            reply=chat_response.reply,
            citation=auto_citation
        )
        await message_queue.update_response(message_id, completed_resp)
        
        print(f"[CLIENT-AUTO-BG] Auto-approval completed for {message_id}")
        
    except Exception as e:
        print(f"[CLIENT-AUTO-BG] Error in background processing: {str(e)}")
        traceback.print_exc()
        
        error_resp = ClientResponse(
            message_id=message_id,
            trace_id=trace_id,
            status="rejected",
            reason=f"Auto-approval error: {str(e)}"
        )
        await message_queue.update_response(message_id, error_resp)


@router.post("/message")
async def client_message(
    req: ClientMessageRequest,
    request: Request
) -> Dict[str, Any]:
    """Client sends message to queue, awaiting admin approval."""
    message_id = str(uuid.uuid4())
    trace_id = str(uuid.uuid4())
    
    client_msg = ClientMessage(
        message_id=message_id,
        trace_id=trace_id,
        message=req.message,
        history=req.history,
        timestamp=int(time.time() * 1000),
        component_id=req.component_id or None,
    )

    if req.auto_approve:
        print(f"[CLIENT-AUTO] Auto-approve mode enabled for {message_id}")
        
        await message_queue.add_message(client_msg)
        
        event_data = {
            "type": "client_message",
            "message_id": message_id,
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message": req.message,
                "history": [h.model_dump() for h in req.history] if req.history else [],
                "meta": {
                    "timestamp": client_msg.timestamp,
                    "message_id": message_id,
                    "auto_mode": True
                }
            }
        }
        await event_bus.publish(event_data)

        try:
            initial_prov = await store_initial_message_prov_event(
                message_id=message_id,
                trace_id=trace_id,
                message=req.message,
                history=req.history,
                is_auto_mode=True,
                request=request
            )
            print(f"[CLIENT-AUTO] Stored policyEvaluate event: {initial_prov.event_id}")
        except Exception as e:
            print(f"[CLIENT-AUTO] Error storing policyEvaluate event: {e}")

        print(f"[CLIENT-AUTO] Returning pending status immediately")
        
        asyncio.create_task(
            process_auto_approval_background(message_id, trace_id, req, request)
        )
        
        return {
            "message_id": message_id,
            "trace_id": trace_id,
            "status": "pending"
        }
    
    # Manual mode
    await message_queue.add_message(client_msg)

    event_data = {
        "type": "client_message",
        "message_id": message_id,
        "trace_id": trace_id,
        "ts": int(time.time() * 1000),
        "data": {
            "message": req.message,
            "history": [h.model_dump() for h in req.history] if req.history else [],
            "meta": {
                "timestamp": client_msg.timestamp,
                "message_id": message_id,
                "component_id": req.component_id or None,
            }
        }
    }

    print(f"[CLIENT] New message {message_id}: {req.message[:50]}...")
    await event_bus.publish(event_data)

    try:
        initial_prov = await store_initial_message_prov_event(
            message_id=message_id,
            trace_id=trace_id,
            message=req.message,
            history=req.history,
            is_auto_mode=False,
            request=request
        )
        print(f"[CLIENT] Stored hitlRequest event: {initial_prov.event_id}")
    except Exception as e:
        print(f"[CLIENT] Error storing hitlRequest event: {e}")

    # ========== Input Policy Pre-evaluation (background, non-blocking) ==========
    async def _run_input_policy_eval() -> None:
        from services.policy_engine import policy_engine
        try:
            print(f"[CLIENT-MANUAL] Evaluating input policies for {message_id}...")
            _manual_domains: List[str] = []
            if req.component_id:
                try:
                    from modules.registry import db as reg_db
                    _manual_domains = await reg_db.get_component_domains(req.component_id)
                except Exception as domain_error:
                    print(f"[CLIENT-MANUAL] Could not resolve component domains: {domain_error}")
            await event_bus.publish({
                "type": "policy_check_request",
                "trace_id": trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "policy_type": "input",
                    "envelope_type": "policy.input",
                    "action": "message.input.evaluate",
                    "context": {"history": [h.model_dump() for h in req.history] if req.history else []},
                    "payload": {"content": req.message},
                    "dry_run": False,
                }
            })
            input_eval = await policy_engine.evaluate_content(
                content=req.message,
                policy_type="input",
                context={"history": [h.model_dump() for h in req.history] if req.history else []},
                domains=_manual_domains or None,
                component_id=req.component_id or None,
            )
            input_eval_data = {
                "decision": input_eval.decision,
                "passed": input_eval.passed,
                "violations": [v.model_dump() for v in input_eval.violations],
                "summary": input_eval.summary,
                "evaluation_time_ms": input_eval.evaluation_time_ms,
                "evaluated_policies": input_eval.evaluated_policies,
            }
            await message_queue.store_policy_evaluation(message_id, "input", input_eval_data)
            print(f"[CLIENT-MANUAL] Input policy result: {input_eval.decision}")

            await event_bus.publish({
                "type": "policy_evaluation",
                "trace_id": trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "policy_type": "input",
                    "decision": input_eval.decision,
                    "passed": input_eval.passed,
                    "violations": [v.model_dump() for v in input_eval.violations],
                    "summary": input_eval.summary,
                    "evaluation_time_ms": input_eval.evaluation_time_ms
                }
            })

            # Step 4a: Orch -> HITL (manual mode: message sent to admin for review)
            await event_bus.publish({
                "type": "hitl_request",
                "trace_id": trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "message": req.message,
                    "input_policy_decision": input_eval.decision,
                    "input_policy_passed": input_eval.passed,
                    "timestamp": iso_utc_now(),
                }
            })
        except Exception as e:
            print(f"[CLIENT-MANUAL] Error evaluating input policies: {e}")

    asyncio.create_task(_run_input_policy_eval())

    return {
        "message_id": message_id,
        "trace_id": trace_id,
        "status": "pending"
    }


@router.get("/message/{message_id}")
async def client_check_response(message_id: str) -> ClientResponse:
    """Client polls to check message response status."""
    resp = await message_queue.get_response(message_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Message not found")
    return resp
