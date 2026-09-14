"""
Policy module database — MongoDB: policy
Collection: knowledge_rules

Stores the rich knowledge rule library that feeds PolicyKnowledgeLibrary in the UI.
Separate from the policy_engine's operational Policy/PolicyRule models.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from core.db_base import get_module_db, POLICY_DB

COLLECTION = "knowledge_rules"


def _col():
    return get_module_db(POLICY_DB)[COLLECTION]


async def ensure_indexes() -> None:
    col = _col()
    await col.create_index("id", unique=True)
    await col.create_index("status")
    await col.create_index("domain")
    await col.create_index("jurisdiction")
    await col.create_index("riskLevel")
    await col.create_index("tier")
    await col.create_index("componentId")
    try:
        await col.create_index([("title", "text"), ("summary", "text")])
    except Exception:
        pass  # text index may already exist


async def count_rules() -> int:
    return await _col().count_documents({})


async def _upsert_rule(rule: Dict[str, Any]) -> None:
    """Insert rule if its stable id does not exist yet."""
    await _col().update_one({"id": rule["id"]}, {"$setOnInsert": rule}, upsert=True)


def _infer_seed_rule_tier(rule: Dict[str, Any]) -> str:
    """Infer a tier for legacy seed rules that predate the tier field."""
    source_types = {source.get("type") for source in rule.get("source", [])}
    if "internal" in source_types:
        return "internal"
    if source_types.intersection({"regulation", "standard"}):
        return "external"
    return "internal"


async def migrate_missing_rule_tiers() -> int:
    """Backfill tier on existing rules without overwriting an explicit value."""
    col = _col()
    missing_tier = {
        "$or": [
            {"tier": {"$exists": False}},
            {"tier": None},
            {"tier": ""},
        ]
    }
    migrated = 0

    result = await col.update_many(
        {"$and": [missing_tier, {"source.type": "internal"}]},
        {"$set": {"tier": "internal"}},
    )
    migrated += result.modified_count

    result = await col.update_many(
        {"$and": [missing_tier, {"source.type": {"$in": ["regulation", "standard"]}}]},
        {"$set": {"tier": "external"}},
    )
    migrated += result.modified_count

    # Rules without recognizable source metadata are organizational by default.
    result = await col.update_many(missing_tier, {"$set": {"tier": "internal"}})
    migrated += result.modified_count
    return migrated


async def seed_default_rules() -> None:
    """Seed the knowledge-rules collection.

    Generic defaults: inserted only when the collection is empty (preserves
    any user-created rules).
    Topic-generator rules: upserted by stable id so they are always present
    even after the collection already contains other data.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    defaults = [
        {
            "id": str(uuid.uuid4()),
            "title": "GDPR Data Minimization",
            "summary": "Personal data must be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed.",
            "domain": ["Data Privacy"],
            "jurisdiction": ["EU"],
            "intentType": "data_handling",
            "scope": "global",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "regulation", "reference": "GDPR Art. 5(1)(c)", "url": "https://gdpr-info.eu/art-5-gdpr/"}],
            "inferenceModel": "rdr",
            "owner": "Compliance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AI Output Accuracy Disclaimer",
            "summary": "AI-generated medical, legal, or financial advice must include a disclaimer and recommend consulting qualified professionals.",
            "domain": ["Healthcare", "Finance", "Legal"],
            "jurisdiction": ["US", "EU"],
            "intentType": "safety_content",
            "scope": "global",
            "enforcement": "post_check",
            "strength": "must",
            "action": "require_approval",
            "source": [{"type": "internal", "reference": "AI Safety Policy v2.1"}],
            "inferenceModel": "rdr",
            "owner": "AI Safety",
            "version": "2.1",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "No PII in Model Training Data",
            "summary": "Personal identifiable information must not be used in AI model training without explicit informed consent.",
            "domain": ["Data Privacy", "AI Governance"],
            "jurisdiction": ["EU", "US"],
            "intentType": "model_ai_use",
            "scope": "global",
            "enforcement": "pre_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "regulation", "reference": "GDPR Art. 9", "url": "https://gdpr-info.eu/art-9-gdpr/"}],
            "inferenceModel": "rdr",
            "owner": "Data Governance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Role-Based Access Control for AI Features",
            "summary": "Access to sensitive AI capabilities must be restricted based on user roles and the least-privilege principle.",
            "domain": ["Security", "Governance"],
            "jurisdiction": ["Global"],
            "intentType": "access_control",
            "scope": "org",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "standard", "reference": "ISO 27001:2013 A.9.1"}],
            "inferenceModel": "knowledge_graph",
            "owner": "Security",
            "version": "1.2",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "case",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Harmful Content Prohibition",
            "summary": "AI systems must not generate content that promotes violence, illegal activities, or causes physical or psychological harm.",
            "domain": ["Content Safety"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "global",
            "enforcement": "in_flight",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Responsible AI Charter v1.0"}],
            "inferenceModel": "neural_network",
            "owner": "AI Safety",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AI Decision Audit Trail",
            "summary": "All AI-assisted decisions must be logged with sufficient context to enable post-hoc audit and review.",
            "domain": ["Governance", "Compliance"],
            "jurisdiction": ["EU", "US"],
            "intentType": "compliance",
            "scope": "global",
            "enforcement": "post_check",
            "strength": "must",
            "action": "log",
            "source": [{"type": "regulation", "reference": "EU AI Act Art. 12"}],
            "inferenceModel": "rdr",
            "owner": "Compliance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
    ]

    for rule in defaults:
        rule.setdefault("tier", _infer_seed_rule_tier(rule))

    if await count_rules() == 0:
        await _col().insert_many(defaults)
        print(f"[POLICY-MODULE] Seeded {len(defaults)} generic default knowledge rules")

    # Topic Generator specific policies — upserted by stable id every startup
    tg_now = now
    topic_generator_rules = [
        # ---- Input Policies ----
        {
            "id": "tg-in-001",
            "title": "Research Domain Scope Validation",
            "summary": "Reject inputs where the research domain is not a recognisable academic or scientific field. Entertainment, marketing, or unrelated commercial domains must be refused.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-in-002",
            "title": "Custom Prompt Override Injection Guard",
            "summary": "Scan the custom_system_prompt field for jailbreak indicators (e.g. 'ignore previous instructions', 'act as'). Block and log any detected injection attempts.",
            "domain": ["it", "education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "pre_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Security",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-in-003",
            "title": "Topic Generation Count Cap",
            "summary": "The 'count' parameter in /topics/generate must not exceed 20. Requests with count > 20 are rejected with HTTP 400 to prevent runaway API usage.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "operational",
            "scope": "request",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "case",
            "changeLog": [],
        },
        {
            "id": "tg-in-004",
            "title": "Search Query Content Safety",
            "summary": "Validate that /search queries are academic in nature. Reject queries containing HTML tags, SQL keywords as operators, or content unrelated to academic literature.",
            "domain": ["it", "education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "request",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Security",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-in-005",
            "title": "Query Generation Batch Size Limit",
            "summary": "The 'topics' array in /queries/generate must not exceed 10 items. Larger batches cause disproportionate model token usage and degrade query quality.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "operational",
            "scope": "request",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "case",
            "changeLog": [],
        },
        # ---- Output Policies ----
        {
            "id": "tg-out-001",
            "title": "No Fabricated Citations in AI Output",
            "summary": "AI-generated reasoning, synthesis and gap analysis must not contain invented bibliographic references. Any citation not traceable to user-supplied abstracts must be blocked.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-out-002",
            "title": "Boolean Search Query Format Compliance",
            "summary": "Generated queries from /queries/generate must contain at least one Boolean operator (AND/OR/NOT) and use proper parenthesisation. Plain keyword lists trigger a warn flag.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "operational",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-out-003",
            "title": "Confidence Score Honesty",
            "summary": "Topic confidence levels must not default uniformly to 'high' when the research profile is sparse (fewer than 3 filled fields). Outputs with all topics uniformly 'high' confidence must be flagged.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "standard", "reference": "NIST AI RMF 1.0 — MAP 2.3", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-out-004",
            "title": "Academic Tone Enforcement",
            "summary": "All topic-generator outputs must use formal academic language. Colloquialisms, casual first-person phrasing, emojis, and marketing superlatives are flagged at warn severity.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "case",
            "changeLog": [],
        },
        {
            "id": "tg-out-005",
            "title": "Healthcare Domain Disclaimer Requirement",
            "summary": "Outputs in healthcare/clinical domains must append a non-clinical-advice disclaimer. Outputs without the disclaimer are blocked.",
            "domain": ["healthcare", "education"],
            "jurisdiction": ["Global", "US", "EU"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "regulation", "reference": "HIPAA / EU AI Act Art. 52", "url": None}],
            "inferenceModel": "rdr",
            "owner": "AI Safety",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-out-006",
            "title": "AI Synthesis Output Disclaimer",
            "summary": "Every /synthesis response must state it is AI-generated and requires independent verification before inclusion in a systematic review.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "require_approval",
            "source": [{"type": "standard", "reference": "ISO/IEC 42001:2023 Clause 8.2", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-out-007",
            "title": "Gap Analysis Hedged Novelty Claims",
            "summary": "/gaps outputs must not assert absolute novelty ('no research has ever'). Required phrasing: 'limited evidence exists' or 'few studies have addressed'.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should_not",
            "action": "log",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-out-008",
            "title": "Matrix Cell Source Transparency",
            "summary": "'extractionMethod' in /matrix autofill must be 'direct_quote' only for verbatim/closely paraphrased abstract content. Inferred values must be labelled 'inferred'. Misclassification is a block-level violation.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "data_handling",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "standard", "reference": "PRISMA 2020 / Cochrane Handbook", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-out-009",
            "title": "Research Question Specificity Standard",
            "summary": "/final_question output must include a defined population/context, a specific phenomenon/intervention, and a measurable outcome. Vague questions trigger a warn flag with reformulation guidance.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "operational",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "standard", "reference": "Cochrane Handbook — PICO Framework", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-out-010",
            "title": "Tag Academic Validity",
            "summary": "Generated topic tags must be recognisable academic or MeSH-aligned terms. Outputs where more than 50% of tags are non-academic must be regenerated.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "operational",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "internal", "reference": "Topic Generator Policy v1.0", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research AI Team",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "case",
            "changeLog": [],
        },
        # ---- Research Ethics Policies ----
        {
            "id": "tg-eth-001",
            "title": "Research Integrity — No Plagiarism Facilitation",
            "summary": "The system must not generate ready-to-submit thesis sections or article drafts. When a request indicates intent to submit AI content as original academic work, the system must decline.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "pre_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "standard", "reference": "Academic Integrity Framework / COPE Guidelines", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-002",
            "title": "Dual-Use Research of Concern (DURC) Flagging",
            "summary": "Research topics involving pathogen enhancement, gain-of-function, or weaponisable agents must trigger a DURC advisory that cannot be overridden by custom_system_prompt.",
            "domain": ["government", "education"],
            "jurisdiction": ["Global", "US", "EU"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "require_approval",
            "source": [{"type": "regulation", "reference": "US NSABB DURC Policy 2012 / WHO Biosafety Manual", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-003",
            "title": "Vulnerable Population Ethics Advisory",
            "summary": "Research topics involving minors, prisoners, pregnant women, or refugees must append an enhanced ethics review notice aligned with the Belmont Report.",
            "domain": ["healthcare", "education"],
            "jurisdiction": ["Global", "US", "EU"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "log",
            "source": [{"type": "regulation", "reference": "Belmont Report / ICH E6 GCP", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-004",
            "title": "Animal Research Ethics (IACUC) Alert",
            "summary": "Topics involving animal models or in-vivo studies must flag IACUC approval requirements and the 3Rs principles (Replacement, Reduction, Refinement).",
            "domain": ["healthcare", "education"],
            "jurisdiction": ["Global", "US", "EU"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "log",
            "source": [{"type": "standard", "reference": "ARRIVE Guidelines 2.0 / IACUC Policy", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-005",
            "title": "Human Subjects Research — IRB Requirement Notice",
            "summary": "Topics requiring primary data collection from human participants must flag IRB/REC approval and informed consent requirements per the Declaration of Helsinki.",
            "domain": ["healthcare", "education"],
            "jurisdiction": ["Global", "US", "EU"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "must",
            "action": "log",
            "source": [{"type": "regulation", "reference": "Declaration of Helsinki / Common Rule (45 CFR 46)", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-006",
            "title": "Research Misconduct Prevention",
            "summary": "The system must not assist with cherry-picking results, HARKing, p-hacking, or selective outcome reporting. Explicit requests to exclude negative results must be refused.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "pre_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "standard", "reference": "COPE Guidelines / Cochrane Handbook", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": "tg-eth-007",
            "title": "Conflicts of Interest Disclosure Reminder",
            "summary": "Research topics evaluating commercial products or pharmaceutical entities must prompt ICMJE-aligned COI declaration reminders for all authors.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "standard", "reference": "ICMJE Recommendations / PRISMA 2020", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "medium",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-eth-008",
            "title": "Indigenous Data Sovereignty (CARE Principles)",
            "summary": "Research topics involving indigenous communities or data must acknowledge the CARE Principles for Indigenous Data Governance and recommend early community partner engagement.",
            "domain": ["government", "education"],
            "jurisdiction": ["Global"],
            "intentType": "compliance",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "standard", "reference": "CARE Principles for Indigenous Data Governance (2020)", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": "tg-eth-009",
            "title": "Sensitive Topic Balanced Representation",
            "summary": "Topics addressing race, religion, gender, sexuality, or political ideology must be framed neutrally and represent multiple scholarly perspectives. Ideologically loaded framing is flagged at warn severity.",
            "domain": ["education"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "project",
            "enforcement": "post_check",
            "strength": "should",
            "action": "log",
            "source": [{"type": "standard", "reference": "IEEE 7000-2021 / APA Ethics Code Principle E", "url": None}],
            "inferenceModel": "rdr",
            "owner": "Research Ethics",
            "version": "1.0",
            "status": "active",
            "lastModified": tg_now,
            "riskLevel": "high",
            "trustWorthy": "case",
            "changeLog": [],
        },
    ]

    inserted = 0
    for rule in topic_generator_rules:
        rule.setdefault("tier", _infer_seed_rule_tier(rule))
        result = await _col().update_one({"id": rule["id"]}, {"$setOnInsert": rule}, upsert=True)
        if result.upserted_id:
            inserted += 1
    if inserted:
        print(f"[POLICY-MODULE] Upserted {inserted} new topic-generator knowledge rules")

    migrated = await migrate_missing_rule_tiers()
    if migrated:
        print(f"[POLICY-MODULE] Backfilled tier on {migrated} existing knowledge rules")


# ---- CRUD operations ----

async def list_rules(
    domains: List[str] = [],
    jurisdictions: List[str] = [],
    intent_types: List[str] = [],
    scopes: List[str] = [],
    enforcements: List[str] = [],
    strengths: List[str] = [],
    statuses: List[str] = [],
    inference_models: List[str] = [],
    trust_worthys: List[str] = [],
    tiers: List[str] = [],          # "external" | "internal" | "implicit"
    component_id: str = "",         # filter internal rules by owning component
    library_id: str = "",           # filter rules by policy library
    search: str = "",
    sort_by: str = "lastModified",
    limit: int = 200,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}

    if domains:
        query["domain"] = {"$in": domains}
    if jurisdictions:
        query["jurisdiction"] = {"$in": jurisdictions}
    if intent_types:
        query["intentType"] = {"$in": intent_types}
    if scopes:
        query["scope"] = {"$in": scopes}
    if enforcements:
        query["enforcement"] = {"$in": enforcements}
    if strengths:
        query["strength"] = {"$in": strengths}
    if statuses:
        query["status"] = {"$in": statuses}
    if inference_models:
        query["inferenceModel"] = {"$in": inference_models}
    if trust_worthys:
        query["trustWorthy"] = {"$in": trust_worthys}
    if tiers:
        query["tier"] = {"$in": tiers}
    if component_id:
        query["componentId"] = component_id
    if library_id:
        query["libraryId"] = library_id
    if search:
        # text search if index available, else regex fallback
        try:
            query["$text"] = {"$search": search}
        except Exception:
            query["title"] = {"$regex": search, "$options": "i"}

    safe_sort = sort_by if sort_by in {"lastModified", "title", "riskLevel"} else "lastModified"
    cursor = _col().find(query, {"_id": 0}).sort(safe_sort, -1).skip(offset).limit(limit)
    return await cursor.to_list(length=limit)


async def get_rule(rule_id: str) -> Optional[Dict[str, Any]]:
    return await _col().find_one({"id": rule_id}, {"_id": 0})


async def create_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
    await _col().insert_one({**rule})
    return await get_rule(rule["id"])  # re-fetch without _id


async def update_rule(rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates.pop("id", None)  # id is immutable
    await _col().update_one({"id": rule_id}, {"$set": updates})
    return await get_rule(rule_id)


async def delete_rule(rule_id: str) -> bool:
    result = await _col().delete_one({"id": rule_id})
    return result.deleted_count > 0


# ─────────────────────────────────────────────────────────────────────────────
# Policy Libraries — one library per uploaded document
# ─────────────────────────────────────────────────────────────────────────────

LIBRARY_COLLECTION = "policy_libraries"


def _lib_col():
    return get_module_db(POLICY_DB)[LIBRARY_COLLECTION]


async def ensure_library_indexes() -> None:
    col = _lib_col()
    await col.create_index("id", unique=True)
    await col.create_index("tier")
    await col.create_index("componentId")
    await col.create_index("status")


async def create_library(library: Dict[str, Any]) -> Dict[str, Any]:
    await _lib_col().insert_one({**library})
    return await get_library(library["id"])


async def get_library(library_id: str) -> Optional[Dict[str, Any]]:
    return await _lib_col().find_one({"id": library_id}, {"_id": 0})


async def list_libraries(
    tier: str = "",
    component_id: str = "",
    status: str = "",
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if tier:
        query["tier"] = tier
    if component_id:
        query["componentId"] = component_id
    if status:
        query["status"] = status
    cursor = _lib_col().find(query, {"_id": 0}).sort("createdAt", -1)
    return await cursor.to_list(length=500)


async def update_library(library_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates.pop("id", None)
    await _lib_col().update_one({"id": library_id}, {"$set": updates})
    return await get_library(library_id)


async def delete_library(library_id: str) -> int:
    """Delete library and all its rules. Returns count of deleted rules."""
    await _lib_col().delete_one({"id": library_id})
    result = await _col().delete_many({"libraryId": library_id})
    return result.deleted_count
