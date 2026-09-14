"""
Policy API endpoints for managing and evaluating policies.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from models.policy import Policy, PolicyType

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from models.policy import (
    Policy,
    PolicyRule,
    PolicyType,
    PolicyCreateRequest,
    PolicyUpdateRequest,
    PolicyEvaluationRequest,
    PolicyEvaluationResult,
    PolicyListResponse,
)
from services.policy_engine import policy_engine

router = APIRouter(prefix="/api/policies", tags=["Policies"])


@router.on_event("startup")
async def startup():
    """Initialize policy engine on startup."""
    await policy_engine.initialize()


# ============ Policy CRUD ============

@router.get("", response_model=PolicyListResponse)
async def list_policies(type: Optional[PolicyType] = None) -> PolicyListResponse:
    """List all policies, optionally filtered by type."""
    policies = await policy_engine.list_policies(type)
    
    by_type = {}
    for p in policies:
        by_type[p.type] = by_type.get(p.type, 0) + 1
    
    return PolicyListResponse(
        policies=policies,
        total=len(policies),
        by_type=by_type
    )


@router.get("/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str) -> Policy:
    """Get a policy by ID."""
    policy = await policy_engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.post("", response_model=Policy)
async def create_policy(request: PolicyCreateRequest) -> Policy:
    """Create a new policy."""
    policy = Policy(
        name=request.name,
        description=request.description,
        type=request.type,
        status=request.status,
        rules=request.rules,
    )
    return await policy_engine.add_policy(policy)


@router.put("/{policy_id}", response_model=Policy)
async def update_policy(policy_id: str, request: PolicyUpdateRequest) -> Policy:
    """Update a policy."""
    updates = request.model_dump(exclude_unset=True)
    policy = await policy_engine.update_policy(policy_id, updates)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.delete("/{policy_id}")
async def delete_policy(policy_id: str) -> Dict[str, str]:
    """Delete a policy."""
    try:
        success = await policy_engine.delete_policy(policy_id)
        if not success:
            raise HTTPException(status_code=404, detail="Policy not found")
        return {"status": "success", "message": f"Policy {policy_id} deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Policy Rules ============

@router.post("/{policy_id}/rules", response_model=Policy)
async def add_rule(policy_id: str, rule: PolicyRule) -> Policy:
    """Add a rule to a policy."""
    policy = await policy_engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    rules = list(policy.rules)
    rules.append(rule)
    
    updated = await policy_engine.update_policy(policy_id, {"rules": rules})
    return updated


@router.put("/{policy_id}/rules/{rule_id}", response_model=Policy)
async def update_rule(policy_id: str, rule_id: str, rule: PolicyRule) -> Policy:
    """Update a rule in a policy."""
    policy = await policy_engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    rules = []
    found = False
    for r in policy.rules:
        if r.id == rule_id:
            rules.append(rule)
            found = True
        else:
            rules.append(r)
    
    if not found:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    updated = await policy_engine.update_policy(policy_id, {"rules": rules})
    return updated


@router.delete("/{policy_id}/rules/{rule_id}", response_model=Policy)
async def delete_rule(policy_id: str, rule_id: str) -> Policy:
    """Delete a rule from a policy."""
    policy = await policy_engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    rules = [r for r in policy.rules if r.id != rule_id]
    
    if len(rules) == len(policy.rules):
        raise HTTPException(status_code=404, detail="Rule not found")
    
    updated = await policy_engine.update_policy(policy_id, {"rules": rules})
    return updated


@router.patch("/{policy_id}/rules/{rule_id}/toggle", response_model=Policy)
async def toggle_rule(policy_id: str, rule_id: str, enabled: bool = True) -> Policy:
    """Toggle a rule's enabled status."""
    policy = await policy_engine.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    rules = []
    found = False
    for r in policy.rules:
        if r.id == rule_id:
            r_dict = r.model_dump()
            r_dict["enabled"] = enabled
            rules.append(PolicyRule(**r_dict))
            found = True
        else:
            rules.append(r)
    
    if not found:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    updated = await policy_engine.update_policy(policy_id, {"rules": rules})
    return updated


