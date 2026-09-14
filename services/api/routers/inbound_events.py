"""
Inbound Events endpoint.

Receives webhook notifications from registered external components (e.g. topic-generator)
and publishes them to the internal event bus + HTTP log for real-time monitoring.
Policy evaluation runs in the background — never blocks the caller.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from services.event_bus import event_bus
from services.http_logger import http_logger
from services.policy_engine import policy_engine

router = APIRouter(prefix="/api/events", tags=["Events"])


class InboundEventRequest(BaseModel):
    source: str
    method: str
    url: str
    status_code: Optional[int] = None
    request_body: Optional[str] = None
    response_body: Optional[str] = None
    duration_ms: Optional[float] = None
    trace_id: Optional[str] = None


@router.post("/inbound")
async def inbound_event(req: InboundEventRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Accept an event pushed by an external component, surface it in the live
    stream and HTTP logs, then kick off non-blocking policy evaluation.
    """
    trace_id = req.trace_id or str(uuid.uuid4())

    await http_logger.log_request(
        direction="inbound",
        method=req.method,
        url=f"[{req.source}] {req.url}",
        status_code=req.status_code,
        request_body=req.request_body,
        duration_ms=req.duration_ms,
        trace_id=trace_id,
    )
    await event_bus.publish({
        "type": "external_event",
        "source": req.source,
        "ts": time.time(),
        "data": {
            "method": req.method,
            "url": req.url,
            "status_code": req.status_code,
            "duration_ms": req.duration_ms,
            "request_body": req.request_body,
            "response_body": req.response_body,
        },
    })

    # Policy evaluation — only for POST/PUT with meaningful content, never blocks topic-generator
    req_len = len(req.request_body or "")
    res_len = len(req.response_body or "")
    if req.method in ("POST", "PUT") and (req_len > 30 or res_len > 30):
        background_tasks.add_task(_run_policy_checks, req, trace_id)

    return {"ok": True}


async def _run_policy_checks(req: InboundEventRequest, trace_id: str) -> None:
    """Evaluate request and response bodies against the policy engine."""
    ts = int(time.time() * 1000)
    context = {"source": req.source, "url": req.url, "trace_id": trace_id}

    # Resolve domains from the registered component that sent this event.
    # The source string (e.g. "topic-generator") is matched against component id/name.
    _domains: List[str] = []
    _component_id: Optional[str] = None
    try:
        from modules.registry import db as reg_db
        comp = await reg_db.find_component_by_source(req.source)
        if comp:
            _component_id = comp.get("id")
            _domains = comp.get("domains", [])
            if _domains:
                print(f"[INBOUND-EVENTS] Source '{req.source}' domains: {_domains}")
    except Exception:
        pass

    if req.request_body:
        try:
            result = await policy_engine.evaluate_content(
                content=req.request_body,
                policy_type="input",
                context=context,
                domains=_domains or None,
                component_id=_component_id,
            )
            await event_bus.publish({
                "type": "policy_evaluation",
                "trace_id": trace_id,
                "ts": ts,
                "data": {
                    "message_id": trace_id,
                    "policy_type": "input",
                    "source": req.source,
                    "url": req.url,
                    "passed": result.passed,
                    "decision": result.decision,
                    "violations": [v.model_dump() for v in result.violations],
                    "summary": result.summary,
                    "evaluation_time_ms": result.evaluation_time_ms,
                    "evaluated_policies": result.evaluated_policies,
                    "evaluated_content": req.request_body[:500] if req.request_body else None,
                },
            })
        except Exception as e:
            print(f"[INBOUND-EVENTS] Input policy error: {e}")

    if req.response_body:
        try:
            result = await policy_engine.evaluate_content(
                content=req.response_body,
                policy_type="output",
                context=context,
                domains=_domains or None,
                component_id=_component_id,
            )
            await event_bus.publish({
                "type": "policy_evaluation",
                "trace_id": trace_id,
                "ts": ts,
                "data": {
                    "message_id": trace_id,
                    "policy_type": "output",
                    "source": req.source,
                    "url": req.url,
                    "passed": result.passed,
                    "decision": result.decision,
                    "violations": [v.model_dump() for v in result.violations],
                    "summary": result.summary,
                    "evaluation_time_ms": result.evaluation_time_ms,
                    "evaluated_policies": result.evaluated_policies,
                    "evaluated_content": req.response_body[:500] if req.response_body else None,
                },
            })
        except Exception as e:
            print(f"[INBOUND-EVENTS] Output policy error: {e}")
