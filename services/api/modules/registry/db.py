"""
Registry module database — MongoDB: registry
Collection: components

Stores system component records. Seeded with defaults on first run.
Supports full CRUD so admins can register/remove/update components.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from core.db_base import get_module_db, REGISTRY_DB

COLLECTION = "components"

# Category metadata — static config, not stored in DB
CATEGORIES = {
    "infrastructure": {
        "id": "infrastructure",
        "name": "Infrastructure",
        "description": "Core system components and services",
        "icon": "server",
        "configurable": False,
    },
    "ai-models": {
        "id": "ai-models",
        "name": "AI Models",
        "description": "Language models and AI services",
        "icon": "brain",
        "configurable": True,
    },
    "data-stores": {
        "id": "data-stores",
        "name": "Data Stores",
        "description": "Databases and persistent storage",
        "icon": "database",
        "configurable": True,
    },
    "provenance": {
        "id": "provenance",
        "name": "Provenance & Compliance",
        "description": "Audit trail, compliance tracking, and workflow management",
        "icon": "shield-check",
        "configurable": False,
    },
}

SEED_COMPONENTS: List[Dict[str, Any]] = [
    {
        "id": "user-interface",
        "category_id": "infrastructure",
        "name": "Web Admin Dashboard",
        "type": "frontend",
        "status": "running",
        "description": "React-based administration interface for HITL workflow",
        "configurable": False,
        "enabled": True,
        "meta": {"version": "1.0.0", "framework": "React + TypeScript + Vite", "endpoint": "http://localhost:5173"},
    },
    {
        "id": "api-gateway",
        "category_id": "infrastructure",
        "name": "Orchestration API",
        "type": "backend",
        "status": "running",
        "description": "FastAPI service for HITL workflow orchestration",
        "configurable": False,
        "enabled": True,
        "meta": {"version": "1.0.0", "framework": "FastAPI + Python", "endpoint": "http://localhost:8000"},
    },
    {
        "id": "claude-api",
        "category_id": "ai-models",
        "name": "Claude API",
        "type": "llm",
        "status": "configured",
        "description": "Anthropic Claude language model for AI responses",
        "configurable": True,
        "enabled": True,
        "meta": {"provider": "Anthropic", "version": "API v1"},
    },
    {
        "id": "mongodb",
        "category_id": "data-stores",
        "name": "MongoDB",
        "type": "database",
        "status": "connected",
        "description": "Document database for provenance events and system data",
        "configurable": True,
        "enabled": True,
        "meta": {"version": "7.0"},
    },
    {
        "id": "prov-tracker",
        "category_id": "provenance",
        "name": "Provenance Tracker",
        "type": "service",
        "status": "running",
        "description": "Immutable audit trail with hash-chain verification",
        "configurable": False,
        "enabled": True,
        "meta": {"version": "1.0.0", "hash_algorithm": "SHA-256", "chain_type": "linked"},
    },
    {
        "id": "hitl-workflow",
        "category_id": "provenance",
        "name": "HITL Workflow Engine",
        "type": "service",
        "status": "running",
        "description": "Human-in-the-Loop approval and review workflow",
        "configurable": False,
        "enabled": True,
        "meta": {"version": "1.0.0", "review_stages": ["primary", "secondary"]},
    },
    {
        "id": "policy-engine",
        "category_id": "provenance",
        "name": "Policy Engine",
        "type": "service",
        "status": "running",
        "description": "Policy evaluation and compliance module",
        "configurable": True,
        "enabled": True,
        "meta": {"version": "1.0.0"},
    },
]


def _col():
    return get_module_db(REGISTRY_DB)[COLLECTION]


async def ensure_indexes() -> None:
    await _col().create_index("id", unique=True)
    await _col().create_index("category_id")
    await _col().create_index("type")


async def count_components() -> int:
    return await _col().count_documents({})


async def seed_defaults() -> None:
    if await count_components() > 0:
        return
    await _col().insert_many(SEED_COMPONENTS)
    print(f"[REGISTRY-MODULE] Seeded {len(SEED_COMPONENTS)} default components")


async def list_components(category_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if category_id:
        query["category_id"] = category_id
    cursor = _col().find(query, {"_id": 0})
    return await cursor.to_list(length=500)


async def get_component(component_id: str) -> Optional[Dict[str, Any]]:
    return await _col().find_one({"id": component_id}, {"_id": 0})


async def upsert_component(component: Dict[str, Any]) -> Dict[str, Any]:
    comp_id = component.get("id")
    await _col().update_one({"id": comp_id}, {"$set": component}, upsert=True)
    return await get_component(comp_id)


async def update_component(component_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates.pop("id", None)
    await _col().update_one({"id": component_id}, {"$set": updates})
    return await get_component(component_id)


async def delete_component(component_id: str) -> bool:
    result = await _col().delete_one({"id": component_id})
    return result.deleted_count > 0


async def get_component_domains(component_id: str) -> List[str]:
    """Return the declared policy domains for a component, or [] if none."""
    comp = await get_component(component_id)
    return comp.get("domains", []) if comp else []


async def find_component_by_source(source: str) -> Optional[Dict[str, Any]]:
    """
    Find a component by exact id match first, then by case-insensitive name search.
    Used by inbound_events to map a source string to a registered component.
    """
    comp = await get_component(source)
    if comp:
        return comp
    import re as _re
    return await _col().find_one(
        {"name": {"$regex": _re.escape(source), "$options": "i"}},
        {"_id": 0},
    )
