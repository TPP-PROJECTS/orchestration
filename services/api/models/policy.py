"""
Policy models for content and system policy management.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
import uuid
import time


PolicyType = Literal["system", "input", "output"]
PolicyStatus = Literal["active", "inactive", "draft"]

# Three-tier hierarchy — determines authority and evaluation priority.
#   external: legally binding obligations (government regulations, privacy laws)
#   internal: organization-specific rules uploaded by the component owner
#   implicit: ethical/moral baselines that apply everywhere
PolicyTier = Literal["external", "internal", "implicit"]


class PolicyRule(BaseModel):
    """A single policy rule."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    content: str  # The actual policy text/rule
    severity: Literal["block", "warn", "info"] = "block"
    enabled: bool = True
    # Persisted/operational rules are organizational rules by default.  The
    # implicit tier is evaluated directly by the LLM and has no stored rules.
    tier: PolicyTier = "internal"
    # Source traceability
    source_document: Optional[str] = None
    source_section: Optional[str] = None


class Policy(BaseModel):
    """A policy definition."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    type: PolicyType
    tier: PolicyTier = "internal"
    status: PolicyStatus = "active"
    rules: List[PolicyRule] = []
    created_at: int = Field(default_factory=lambda: int(time.time() * 1000))
    updated_at: int = Field(default_factory=lambda: int(time.time() * 1000))
    version: str = "1.0"
    # For internal-tier policies: the component that owns this policy
    component_id: Optional[str] = None
    # For internal-tier policies: original uploaded filename(s)
    source_files: List[str] = []
    metadata: Optional[Dict[str, Any]] = None


class PolicyCreateRequest(BaseModel):
    """Request to create a new policy."""
    name: str
    description: Optional[str] = None
    type: PolicyType
    rules: List[PolicyRule] = []
    status: PolicyStatus = "active"


class PolicyUpdateRequest(BaseModel):
    """Request to update a policy."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PolicyStatus] = None
    rules: Optional[List[PolicyRule]] = None


class PolicyEvaluationRequest(BaseModel):
    """Request to evaluate content against policies."""
    content: str
    policy_type: PolicyType
    context: Optional[Dict[str, Any]] = None  # Additional context (e.g., history)
    domains: Optional[List[str]] = None
    component_id: Optional[str] = None


class PolicyViolation(BaseModel):
    """A policy violation found during evaluation."""
    policy_id: str
    policy_name: str
    rule_id: str
    rule_name: str
    tier: PolicyTier = "implicit"
    severity: Literal["block", "warn", "info"]
    reason: str
    suggestion: Optional[str] = None
    # Extended fields for detailed display
    rule_description: Optional[str] = None
    rule_content: Optional[str] = None
    source_document: Optional[str] = None
    source_section: Optional[str] = None
    library_id: Optional[str] = None
    library_name: Optional[str] = None


class TierSummary(BaseModel):
    external: Literal["PASS", "FAIL", "NOT_EVALUATED"] = "NOT_EVALUATED"
    internal: Literal["PASS", "FAIL", "NOT_EVALUATED"] = "NOT_EVALUATED"
    implicit: Literal["PASS", "FAIL", "NOT_EVALUATED"] = "NOT_EVALUATED"


class PolicyEvaluationResult(BaseModel):
    """Result of policy evaluation."""
    passed: bool
    violations: List[PolicyViolation] = []
    evaluated_policies: int = 0
    evaluation_time_ms: int = 0
    decision: Literal["ALLOW", "BLOCK", "WARN"] = "ALLOW"
    summary: Optional[str] = None
    tier_summary: Optional[TierSummary] = None


class PolicyListResponse(BaseModel):
    """Response for listing policies."""
    policies: List[Policy]
    total: int
    by_type: Dict[str, int] = {}


# Default policies
DEFAULT_INPUT_POLICY = Policy(
    id="default-input-policy",
    name="Default Input Policy",
    description="Default policy for reviewing user input messages",
    type="input",
    status="active",
    rules=[
        PolicyRule(
            id="input-no-harmful",
            name="No Harmful Content",
            description="Block requests for harmful, illegal, or dangerous content",
            content="The message must not request information about creating weapons, illegal drugs, or content that could cause physical harm to others.",
            severity="block",
            enabled=True
        ),
        PolicyRule(
            id="input-no-pii-extraction",
            name="No PII Extraction",
            description="Block attempts to extract personal information",
            content="The message must not attempt to extract, collect, or manipulate personal identifiable information (PII) from the system or other users.",
            severity="block",
            enabled=True
        ),
        PolicyRule(
            id="input-professional",
            name="Professional Communication",
            description="Ensure professional and appropriate communication",
            content="The message should be professional and appropriate for a business context. Avoid offensive language, harassment, or discriminatory content.",
            severity="warn",
            enabled=True
        ),
    ]
)

DEFAULT_OUTPUT_POLICY = Policy(
    id="default-output-policy",
    name="Default Output Policy",
    description="Default policy for reviewing AI-generated responses",
    type="output",
    status="active",
    rules=[
        PolicyRule(
            id="output-no-harmful",
            name="No Harmful Instructions",
            description="Block responses containing harmful instructions",
            content="The response must not contain instructions for creating weapons, illegal substances, or performing dangerous activities.",
            severity="block",
            enabled=True
        ),
        PolicyRule(
            id="output-no-pii",
            name="No PII Disclosure",
            description="Block responses that disclose personal information",
            content="The response must not disclose or generate fake personal identifiable information (names, addresses, phone numbers, SSNs, etc.) unless explicitly provided by the user for legitimate purposes.",
            severity="block",
            enabled=True
        ),
        PolicyRule(
            id="output-accurate",
            name="Accuracy Disclaimer",
            description="Ensure responses include appropriate disclaimers for medical/legal/financial advice",
            content="For medical, legal, or financial topics, the response should include appropriate disclaimers and recommend consulting with qualified professionals.",
            severity="warn",
            enabled=True
        ),
        PolicyRule(
            id="output-no-hallucination",
            name="No False Claims",
            description="Warn about potential fabricated information",
            content="The response should not present fabricated facts, fake citations, or non-existent sources as real. If uncertain, acknowledge the uncertainty.",
            severity="warn",
            enabled=True
        ),
    ]
)

DEFAULT_SYSTEM_POLICY = Policy(
    id="default-system-policy",
    name="Default System Policy",
    description="Default system-level policy for operational constraints",
    type="system",
    status="active",
    rules=[
        PolicyRule(
            id="system-rate-limit",
            name="Rate Limiting",
            description="Enforce rate limits on API usage",
            content="Users should not exceed 100 requests per minute. Automated bulk requests should be throttled.",
            severity="warn",
            enabled=True
        ),
        PolicyRule(
            id="system-context-length",
            name="Context Length Limit",
            description="Limit conversation context length",
            content="Conversation history should be limited to the last 20 messages or 50,000 tokens to ensure system stability.",
            severity="info",
            enabled=True
        ),
    ]
)
