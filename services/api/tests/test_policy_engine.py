from __future__ import annotations

import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from models.policy import DEFAULT_OUTPUT_POLICY, TierSummary
from modules.policy.db import _infer_seed_rule_tier
from services.policy_engine import EvalRule, PolicyEngine, _knowledge_rule_to_eval


class _FakeMessages:
    def __init__(self, response_text: str) -> None:
        self._response_text = response_text

    async def create(self, **_kwargs):
        return SimpleNamespace(
            content=[SimpleNamespace(text=self._response_text)]
        )


class _FakeAnthropic:
    response_text = ""

    def __init__(self, **_kwargs) -> None:
        messages = _FakeMessages(self.response_text)
        self.beta = SimpleNamespace(messages=messages)
        self.messages = messages


class _NoSkills:
    def get(self, _name: str):
        return None


class PolicyEngineRegressionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.engine = PolicyEngine()
        self.engine._policies = {
            DEFAULT_OUTPUT_POLICY.id: DEFAULT_OUTPUT_POLICY,
        }
        self.engine._initialized = True
        self.engine._get_global_knowledge_eval_rules = AsyncMock(return_value=[])

    async def test_default_operational_rules_are_not_filtered_out(self) -> None:
        rules = await self.engine._get_operational_eval_rules("output")

        self.assertEqual(4, len(rules))
        self.assertTrue(all(rule.tier == "internal" for rule in rules))

    async def test_internal_knowledge_rules_are_filtered_by_domain(self) -> None:
        from modules.policy import db as policy_db

        list_rules = AsyncMock(return_value=[])
        with patch.object(policy_db, "list_rules", list_rules):
            await self.engine._get_knowledge_eval_rules(
                domains=["healthcare"],
                policy_type="input",
            )

        self.assertEqual(2, list_rules.await_count)
        for call in list_rules.await_args_list:
            self.assertEqual(["healthcare"], call.kwargs["domains"])

    async def test_unscoped_evaluation_prefers_policy_library_rules(self) -> None:
        library_rule = EvalRule(
            id="library-medical-rule",
            name="Medical Disclaimer",
            content="Medical outputs require a disclaimer.",
            severity="block",
            policy_id="kr-library-medical-rule",
            policy_name="Policy Knowledge Library",
            tier="internal",
        )
        self.engine._get_global_knowledge_eval_rules = AsyncMock(
            return_value=[library_rule]
        )
        self.engine._get_operational_eval_rules = AsyncMock(return_value=[])
        self.engine._evaluate_rules = AsyncMock(
            return_value=([], TierSummary(
                external="NOT_EVALUATED",
                internal="PASS",
                implicit="PASS",
            ))
        )

        result = await self.engine.evaluate_content(
            content="A medical response.",
            policy_type="output",
        )

        self.assertEqual("ALLOW", result.decision)
        self.engine._get_global_knowledge_eval_rules.assert_awaited_once_with("output")
        self.engine._get_operational_eval_rules.assert_not_awaited()

    def test_knowledge_rule_preserves_library_provenance(self) -> None:
        rule = _knowledge_rule_to_eval({
            "id": "rule-123",
            "title": "Medical Disclaimer",
            "summary": "Medical outputs require a disclaimer.",
            "domain": ["Healthcare"],
            "strength": "must",
            "action": "require_approval",
            "riskLevel": "high",
            "tier": "internal",
            "libraryId": "library-123",
            "libraryName": "Clinical Safety Policy",
            "source": [{"type": "internal", "reference": "clinical-policy.pdf"}],
        })

        self.assertEqual("library-123", rule.policy_id)
        self.assertEqual("Clinical Safety Policy", rule.policy_name)
        self.assertEqual("library-123", rule.library_id)

    async def test_missing_evaluator_key_blocks_instead_of_allowing(self) -> None:
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            result = await self.engine.evaluate_content(
                content="Take 800 mg of ibuprofen every four hours.",
                policy_type="output",
            )

        self.assertEqual("BLOCK", result.decision)
        self.assertFalse(result.passed)
        self.assertEqual(
            "policy-evaluation-unavailable",
            result.violations[0].rule_id,
        )

    async def test_medical_advice_without_disclaimer_warns(self) -> None:
        _FakeAnthropic.response_text = """{
          "violations": [{
            "rule_id": "output-accurate",
            "rule_name": "Accuracy Disclaimer",
            "tier": "internal source",
            "severity": "warn",
            "reason": "The response gives medical dosing advice without a disclaimer or referral to a qualified professional."
          }],
          "passed": false,
          "tier_summary": {
            "external": "NOT_EVALUATED",
            "internal": "FAIL",
            "implicit": "PASS"
          }
        }"""

        with (
            patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}),
            patch("services.policy_engine.AsyncAnthropic", _FakeAnthropic),
            patch("services.policy_engine._get_skill_manager", return_value=_NoSkills()),
        ):
            result = await self.engine.evaluate_content(
                content="You have a migraine. Take 800 mg of ibuprofen every four hours.",
                policy_type="output",
            )

        self.assertEqual("WARN", result.decision)
        self.assertTrue(result.passed)
        self.assertEqual("output-accurate", result.violations[0].rule_id)

    async def test_invalid_evaluator_response_blocks(self) -> None:
        _FakeAnthropic.response_text = "not-json"

        with (
            patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}),
            patch("services.policy_engine.AsyncAnthropic", _FakeAnthropic),
            patch("services.policy_engine._get_skill_manager", return_value=_NoSkills()),
        ):
            result = await self.engine.evaluate_content(
                content="A response that still requires policy evaluation.",
                policy_type="output",
            )

        self.assertEqual("BLOCK", result.decision)
        self.assertFalse(result.passed)

    def test_legacy_seed_rules_receive_a_tier(self) -> None:
        self.assertEqual(
            "internal",
            _infer_seed_rule_tier({"source": [{"type": "internal"}]}),
        )
        self.assertEqual(
            "external",
            _infer_seed_rule_tier({"source": [{"type": "regulation"}]}),
        )


if __name__ == "__main__":
    unittest.main()
