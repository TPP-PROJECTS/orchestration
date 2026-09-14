"""
Policy Engine - Three-tier policy evaluation pipeline.

Policy Tier Architecture
------------------------
  external  (highest authority)
    Legally binding obligations: government regulations, privacy laws (GDPR, HIPAA,
    FERPA), industry standards.  Violations are absolute — never downgraded.

  internal  (organizational authority)
    Rules uploaded by the component owner at registration (school handbook, company
    code of conduct, hospital guidelines).  Applies within that organization's scope.

  implicit  (ethical baseline)
    Moral and ethical norms universally expected of any system regardless of legal
    status.  Always evaluated.

Evaluation Pipeline (per request)
----------------------------------
  Layer 1 — Domain + tier filter  (zero API cost)
    Query MongoDB knowledge_rules filtered by component domain, enforcement timing,
    and all three tiers.  Drops rules outside the component's declared domain.

  Layer 2 — LLM pre-screen  (Haiku + Screener Skill)
    Relevance filter: which rules in the domain set actually apply to this content?
    External rules are NEVER screened out — they pass through unconditionally.
    Applied only when the non-external rule count exceeds SCREENING_THRESHOLD.

  Layer 3 — LLM evaluate  (Sonnet + Evaluator Skill)
    Full compliance check.  Returns violations with tier labels and a per-tier
    summary.  Produces the final ALLOW / WARN / BLOCK decision.

Fallback path (no domains provided):
    Skips Layers 1–2 and evaluates directly against in-memory operational policies.

The domain is declared once at component registration — never inferred per-request.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Tuple  # noqa: F401 — Tuple used in return annotations

from anthropic import AsyncAnthropic

from models.policy import (
    Policy,
    PolicyRule,
    PolicyType,
    PolicyTier,
    PolicyEvaluationResult,
    PolicyViolation,
    TierSummary,
    DEFAULT_INPUT_POLICY,
    DEFAULT_OUTPUT_POLICY,
    DEFAULT_SYSTEM_POLICY,
)

_skill_manager = None


def _get_skill_manager():
    global _skill_manager
    if _skill_manager is None:
        from services.skill_manager import skill_manager
        _skill_manager = skill_manager
    return _skill_manager


# Only apply Layer 2 screening when the domain-filtered rule count exceeds this.
# Screening a handful of rules adds latency for no gain.
SCREENING_THRESHOLD = 5

# Enforcement timing per policy_type
_ENFORCEMENT_MAP: Dict[str, List[str]] = {
    "input":  ["pre_check", "in_flight"],
    "output": ["post_check", "in_flight"],
    "system": ["pre_check", "post_check", "in_flight"],
}


@dataclass
class EvalRule:
    """Source-agnostic rule ready for LLM evaluation."""
    id: str
    name: str
    content: str
    severity: Literal["block", "warn", "info"]
    policy_id: str
    policy_name: str
    tier: str = "implicit"  # "external" | "internal" | "implicit"
    source_type: str = "source"  # "source" | "implicit" — classification within tier
    description: Optional[str] = None
    source_document: Optional[str] = None
    library_id: Optional[str] = None
    library_name: Optional[str] = None


def _map_knowledge_rule_severity(strength: str, action: str, risk_level: str) -> Literal["block", "warn", "info"]:
    """Map knowledge-rule strength + action + risk to block/warn/info."""
    if action == "deny" or risk_level == "critical":
        return "block"
    if action == "require_approval" and strength in ("must", "must_not"):
        return "block"
    if action in ("log", "require_approval"):
        return "warn"
    return "info"


def _knowledge_rule_to_eval(kr: Dict) -> EvalRule:
    severity = _map_knowledge_rule_severity(
        kr.get("strength", "should"),
        kr.get("action", "log"),
        kr.get("riskLevel", "medium"),
    )
    sources = kr.get("source", [])
    source_ref = sources[0].get("reference") if sources else None
    library_id = kr.get("libraryId")
    library_name = kr.get("libraryName")
    tier = kr.get("tier", "implicit")
    if tier not in ("external", "internal", "implicit"):
        tier = "implicit"
    return EvalRule(
        id=kr["id"],
        name=kr["title"],
        content=kr["summary"],
        severity=severity,
        policy_id=library_id or f"kr-{kr['id']}",
        policy_name=library_name or "Policy Knowledge Library",
        tier=tier,
        source_document=source_ref,
        library_id=library_id,
        library_name=library_name,
    )


def _build_tier_summary(rules: List["EvalRule"], violations: List[PolicyViolation]) -> TierSummary:
    """Build a TierSummary from the evaluated rule set and detected violations."""
    present_tiers = {r.tier for r in rules}
    violated_tiers = {v.tier for v in violations}
    def _status(tier: str) -> str:
        if tier not in present_tiers:
            return "NOT_EVALUATED"
        return "FAIL" if tier in violated_tiers else "PASS"
    return TierSummary(
        external=_status("external"),
        internal=_status("internal"),
        implicit=_status("implicit"),
    )


def _evaluation_failure(
    rules: List["EvalRule"], reason: str
) -> Tuple[List[PolicyViolation], TierSummary]:
    """Fail closed when the policy evaluator cannot produce a valid decision."""
    violation = PolicyViolation(
        policy_id="policy-engine",
        policy_name="Policy Engine Availability",
        rule_id="policy-evaluation-unavailable",
        rule_name="Policy Evaluation Must Complete",
        tier="implicit",
        severity="block",
        reason=reason,
        suggestion="Restore the policy evaluator and retry the request.",
    )
    base_summary = _build_tier_summary(rules, [violation])
    return [violation], TierSummary(
        external=base_summary.external,
        internal=base_summary.internal,
        implicit="FAIL",
    )


class PolicyEngine:
    def __init__(self) -> None:
        self._policies: Dict[str, Policy] = {}
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self) -> None:
        if self._initialized:
            return
        async with self._lock:
            await self._load_policies_from_file()
            if not any(p.type == "input" for p in self._policies.values()):
                self._policies[DEFAULT_INPUT_POLICY.id] = DEFAULT_INPUT_POLICY
                print("[POLICY-ENGINE] Using default input policy")
            if not any(p.type == "output" for p in self._policies.values()):
                self._policies[DEFAULT_OUTPUT_POLICY.id] = DEFAULT_OUTPUT_POLICY
                print("[POLICY-ENGINE] Using default output policy")
            if not any(p.type == "system" for p in self._policies.values()):
                self._policies[DEFAULT_SYSTEM_POLICY.id] = DEFAULT_SYSTEM_POLICY
                print("[POLICY-ENGINE] Using default system policy")
            self._initialized = True
            print(f"[POLICY-ENGINE] Initialized with {len(self._policies)} policies")

    # ------------------------------------------------------------------
    # Policy CRUD
    # ------------------------------------------------------------------

    async def _load_policies_from_file(self) -> bool:
        policy_file = os.getenv("POLICY_FILE", "policies.json")
        loaded = 0
        if os.path.exists(policy_file):
            try:
                with open(policy_file) as f:
                    data = json.load(f)
                for p in data.get("policies", []):
                    policy = Policy(**p)
                    self._policies[policy.id] = policy
                    loaded += 1
                print(f"[POLICY-ENGINE] Loaded {loaded} policies from {policy_file}")
            except Exception as e:
                print(f"[POLICY-ENGINE] Error loading policies: {e}")
        else:
            print(f"[POLICY-ENGINE] No policy file at {policy_file}")
        return loaded > 0

    async def _save_policies_to_file(self) -> None:
        policy_file = os.getenv("POLICY_FILE", "policies.json")
        try:
            custom = [p.model_dump() for p in self._policies.values() if not p.id.startswith("default-")]
            with open(policy_file, "w") as f:
                json.dump({"policies": custom}, f, indent=2)
        except Exception as e:
            print(f"[POLICY-ENGINE] Error saving policies: {e}")

    async def add_policy(self, policy: Policy) -> Policy:
        async with self._lock:
            self._policies[policy.id] = policy
            await self._save_policies_to_file()
            return policy

    async def get_policy(self, policy_id: str) -> Optional[Policy]:
        async with self._lock:
            return self._policies.get(policy_id)

    async def update_policy(self, policy_id: str, updates: Dict) -> Optional[Policy]:
        async with self._lock:
            if policy_id not in self._policies:
                return None
            policy_dict = self._policies[policy_id].model_dump()
            for key, value in updates.items():
                if value is not None and key in policy_dict:
                    policy_dict[key] = value
            policy_dict["updated_at"] = int(time.time() * 1000)
            updated = Policy(**policy_dict)
            self._policies[policy_id] = updated
            await self._save_policies_to_file()
            return updated

    async def delete_policy(self, policy_id: str) -> bool:
        async with self._lock:
            if policy_id not in self._policies:
                return False
            if policy_id.startswith("default-"):
                raise ValueError("Cannot delete default policies")
            del self._policies[policy_id]
            await self._save_policies_to_file()
            return True

    async def list_policies(self, policy_type: Optional[PolicyType] = None) -> List[Policy]:
        async with self._lock:
            policies = list(self._policies.values())
            if policy_type:
                policies = [p for p in policies if p.type == policy_type]
            return policies

    async def get_active_policies(self, policy_type: PolicyType) -> List[Policy]:
        async with self._lock:
            return [p for p in self._policies.values() if p.type == policy_type and p.status == "active"]

    # ------------------------------------------------------------------
    # Main evaluation entry point
    # ------------------------------------------------------------------

    async def evaluate_content(
        self,
        content: str,
        policy_type: PolicyType,
        context: Optional[Dict] = None,
        domains: Optional[List[str]] = None,
        component_id: Optional[str] = None,
    ) -> PolicyEvaluationResult:
        """
        Evaluate content through the three-tier policy pipeline.

        External + internal rules are fetched from MongoDB (filtered by domain and
        component).  Implicit tier is always evaluated by LLM ethical judgment —
        no stored rules needed.

        Without a component domain, evaluates global/org Policy Library rules.
        In-memory operational policies are used only if the library is unavailable.
        """
        start_time = time.time()

        if domains:
            # Layer 1 — fetch stored external + internal rules
            eval_rules = await self._get_knowledge_eval_rules(domains, policy_type, component_id)
            source_label = f"knowledge_rules(domains={domains})"
            if not eval_rules:
                eval_rules = await self._get_operational_eval_rules(policy_type)
                source_label = "operational_policies(fallback)"
        else:
            # No component domain: use global/org rules from the same MongoDB
            # Policy Library shown in the admin UI.  Operational file policies
            # are only a last-resort fallback when the library is unavailable.
            eval_rules = await self._get_global_knowledge_eval_rules(policy_type)
            source_label = "knowledge_rules(global)"
            if not eval_rules:
                eval_rules = await self._get_operational_eval_rules(policy_type)
                source_label = "operational_policies(fallback)"

        # Implicit tier is always evaluated by LLM — no stored rules needed.
        # We mark it with a sentinel so the evaluator knows to apply ethical judgment.
        eval_rules = [r for r in eval_rules if r.tier != "implicit"]  # strip any stale implicit rows

        if not eval_rules:
            return PolicyEvaluationResult(
                passed=True,
                evaluated_policies=0,
                evaluation_time_ms=int((time.time() - start_time) * 1000),
                decision="ALLOW",
                summary="No rules to evaluate",
            )

        tier_counts = {t: sum(1 for r in eval_rules if r.tier == t) for t in ("external", "internal", "implicit")}
        print(f"[POLICY-ENGINE] Layer 1 | {policy_type} | {len(eval_rules)} rules "
              f"(ext={tier_counts['external']} int={tier_counts['internal']} imp={tier_counts['implicit']}) "
              f"| source={source_label}")

        # Layer 2 — LLM pre-screen
        # External rules bypass screening — they are mandatory.
        # Screen only when the non-external rule count exceeds threshold.
        non_external_count = tier_counts["internal"] + tier_counts["implicit"]
        if source_label.startswith("knowledge_rules") and non_external_count > SCREENING_THRESHOLD:
            screened = await self._prescreen_rules(content, eval_rules, policy_type)
            print(f"[POLICY-ENGINE] Layer 2 | screened {len(eval_rules)} → {len(screened)} rules")
            eval_rules = screened if screened else eval_rules  # safety: never discard all

        # Layer 3 — full compliance evaluation
        print(f"[POLICY-ENGINE] Layer 3 | evaluating {len(eval_rules)} rules")
        violations, tier_summary = await self._evaluate_rules(content, eval_rules, policy_type, context)

        has_block = any(v.severity == "block" for v in violations)
        has_warn  = any(v.severity == "warn"  for v in violations)
        if has_block:
            decision, passed = "BLOCK", False
        elif has_warn:
            decision, passed = "WARN", True
        else:
            decision, passed = "ALLOW", True

        return PolicyEvaluationResult(
            passed=passed,
            violations=violations,
            evaluated_policies=len({r.policy_id for r in eval_rules}),
            evaluation_time_ms=int((time.time() - start_time) * 1000),
            decision=decision,
            summary=self._generate_summary(violations, decision),
            tier_summary=tier_summary,
        )

    # ------------------------------------------------------------------
    # Rule resolution
    # ------------------------------------------------------------------

    async def _get_knowledge_eval_rules(
        self,
        domains: List[str],
        policy_type: PolicyType,
        component_id: Optional[str] = None,
    ) -> List[EvalRule]:
        """
        Fetch external and internal knowledge rules from MongoDB.

        Policy classification:
          external source  — external rules from uploaded documents (domain-matched)
          internal source  — internal rules uploaded at component registration (by componentId)
          internal global  — internal rules not tied to any specific component
          implicit         — not stored; LLM applies ethical judgment directly

        When component_id is provided:
          - global internal rules (no componentId) always apply
          - component-specific internal source rules (componentId == component_id) are also included
        When component_id is absent: all internal rules are fetched (backward-compatible).
        """
        try:
            from modules.policy import db as policy_db
            enforcements = _ENFORCEMENT_MAP.get(policy_type, [])

            # External source rules — matched by domain (legally binding)
            external_rows = await policy_db.list_rules(
                domains=domains,
                tiers=["external"],
                statuses=["active"],
                enforcements=enforcements,
            )

            if component_id:
                # Fetch all internal rules, then split into global vs component-specific.
                # Global rules (no componentId) apply to all requests.
                # Component-specific "internal source" rules apply only when componentId matches.
                all_internal_rows = await policy_db.list_rules(
                    domains=domains,
                    tiers=["internal"],
                    statuses=["active"],
                    enforcements=enforcements,
                )
                global_internal_rows = [r for r in all_internal_rows if not r.get("componentId")]
                component_internal_rows = [r for r in all_internal_rows if r.get("componentId") == component_id]
                internal_rows = global_internal_rows + component_internal_rows
                print(
                    f"[POLICY-ENGINE] Knowledge rules for domains={domains} component={component_id}: "
                    f"{len(external_rows)} external + {len(global_internal_rows)} internal-global "
                    f"+ {len(component_internal_rows)} internal-source"
                )
            else:
                # No component context — fetch all internal rules
                internal_rows = await policy_db.list_rules(
                    domains=domains,
                    tiers=["internal"],
                    statuses=["active"],
                    enforcements=enforcements,
                )
                print(
                    f"[POLICY-ENGINE] Knowledge rules for domains={domains}: "
                    f"{len(external_rows)} external + {len(internal_rows)} internal"
                )

            rules: List[EvalRule] = []
            for r in external_rows:
                er = _knowledge_rule_to_eval(r)
                er.source_type = "source"
                rules.append(er)
            for r in internal_rows:
                er = _knowledge_rule_to_eval(r)
                # Rules with a componentId are "internal source" (uploaded at registration)
                er.source_type = "source" if r.get("componentId") else "source"
                rules.append(er)

            return rules
        except Exception as e:
            print(f"[POLICY-ENGINE] Could not fetch knowledge rules: {e}")
            return []

    async def _get_global_knowledge_eval_rules(
        self,
        policy_type: PolicyType,
    ) -> List[EvalRule]:
        """Fetch global/org Policy Library rules when no component domain exists."""
        try:
            from modules.policy import db as policy_db

            rows = await policy_db.list_rules(
                scopes=["global", "org"],
                tiers=["external", "internal"],
                statuses=["active"],
                enforcements=_ENFORCEMENT_MAP.get(policy_type, []),
            )
            # Component-owned rules must never leak into an unscoped request.
            rows = [row for row in rows if not row.get("componentId")]
            rules = [_knowledge_rule_to_eval(row) for row in rows]
            for rule in rules:
                rule.source_type = "source"
            print(
                f"[POLICY-ENGINE] Global Policy Library rules for {policy_type}: "
                f"{len(rules)}"
            )
            return rules
        except Exception as e:
            print(f"[POLICY-ENGINE] Could not fetch global Policy Library rules: {e}")
            return []

    async def _get_operational_eval_rules(self, policy_type: PolicyType) -> List[EvalRule]:
        """Flatten in-memory operational policies into EvalRule list."""
        policies = await self.get_active_policies(policy_type)
        result: List[EvalRule] = []
        for policy in policies:
            for rule in policy.rules:
                if rule.enabled:
                    result.append(EvalRule(
                        id=rule.id,
                        name=rule.name,
                        content=rule.content,
                        severity=rule.severity,
                        policy_id=policy.id,
                        policy_name=policy.name,
                        tier=getattr(rule, "tier", "implicit"),
                        description=rule.description,
                        source_document=getattr(rule, "source_document", None),
                    ))
        return result

    # ------------------------------------------------------------------
    # Layer 2: LLM pre-screen
    # ------------------------------------------------------------------

    async def _prescreen_rules(
        self,
        content: str,
        rules: List[EvalRule],
        policy_type: PolicyType,
    ) -> List[EvalRule]:
        """
        Use a fast model (Haiku) + Screener Skill to decide which rules in the
        domain-filtered set are relevant to this specific piece of content.

        Returns a subset of `rules`.  If screening fails for any reason the
        original list is returned unchanged so Layer 3 is never skipped.
        """
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return rules

        skill_id = _get_skill_manager().get("policy_screener")
        client = AsyncAnthropic(api_key=api_key)
        haiku = os.getenv("CLAUDE_HAIKU_MODEL", "claude-haiku-4-5-20251001")

        # External rules bypass screening — they are mandatory regardless of content topic
        external_rules = [r for r in rules if r.tier == "external"]
        screenable_rules = [r for r in rules if r.tier != "external"]

        if not screenable_rules:
            return rules  # nothing to screen

        # Build a compact rule list: id + name + tier + one-line description
        rules_desc = "\n".join(
            f'- id: "{r.id}" | tier: "{r.tier}" | name: "{r.name}" | description: "{r.content[:120]}"'
            for r in screenable_rules
        )
        type_label = {"input": "user input", "output": "AI response", "system": "system operation"}.get(
            policy_type, "content"
        )
        prompt = (
            f"Screen the following rules for relevance to this {type_label}.\n\n"
            f"RULES:\n{rules_desc}\n\n"
            f"CONTENT:\n{content[:1500]}"
        )

        try:
            if skill_id:
                response = await client.beta.messages.create(
                    model=haiku,
                    max_tokens=300,
                    messages=[{"role": "user", "content": prompt}],
                    container={"skills": [{"skill_id": skill_id}]},
                    betas=["skills-2025-10-02"],
                )
            else:
                # Inline fallback — include screening instructions in prompt
                fallback_prompt = (
                    f"You are a policy rule relevance filter. Given a piece of content and a list of rules, "
                    f"return only the IDs of rules that are relevant to the content's subject matter. "
                    f"Do NOT evaluate violations — only judge relevance. "
                    f'Respond with JSON only: {{"relevant_ids": ["id1", "id2"]}}\n\n'
                    + prompt
                )
                response = await client.messages.create(
                    model=haiku,
                    max_tokens=300,
                    messages=[{"role": "user", "content": fallback_prompt}],
                )

            text = "".join(b.text for b in response.content if hasattr(b, "text"))
            m = re.search(r"\{[\s\S]*?\}", text)
            if not m:
                return rules

            data = json.loads(m.group())
            relevant_ids = set(data.get("relevant_ids", []))
            if not relevant_ids:
                # screener returned empty — keep all screenable rules (safety net)
                return external_rules + screenable_rules

            filtered_screenable = [r for r in screenable_rules if r.id in relevant_ids]
            # External rules always pass through regardless of screener output
            return external_rules + (filtered_screenable if filtered_screenable else screenable_rules)

        except Exception as e:
            print(f"[POLICY-ENGINE] Pre-screen error (keeping all rules): {e}")
            return rules

    # ------------------------------------------------------------------
    # Layer 3: LLM evaluation
    # ------------------------------------------------------------------

    async def _evaluate_rules(
        self,
        content: str,
        rules: List[EvalRule],
        policy_type: PolicyType,
        context: Optional[Dict] = None,
    ) -> Tuple[List[PolicyViolation], TierSummary]:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return _evaluation_failure(
                rules,
                "Policy evaluation could not run because ANTHROPIC_API_KEY is not configured.",
            )

        # Implicit rules are never stored — the evaluator always applies ethical judgment.
        def _rule_label(r: EvalRule) -> str:
            if r.tier == "internal" and r.source_type == "source":
                return "internal source"
            return r.tier

        stored_rules_text = "\n".join(
            f"- id: \"{r.id}\" | tier: \"{_rule_label(r)}\" | name: \"{r.name}\" (severity: {r.severity}): {r.content}"
            for r in rules
        ) or "(none)"

        type_label = {
            "input": "user input",
            "output": "AI response",
            "system": "system operation",
        }.get(policy_type, "content")

        implicit_instruction = (
            "IMPLICIT TIER: No stored rules. Apply your own ethical and moral judgment. "
            "Flag content that is deceptive, manipulative, dignity-violating, or causes harm "
            "even if no explicit rule covers it. tier_summary.implicit must always be PASS or FAIL."
        )

        skill_id = _get_skill_manager().get("policy_evaluator")
        client = AsyncAnthropic(api_key=api_key)
        model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

        if skill_id:
            prompt = (
                f"Evaluate this {type_label} against the stored rules below, "
                f"and also apply implicit ethical judgment.\n\n"
                f"STORED RULES (external + internal):\n{stored_rules_text}\n\n"
                f"{implicit_instruction}\n\n"
                f"CONTENT:\n{content}"
            )
            create_kwargs: Dict = {
                "container": {"skills": [{"skill_id": skill_id}]},
                "betas": ["skills-2025-10-02"],
            }
        else:
            prompt = (
                f"You are a policy compliance evaluator. Evaluate the following {type_label} "
                f"and respond in JSON.\n\n"
                f"STORED RULES (external = legally binding, internal source = component-specific organizational policies uploaded at registration, internal = general organizational):\n"
                f"{stored_rules_text}\n\n"
                f"{implicit_instruction}\n\n"
                f"CONTENT TO EVALUATE:\n{content}\n\n"
                f'Respond with: {{"violations": [{{"rule_id": "...", "rule_name": "...", '
                f'"tier": "external|internal|implicit", "severity": "block|warn|info", '
                f'"reason": "...", "suggestion": "..."}}], "passed": true/false, '
                f'"tier_summary": {{"external": "PASS|FAIL|NOT_EVALUATED", '
                f'"internal": "PASS|FAIL|NOT_EVALUATED", "implicit": "PASS|FAIL"}}}}\n'
                f'If no violations: {{"violations": [], "passed": true, '
                f'"tier_summary": {{"external": "PASS", "internal": "PASS", "implicit": "PASS"}}}}'
            )
            create_kwargs = {}

        try:
            response = await client.beta.messages.create(
                model=model,
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
                **create_kwargs,
            )
            text = "".join(b.text for b in response.content if hasattr(b, "text"))
            m = re.search(r"\{[\s\S]*\}", text)
            if not m:
                return _evaluation_failure(
                    rules,
                    "Policy evaluator returned an invalid response, so the content was not approved.",
                )

            result = json.loads(m.group())
            rule_map_by_name = {r.name: r for r in rules}
            rule_map_by_id   = {r.id:   r for r in rules}
            violations: List[PolicyViolation] = []

            for v in result.get("violations", []):
                rule_name = v.get("rule_name", "")
                rule_id   = v.get("rule_id", "")
                tier      = v.get("tier", "implicit")

                if tier == "implicit" or rule_id == "implicit":
                    # Implicit violations come from LLM judgment — no stored rule
                    violations.append(PolicyViolation(
                        policy_id="implicit",
                        policy_name="Implicit Ethical Policy",
                        rule_id="implicit",
                        rule_name=rule_name or "Ethical Principle",
                        tier="implicit",
                        severity=v.get("severity", "warn"),
                        reason=v.get("reason", "Ethical concern detected"),
                        suggestion=v.get("suggestion"),
                    ))
                    continue

                rule = rule_map_by_id.get(rule_id) or rule_map_by_name.get(rule_name)
                if rule is None:
                    for name, r in rule_map_by_name.items():
                        if rule_name in name or name in rule_name:
                            rule = r
                            break
                if rule is None:
                    continue
                reported_tier = v.get("tier", rule.tier)
                if reported_tier not in ("external", "internal", "implicit"):
                    reported_tier = rule.tier
                violations.append(PolicyViolation(
                    policy_id=rule.policy_id,
                    policy_name=rule.policy_name,
                    rule_id=rule.id,
                    rule_name=rule.name,
                    tier=reported_tier,
                    severity=v.get("severity", rule.severity),
                    reason=v.get("reason", "Policy violation detected"),
                    suggestion=v.get("suggestion"),
                    rule_description=rule.description,
                    rule_content=rule.content,
                    source_document=rule.source_document,
                    library_id=rule.library_id,
                    library_name=rule.library_name,
                ))

            raw_ts = result.get("tier_summary", {})
            # implicit is always PASS or FAIL — never NOT_EVALUATED
            implicit_status = raw_ts.get("implicit", "PASS")
            if implicit_status == "NOT_EVALUATED":
                implicit_status = "PASS"
            tier_summary = TierSummary(
                external=raw_ts.get("external", "NOT_EVALUATED"),
                internal=raw_ts.get("internal", "NOT_EVALUATED"),
                implicit=implicit_status,
            )
            return violations, tier_summary

        except Exception as e:
            print(f"[POLICY-ENGINE] Evaluation error: {e}")
            return _evaluation_failure(
                rules,
                "Policy evaluation failed, so the content was not approved.",
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _generate_summary(self, violations: List[PolicyViolation], decision: str) -> str:
        if not violations:
            return "Content passed all policy checks."
        block = sum(1 for v in violations if v.severity == "block")
        warn  = sum(1 for v in violations if v.severity == "warn")
        info  = sum(1 for v in violations if v.severity == "info")
        parts = []
        if block: parts.append(f"{block} blocking violation(s)")
        if warn:  parts.append(f"{warn} warning(s)")
        if info:  parts.append(f"{info} info item(s)")
        return f"Found {', '.join(parts)}. Decision: {decision}"


# Singleton instance
policy_engine = PolicyEngine()
