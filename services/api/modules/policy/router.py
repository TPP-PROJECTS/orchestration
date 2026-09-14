"""
Knowledge Rules router — /api/knowledge-rules

CRUD for the Policy Knowledge Library. Stores rich, browsable rule objects
in MongoDB (policy DB). Separate from the policy engine's operational policies.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from modules.policy import db as policy_db

router = APIRouter(prefix="/api/knowledge-rules", tags=["Knowledge Rules"])


# ---- Pydantic models matching frontend Rule type ----

class SourceDoc(BaseModel):
    type: str  # "regulation" | "standard" | "internal"
    reference: str
    url: Optional[str] = None


class ChangeLogEntry(BaseModel):
    date: str
    user: str
    action: str
    details: str


class KnowledgeRule(BaseModel):
    id: str
    title: str
    summary: str
    domain: List[str] = []
    jurisdiction: List[str] = []
    intentType: str = ""
    scope: str = ""
    enforcement: List[str] = []   # stored as list in DB
    strength: str = ""
    action: str = ""
    source: List[SourceDoc] = []
    inferenceModel: str = ""
    owner: str = ""
    version: str = "1.0"
    status: str = "active"
    lastModified: str = ""
    riskLevel: str = "medium"
    trustWorthy: str = ""
    changeLog: List[ChangeLogEntry] = []
    # Three-tier fields
    tier: Optional[str] = None
    libraryId: Optional[str] = None
    libraryName: Optional[str] = None
    componentId: Optional[str] = None
    componentName: Optional[str] = None
    sourceFile: Optional[str] = None

    model_config = {"extra": "ignore"}  # silently drop unknown DB fields

    @field_validator("enforcement", mode="before")
    @classmethod
    def coerce_enforcement_to_list(cls, v: Any) -> List[str]:
        """Old records store enforcement as a plain string; new ones as a list."""
        if isinstance(v, str):
            return [v] if v else []
        if isinstance(v, list):
            return v
        return []


class KnowledgeRuleCreate(BaseModel):
    title: str
    summary: str
    domain: List[str] = []
    jurisdiction: List[str] = []
    intentType: str = ""
    scope: str = ""
    enforcement: List[str] = []
    strength: str = ""
    action: str = ""
    source: List[SourceDoc] = []
    inferenceModel: str = ""
    owner: str = ""
    version: str = "1.0"
    status: str = "active"
    riskLevel: str = "medium"
    trustWorthy: str = ""
    tier: Optional[str] = None
    libraryId: Optional[str] = None
    componentId: Optional[str] = None
    componentName: Optional[str] = None


class KnowledgeRuleUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    domain: Optional[List[str]] = None
    jurisdiction: Optional[List[str]] = None
    intentType: Optional[str] = None
    scope: Optional[str] = None
    enforcement: Optional[List[str]] = None
    strength: Optional[str] = None
    action: Optional[str] = None
    source: Optional[List[SourceDoc]] = None
    inferenceModel: Optional[str] = None
    owner: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    riskLevel: Optional[str] = None
    trustWorthy: Optional[str] = None
    tier: Optional[str] = None


# ---- Endpoints ----

@router.get("", response_model=List[KnowledgeRule])
async def list_rules(
    domain: List[str] = Query(default=[]),
    jurisdiction: List[str] = Query(default=[]),
    intent_type: List[str] = Query(default=[]),
    scope: List[str] = Query(default=[]),
    enforcement: List[str] = Query(default=[]),
    strength: List[str] = Query(default=[]),
    status: List[str] = Query(default=[]),
    inference_model: List[str] = Query(default=[]),
    trust_worthy: List[str] = Query(default=[]),
    library_id: str = Query(default=""),
    search: str = Query(default=""),
    sort_by: str = Query(default="lastModified"),
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    """List knowledge rules with optional filtering."""
    return await policy_db.list_rules(
        domains=domain,
        jurisdictions=jurisdiction,
        intent_types=intent_type,
        scopes=scope,
        enforcements=enforcement,
        strengths=strength,
        statuses=status,
        inference_models=inference_model,
        trust_worthys=trust_worthy,
        library_id=library_id,
        search=search,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )


@router.get("/{rule_id}", response_model=KnowledgeRule)
async def get_rule(rule_id: str) -> Dict[str, Any]:
    rule = await policy_db.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.post("", response_model=KnowledgeRule, status_code=201)
async def create_rule(req: KnowledgeRuleCreate) -> Dict[str, Any]:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    rule: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "lastModified": now,
        "changeLog": [],
        **req.model_dump(),
    }
    return await policy_db.create_rule(rule)


@router.put("/{rule_id}", response_model=KnowledgeRule)
async def update_rule(rule_id: str, req: KnowledgeRuleUpdate) -> Dict[str, Any]:
    existing = await policy_db.get_rule(rule_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    updates = req.model_dump(exclude_unset=True)
    updates["lastModified"] = now
    rule = await policy_db.update_rule(rule_id, updates)
    return rule


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str) -> Dict[str, str]:
    ok = await policy_db.delete_rule(rule_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted", "id": rule_id}
