"""
Policy Library Router — manage policy libraries and import documents.

A Policy Library is the top-level container for a set of related rules.
It corresponds to one uploaded document (e.g. a school handbook = one library
whose rules are the individual policy clauses extracted from that document).

Endpoints:
  GET    /api/policy-libraries            — list all libraries
  GET    /api/policy-libraries/{id}       — get one library + its rules
  DELETE /api/policy-libraries/{id}       — delete library and all its rules
  POST   /api/policy-libraries/import     — upload document → parse → create library + rules
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from anthropic import AsyncAnthropic
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(prefix="/api/policy-libraries", tags=["Policy Libraries"])


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class PolicyLibrarySummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    tier: str                      # external | internal | implicit
    inferenceModel: str            # rdr | knowledge_graph | neural_network | general_llm
    sourceFile: Optional[str] = None
    componentId: Optional[str] = None
    componentName: Optional[str] = None
    ruleCount: int = 0
    status: str = "active"
    createdAt: str


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

_IMPORT_PROMPT = """\
You are a policy analyst. You have been given a policy document. Your task is to extract every distinct, actionable policy rule from the document.

For each rule, produce a structured JSON entry. Return ONLY a JSON object — no other text:

{
  "libraryName": "short descriptive name for this policy document (max 60 chars)",
  "libraryDescription": "one-sentence summary of what this document covers",
  "rules": [
    {
      "title": "short rule title (max 80 chars)",
      "summary": "one to two sentences describing what the rule requires or prohibits",
      "strength": "must|must_not|should|should_not|may",
      "action": "deny|require_approval|log|allow",
      "riskLevel": "critical|high|medium|low",
      "intentType": "access_control|data_handling|model_ai_use|safety_content|compliance|operational|procurement|incident",
      "enforcement": ["pre_check", "in_flight", "post_check"],
      "domain": ["relevant domain tags, e.g. Education, Healthcare, Data Privacy"]
    }
  ]
}

Rules:
- Extract every distinct policy statement — do not merge unrelated rules
- Keep titles concise and self-explanatory
- If a rule is ambiguous or too vague to be actionable, skip it
- Return between 3 and 50 rules depending on document length
- Return only the JSON object
"""


def _is_pdf(raw: bytes, filename: str) -> bool:
    """Detect PDF by magic bytes (%PDF) or file extension."""
    return raw[:4] == b"%PDF" or filename.lower().endswith(".pdf")


async def _parse_document_with_llm(
    raw: bytes, filename: str, inference_model: str
) -> Dict[str, Any]:
    """
    Send the document to Claude and extract structured policy rules.

    - PDF files are sent as native base64 document blocks (no text extraction needed,
      avoids all encoding/garbling issues with non-Latin scripts).
    - TXT / MD files are decoded as UTF-8 and sent as text.

    inference_model:
      rdr           → claude-haiku
      everything else → claude-sonnet
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    # rdr uses haiku; all others use sonnet
    # Note: haiku does NOT support PDF document blocks, so fall back to sonnet for PDFs
    is_pdf = _is_pdf(raw, filename)
    if inference_model == "rdr" and not is_pdf:
        model = os.getenv("CLAUDE_HAIKU_MODEL", "claude-haiku-4-5-20251001")
    else:
        model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

    client = AsyncAnthropic(api_key=api_key)

    print(f"[POLICY-LIBRARY] Parsing {filename!r} ({len(raw)} bytes) as {'PDF' if is_pdf else 'text'} with {model}")

    if is_pdf:
        # Send the PDF bytes directly as a document block — Claude reads it natively.
        # This avoids all text-extraction issues (encoding, scanned fonts, CJK, etc.)
        pdf_b64 = base64.standard_b64encode(raw).decode("utf-8")
        user_content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_b64,
                },
            },
            {
                "type": "text",
                "text": _IMPORT_PROMPT,
            },
        ]
    else:
        # Plain text / markdown — decode and truncate
        text = raw.decode("utf-8", errors="replace").strip()
        doc_snippet = text[:15_000]
        user_content = _IMPORT_PROMPT + f"\n\nDOCUMENT:\n{doc_snippet}"

    response = await client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": user_content}],
    )

    raw_text = "".join(b.text for b in response.content if hasattr(b, "text"))
    print(f"[POLICY-LIBRARY] LLM response preview: {raw_text[:300]!r}")
    m = re.search(r"\{[\s\S]*\}", raw_text)
    if not m:
        raise ValueError("LLM did not return valid JSON")

    return json.loads(m.group())


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PolicyLibrarySummary])
async def list_libraries(
    tier: str = "",
    component_id: str = "",
) -> List[PolicyLibrarySummary]:
    from modules.policy import db as policy_db
    libs = await policy_db.list_libraries(tier=tier, component_id=component_id)
    return [PolicyLibrarySummary(**lib) for lib in libs]