# ============ Policy Evaluation ============

@router.post("/evaluate", response_model=PolicyEvaluationResult)
async def evaluate_content(request: PolicyEvaluationRequest) -> PolicyEvaluationResult:
    """Evaluate content against policies."""
    result = await policy_engine.evaluate_content(
        content=request.content,
        policy_type=request.policy_type,
        context=request.context,
        domains=request.domains,
        component_id=request.component_id,
    )
    return result


@router.post("/evaluate/input", response_model=PolicyEvaluationResult)
async def evaluate_input(content: str, context: Optional[Dict[str, Any]] = None) -> PolicyEvaluationResult:
    """Evaluate user input against input policies."""
    return await policy_engine.evaluate_content(
        content=content,
        policy_type="input",
        context=context
    )


@router.post("/evaluate/output", response_model=PolicyEvaluationResult)
async def evaluate_output(content: str, context: Optional[Dict[str, Any]] = None) -> PolicyEvaluationResult:
    """Evaluate AI output against output policies."""
    return await policy_engine.evaluate_content(
        content=content,
        policy_type="output",
        context=context
    )


# ============ Policy Engines Listing ============

class EngineDefinition(BaseModel):
    """Definition of a policy engine grouping."""
    type: PolicyType
    policies: List[Policy]

@router.get("/engines", response_model=List[EngineDefinition])
async def list_policy_engines() -> List[EngineDefinition]:
    """List all policies grouped by engine/type."""
    all_policies = await policy_engine.list_policies()
    engines: Dict[PolicyType, List[Policy]] = {}
    for p in all_policies:
        engines.setdefault(p.type, []).append(p)
    return [EngineDefinition(type=etype, policies=plist) for etype, plist in engines.items()]

# ============ Policy Import/Export ============


class PolicyImportRequest(BaseModel):
    """Request to import policies."""
    policies: List[Dict[str, Any]]
    merge: bool = True  # If true, merge with existing; if false, replace


@router.post("/import", response_model=Dict[str, Any])
async def import_policies(request: PolicyImportRequest) -> Dict[str, Any]:
    """Import policies from JSON."""
    imported = 0
    errors = []
    
    for p_data in request.policies:
        try:
            # Don't overwrite default policies
            if p_data.get("id", "").startswith("default-"):
                p_data["id"] = f"imported-{p_data['id']}"
            
            policy = Policy(**p_data)
            await policy_engine.add_policy(policy)
            imported += 1
        except Exception as e:
            errors.append({"policy": p_data.get("name", "unknown"), "error": str(e)})
    
    return {
        "status": "success",
        "imported": imported,
        "errors": errors
    }


@router.get("/export")
async def export_policies(type: Optional[PolicyType] = None) -> Dict[str, Any]:
    """Export policies as JSON."""
    policies = await policy_engine.list_policies(type)
    return {
        "policies": [p.model_dump() for p in policies],
        "exported_at": __import__("time").time(),
        "count": len(policies)
    }


