"""
Policy Search Service — fetch external policies for a given domain using web search.

When a component is registered with one or more domains, this service:
  1. Uses the Anthropic API with the web_search tool to find relevant laws,
     regulations, and industry standards for each domain.
  2. Parses the results into knowledge_rule records.
  3. Stores them in MongoDB with tier="external" and componentId set.

Implicit-tier policy evaluation is handled entirely by the LLM at evaluation
time — this service does not generate implicit rules.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List, Optional

from anthropic import AsyncAnthropic


_SEARCH_PROMPT = """\
You are a legal and regulatory research assistant.

A software component has been registered in the domain: "{domain}"

Your task:
1. Use the web_search tool to find the most relevant laws, government regulations,
   privacy policies, and industry standards that apply to AI systems or software
   operating in this domain.
2. For each regulation or standard you find, extract a concise, actionable rule
   that an AI system must follow.

Return ONLY a JSON array — no other text:
[
  {{
    "title": "short rule title (e.g. GDPR Article 5 — Data Minimisation)",
    "summary": "one or two sentences describing what the system must or must not do",
    "source_name": "name of the regulation or standard (e.g. GDPR, HIPAA, FERPA)",
    "source_url": "URL where the rule can be verified",
    "jurisdiction": ["e.g. EU", "US", "Global"],
    "strength": "must|must_not|should|should_not",
    "action": "deny|require_approval|log",
    "risk_level": "critical|high|medium|low"
  }},
  ...
]

Return between 3 and 10 rules. Focus on rules that are directly actionable by
an AI system (not administrative obligations for humans). Return only the JSON array.
"""


async def search_and_store_external_policies(
    domains: List[str],
    component_id: str,
    component_name: str,
) -> Dict[str, Any]:
    """
    Search the web for external policies covering the given domains and store
    the results as knowledge_rules in MongoDB.

    Returns a summary dict with counts and any errors.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"rules_created": 0, "errors": ["ANTHROPIC_API_KEY not set"]}

    try:
        from modules.policy import db as policy_db
    except Exception as exc:
        return {"rules_created": 0, "errors": [f"Policy DB unavailable: {exc}"]}

    client = AsyncAnthropic(api_key=api_key)
    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")

    created: List[str] = []
    errors: List[str] = []

    for domain in domains:
        try:
            rules = await _search_domain(client, model, domain)
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            for r in rules:
                rule_id = str(uuid.uuid4())
                record: Dict[str, Any] = {
                    "id": rule_id,
                    "title": r.get("title", "Untitled Rule"),
                    "summary": r.get("summary", ""),
                    "domain": [domain],
                    "tier": "external",
                    "componentId": component_id,
                    "componentName": component_name,
                    "source": [
                        {
                            "name": r.get("source_name", ""),
                            "reference": r.get("source_url", ""),
                        }
                    ],
                    "jurisdiction": r.get("jurisdiction", []),
                    "strength": r.get("strength", "must"),
                    "action": r.get("action", "deny"),
                    "riskLevel": r.get("risk_level", "high"),
                    "status": "active",
                    "enforcement": ["pre_check", "post_check", "in_flight"],
                    "intentType": "external_regulation",
                    "scope": "component",
                    "lastModified": now_iso,
                }
                await policy_db.create_rule(record)
                created.append(rule_id)

            print(f"[POLICY-SEARCH] domain='{domain}' → {len(rules)} rules created")

        except Exception as exc:
            msg = f"domain='{domain}': {exc}"
            errors.append(msg)
            print(f"[POLICY-SEARCH] Error — {msg}")

    return {
        "component_id": component_id,
        "domains_searched": domains,
        "rules_created": len(created),
        "rule_ids": created,
        "errors": errors,
    }


async def _search_domain(
    client: AsyncAnthropic,
    model: str,
    domain: str,
) -> List[Dict[str, Any]]:
    """Call the Anthropic API with web_search tool for a single domain."""
    import json
    import re

    prompt = _SEARCH_PROMPT.format(domain=domain)

    response = await client.messages.create(
        model=model,
        max_tokens=2000,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": prompt}],
    )

    # Collect all text blocks from the response
    text = "".join(
        block.text for block in response.content if hasattr(block, "text")
    )

    # Extract JSON array from the response
    m = re.search(r"\[[\s\S]*\]", text)
    if not m:
        return []

    try:
        rules = json.loads(m.group())
        return [r for r in rules if isinstance(r, dict) and r.get("summary")]
    except Exception:
        return []


async def delete_external_policies_for_component(component_id: str) -> int:
    """Remove all web-searched external rules for a component (e.g. on re-registration)."""
    try:
        from core.db_base import get_module_db, POLICY_DB
        result = await get_module_db(POLICY_DB)["knowledge_rules"].delete_many(
            {"tier": "external", "componentId": component_id}
        )
        return result.deleted_count
    except Exception as exc:
        print(f"[POLICY-SEARCH] Delete error for component {component_id}: {exc}")
        return 0