@router.get("/{library_id}")
async def get_library(library_id: str) -> Dict[str, Any]:
    from modules.policy import db as policy_db
    lib = await policy_db.get_library(library_id)
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    rules = await policy_db.list_rules(limit=500)
    lib_rules = [r for r in rules if r.get("libraryId") == library_id]
    return {**lib, "rules": lib_rules}


@router.delete("/{library_id}")
async def delete_library(library_id: str) -> Dict[str, Any]:
    from modules.policy import db as policy_db
    lib = await policy_db.get_library(library_id)
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    deleted_rules = await policy_db.delete_library(library_id)
    return {"deleted": True, "library_id": library_id, "rules_deleted": deleted_rules}


@router.post("/import")
async def import_document(
    file: UploadFile = File(...),
    tier: str = Form("internal"),
    inference_model: str = Form("general_llm"),
    component_id: str = Form(""),
    component_name: str = Form(""),
    library_name: str = Form(""),   # optional override; LLM derives it if blank
) -> Dict[str, Any]:
    """
    Upload a policy document and parse it into a library + rules using LLM.

    - tier: external | internal (implicit not supported for upload)
    - inference_model: general_llm | rdr | knowledge_graph | neural_network
    - component_id / component_name: only relevant when tier=internal
    """
    if tier not in ("external", "internal"):
        raise HTTPException(status_code=400, detail="tier must be 'external' or 'internal'")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Parse document with LLM (PDF sent natively; text decoded as UTF-8)
    try:
        parsed = await _parse_document_with_llm(raw, file.filename or "", inference_model)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM parsing failed: {exc}")

    derived_name = library_name or parsed.get("libraryName", file.filename or "Untitled Library")
    derived_desc = parsed.get("libraryDescription", "")
    extracted_rules: List[Dict[str, Any]] = parsed.get("rules", [])

    if not extracted_rules:
        raise HTTPException(status_code=422, detail="No rules could be extracted from the document")

    from modules.policy import db as policy_db

    library_id = str(uuid.uuid4())
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Create library record
    library: Dict[str, Any] = {
        "id": library_id,
        "name": derived_name,
        "description": derived_desc,
        "tier": tier,
        "inferenceModel": inference_model,
        "sourceFile": file.filename,
        "componentId": component_id or None,
        "componentName": component_name or None,
        "ruleCount": len(extracted_rules),
        "status": "active",
        "createdAt": now_iso,
    }
    await policy_db.create_library(library)

    # Create rule records linked to this library
    created_ids: List[str] = []
    for r in extracted_rules:
        rule_id = str(uuid.uuid4())
        rule: Dict[str, Any] = {
            "id": rule_id,
            "title": r.get("title", "Untitled Rule"),
            "summary": r.get("summary", ""),
            "domain": r.get("domain", ["General"]),
            "tier": tier,
            "libraryId": library_id,
            "libraryName": derived_name,
            "componentId": component_id or None,
            "componentName": component_name or None,
            "sourceFile": file.filename,
            "status": "active",
            "inferenceModel": inference_model,
            "enforcement": r.get("enforcement", ["pre_check", "post_check", "in_flight"]),
            "strength": r.get("strength", "must"),
            "action": r.get("action", "deny"),
            "riskLevel": r.get("riskLevel", "medium"),
            "intentType": r.get("intentType", "compliance"),
            "scope": "component" if tier == "internal" else "global",
            "jurisdiction": [],
            "source": [{"type": "internal" if tier == "internal" else "regulation",
                        "reference": file.filename or ""}],
            "owner": component_name or "System",
            "version": "1.0",
            "lastModified": now_iso,
            "trustWorthy": "explain",
            "changeLog": [],
        }
        await policy_db.create_rule(rule)
        created_ids.append(rule_id)

    return {
        "library_id": library_id,
        "library_name": derived_name,
        "tier": tier,
        "rules_created": len(created_ids),
        "rule_ids": created_ids,
    }