@router.post("/upload")
async def upload_policy_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Upload a policy file (JSON)."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are supported")
    
    try:
        content = await file.read()
        data = __import__("json").loads(content)
        
        policies_data = data if isinstance(data, list) else data.get("policies", [data])
        
        imported = 0
        errors = []
        
        for p_data in policies_data:
            try:
                if p_data.get("id", "").startswith("default-"):
                    p_data["id"] = f"uploaded-{p_data['id']}"
                
                policy = Policy(**p_data)
                await policy_engine.add_policy(policy)
                imported += 1
            except Exception as e:
                errors.append({"policy": p_data.get("name", "unknown"), "error": str(e)})
        
        return {
            "status": "success",
            "filename": file.filename,
            "imported": imported,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


# ============ Policy Status ============

@router.get("/status")
async def get_policy_status() -> Dict[str, Any]:
    """Get overall policy engine status."""
    policies = await policy_engine.list_policies()
    
    input_policies = [p for p in policies if p.type == "input" and p.status == "active"]
    output_policies = [p for p in policies if p.type == "output" and p.status == "active"]
    system_policies = [p for p in policies if p.type == "system" and p.status == "active"]
    
    input_rules = sum(len([r for r in p.rules if r.enabled]) for p in input_policies)
    output_rules = sum(len([r for r in p.rules if r.enabled]) for p in output_policies)
    system_rules = sum(len([r for r in p.rules if r.enabled]) for p in system_policies)
    
    return {
        "total_policies": len(policies),
        "active_policies": len([p for p in policies if p.status == "active"]),
        "input": {
            "policies": len(input_policies),
            "rules": input_rules
        },
        "output": {
            "policies": len(output_policies),
            "rules": output_rules
        },
        "system": {
            "policies": len(system_policies),
            "rules": system_rules
        },
        "engine_status": "running"
    }

@router.get("/engines")
async def list_policy_engines() -> Dict[str, Any]:
    """List registered policy engines with their categories and rules."""
    try:
        # 尝试从策略引擎获取策略
        policies = await policy_engine.list_policies()
        
        # Group policies by type (engine)
        engines_map: Dict[str, List] = {}
        for p in policies:
            engines_map.setdefault(p.type, []).append(p)
        
        engines: list[Dict[str, Any]] = []
        for engine_type, pols in engines_map.items():
            engines.append({
                "id": engine_type,
                "name": f"{engine_type.capitalize()} Policies",
                "status": "active",
                "categories": [
                    {
                        "id": pol.id,
                        "name": pol.name,
                        "rules": [r.model_dump() for r in pol.rules]
                    }
                    for pol in pols
                ]
            })
            
        # 如果没有找到策略，使用模拟数据
        if not engines:
            engines = _get_mock_engines()
            
        return {"engines": engines}
    except Exception as e:
        # 异常情况下也返回模拟数据
        print(f"Error fetching policies: {e}")
        return {"engines": _get_mock_engines()}
        
def _get_mock_engines() -> List[Dict[str, Any]]:
    """返回模拟的策略引擎数据"""
    return [
        {
            "id": "security",
            "name": "Security Policies",
            "status": "running",
            "description": "Security policies for infrastructure protection",
            "category": "security",
            "version": "1.0.0",
            "categories": [
                {
                    "id": "input_validation",
                    "name": "Input Validation",
                    "rules": [
                        {
                            "id": "rule1",
                            "name": "Sanitize User Input",
                            "description": "Ensures all user input is properly sanitized",
                            "severity": "high",
                            "content": "All user input must be validated and sanitized before processing"
                        },
                        {
                            "id": "rule2",
                            "name": "SQL Injection Prevention",
                            "description": "Prevents SQL injection attacks",
                            "severity": "critical",
                            "content": "Use parameterized queries or prepared statements"
                        }
                    ]
                }
            ]
        },
        {
            "id": "output",
            "name": "Output Policies",
            "status": "running",
            "description": "Policies for managing system outputs",
            "category": "output",
            "version": "1.0.0",
            "categories": [
                {
                    "id": "data_export",
                    "name": "Data Export",
                    "rules": [
                        {
                            "id": "rule4",
                            "name": "Data Format Validation",
                            "description": "Validates data formats for exports",
                            "severity": "medium",
                            "content": "Ensure data is formatted correctly before export"
                        }
                    ]
                }
            ]
        },
        {
            "id": "system",
            "name": "System Policies",
            "status": "running",
            "description": "Core system policies",
            "category": "infrastructure",
            "version": "1.0.0",
            "categories": [
                {
                    "id": "infrastructure",
                    "name": "Infrastructure",
                    "rules": [
                        {
                            "id": "rule6",
                            "name": "Resource Utilization",
                            "description": "Monitors resource usage",
                            "severity": "low",
                            "content": "Maintain resource utilization below 80% threshold"
                        }
                    ]
                }
            ]
        }
    ]
