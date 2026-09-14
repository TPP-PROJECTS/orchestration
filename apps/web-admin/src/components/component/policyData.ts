export type PolicyRuleCategory = "content_input" | "content_output" | "system";

export type PolicyRuleSeverity = "block" | "warn" | "info";

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  category: PolicyRuleCategory;
  severity: PolicyRuleSeverity;
  content: string;
  enabled: boolean;
}

export interface PolicyDocument {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  created_at: number;
  updated_at: number;
  version: string;
}

export type PolicyRequirement = "essential" | "conditional" | "recommended";
export type PolicySeverityLevel = "critical" | "high" | "medium" | "low";
export type PolicyEnforcement = "block" | "warn" | "log";

export interface PolicyRuleV2 {
  id: string;
  name: string;
  description: string;
  content: string;
  requirement: PolicyRequirement;
  severity: PolicySeverityLevel;
  enforcement: PolicyEnforcement;
  source_document: string;
  source_section?: string;
  enabled: boolean;
  tags?: string[];
}

// ============ 新增配置 ============
export const REQUIREMENT_CONFIG = {
  essential: {
    label: "Essential",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  conditional: {
    label: "Conditional",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  recommended: {
    label: "Recommended",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
} as const;

export const SEVERITY_LEVEL_CONFIG = {
  critical: {
    label: "Critical",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  high: {
    label: "High",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  low: {
    label: "Low",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
} as const;

export const ENFORCEMENT_CONFIG = {
  block: {
    label: "Block",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  warn: {
    label: "Warn",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  log: {
    label: "Log",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
} as const;

// ============ 原有配置 ============
export const SEVERITY_STYLES = {
  block: {
    color: "text-red-500",
    bg: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  warn: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  info: {
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
};

export const CATEGORY_STYLES = {
  content_input: {
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  content_output: {
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  system: {
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
};

export function getCategoryLabel(category: PolicyRuleCategory): string {
  switch (category) {
    case "content_input":
      return "Content Input";
    case "content_output":
      return "Content Output";
    case "system":
      return "System";
    default:
      return category;
  }
}

// ============ 原有模拟数据 ============
export const mockPolicyDocuments: PolicyDocument[] = [
  {
    id: "doc1",
    name: "Content Safety Policy",
    description: "Main policy for content moderation",
    rules: [
      {
        id: "rule1",
        name: "Hate Speech Detection",
        description: "Detects and blocks hate speech in user inputs",
        category: "content_input",
        severity: "block",
        content:
          "Detect and filter out hate speech, slurs, and discriminatory language",
        enabled: true,
      },
      {
        id: "rule2",
        name: "PII Detection",
        description:
          "Identifies personally identifiable information in outputs",
        category: "content_output",
        severity: "block",
        content:
          "Scan for and redact personal information like SSNs, credit card numbers, etc.",
        enabled: true,
      },
      {
        id: "rule3",
        name: "Resource Limit Check",
        description: "Prevents system resource abuse",
        category: "system",
        severity: "warn",
        content:
          "Monitor API usage and limit requests if they exceed thresholds",
        enabled: true,
      },
    ],
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
    version: "1.2.0",
  },
  {
    id: "doc2",
    name: "Healthcare Compliance Policy",
    description:
      "Rules for handling healthcare data and ensuring HIPAA compliance",
    rules: [
      {
        id: "rule4",
        name: "Healthcare Data Validation",
        description: "Validates healthcare data inputs",
        category: "content_input",
        severity: "warn",
        content:
          "Check healthcare inputs for formatting issues and potential errors",
        enabled: true,
      },
      {
        id: "rule5",
        name: "PHI Detection",
        description: "Identifies Protected Health Information in outputs",
        category: "content_output",
        severity: "block",
        content: "Scan and redact protected health information from outputs",
        enabled: true,
      },
      {
        id: "rule6",
        name: "Audit Logging",
        description: "Maintains audit logs for compliance",
        category: "system",
        severity: "info",
        content:
          "Log all interactions with healthcare data for compliance audits",
        enabled: true,
      },
    ],
    created_at: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    version: "1.0.1",
  },
  {
    id: "doc3",
    name: "Security Policy",
    description: "Security measures for the application",
    rules: [
      {
        id: "rule7",
        name: "Malicious URL Detection",
        description: "Detects malicious URLs in user inputs",
        category: "content_input",
        severity: "block",
        content: "Scan for and block malicious URLs in user messages",
        enabled: true,
      },
      {
        id: "rule8",
        name: "XSS Prevention",
        description: "Prevents XSS attacks in outputs",
        category: "content_output",
        severity: "block",
        content: "Sanitize output content to prevent XSS vulnerabilities",
        enabled: true,
      },
      {
        id: "rule9",
        name: "Authentication Monitoring",
        description: "Monitors authentication attempts",
        category: "system",
        severity: "warn",
        content:
          "Track failed login attempts and lock accounts after multiple failures",
        enabled: true,
      },
    ],
    created_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 10 * 24 * 60 * 60 * 1000,
    version: "2.1.0",
  },
];

// ============ 新增模拟数据 ============
export const mockPolicyRulesV2: PolicyRuleV2[] = [
  {
    id: "pol-001",
    name: "Prohibited Content Generation",
    description: "Prevent generation of illegal, harmful, or dangerous content",
    content:
      "AI system must not generate content related to weapons, drugs, child exploitation, or terrorism",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "EU AI Act 2024",
    source_section: "Article 5",
    enabled: true,
    tags: ["safety", "content"],
  },
  {
    id: "pol-002",
    name: "Personal Data Protection",
    description: "Ensure protection of personally identifiable information",
    content:
      "AI system must not expose, store, or transmit PII without explicit consent and encryption",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "GDPR Article 22",
    source_section: "Article 22(1)",
    enabled: true,
    tags: ["privacy", "data"],
  },
  {
    id: "pol-003",
    name: "Medical Advice Disclaimer",
    description: "Require disclaimers for health-related information",
    content:
      "All medical-related outputs must include disclaimer that AI is not a substitute for professional medical advice",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "HIPAA Compliance",
    source_section: "Section 164.502",
    enabled: true,
    tags: ["healthcare", "disclaimer"],
  },
  {
    id: "pol-004",
    name: "Human Oversight Requirement",
    description: "Ensure human-in-the-loop for high-risk decisions",
    content:
      "High-risk AI decisions must be subject to human review before execution",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "EU AI Act 2024",
    source_section: "Article 14",
    enabled: true,
    tags: ["oversight", "hitl"],
  },
  {
    id: "pol-005",
    name: "Bias Detection and Mitigation",
    description: "Monitor and mitigate algorithmic bias",
    content:
      "AI system must implement bias detection mechanisms and log potential discriminatory outputs",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "NIST AI RMF 1.0",
    source_section: "MAP 1.5",
    enabled: true,
    tags: ["fairness", "bias"],
  },
  {
    id: "pol-006",
    name: "Transparency of AI Identity",
    description: "Users must be informed they are interacting with AI",
    content:
      "AI system must clearly identify itself as artificial intelligence when interacting with users",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "EU AI Act 2024",
    source_section: "Article 52",
    enabled: true,
    tags: ["transparency", "disclosure"],
  },
  {
    id: "pol-007",
    name: "Data Provenance Tracking",
    description: "Maintain audit trail of data sources and transformations",
    content:
      "All training data and inference inputs must be logged with provenance information",
    requirement: "essential",
    severity: "high",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 8.2",
    enabled: true,
    tags: ["audit", "provenance"],
  },
  {
    id: "pol-008",
    name: "Financial Advice Restrictions",
    description: "Restrict financial advice in regulated jurisdictions",
    content:
      "When user location is in regulated jurisdiction, financial advice must include regulatory disclaimers",
    requirement: "conditional",
    severity: "high",
    enforcement: "warn",
    source_document: "Internal Security Policy",
    source_section: "Section 4.2",
    enabled: true,
    tags: ["finance", "regulatory"],
  },
  {
    id: "pol-009",
    name: "Age-Appropriate Content",
    description: "Adjust content based on user age verification",
    content:
      "When user is identified as minor, content must be filtered for age-appropriateness",
    requirement: "conditional",
    severity: "high",
    enforcement: "block",
    source_document: "Internal Security Policy",
    source_section: "Section 3.1",
    enabled: true,
    tags: ["safety", "minors"],
  },
  {
    id: "pol-010",
    name: "Jurisdiction-Specific Compliance",
    description: "Apply regional compliance rules based on user location",
    content:
      "AI system must apply jurisdiction-specific rules when user location is detected",
    requirement: "conditional",
    severity: "high",
    enforcement: "warn",
    source_document: "GDPR Article 22",
    source_section: "Article 3",
    enabled: true,
    tags: ["compliance", "regional"],
  },
  {
    id: "pol-011",
    name: "Professional Context Adaptation",
    description: "Adjust responses based on professional context",
    content:
      "When interacting in professional/enterprise context, responses should maintain formal tone",
    requirement: "conditional",
    severity: "medium",
    enforcement: "log",
    source_document: "Internal Security Policy",
    source_section: "Section 5.1",
    enabled: true,
    tags: ["enterprise", "tone"],
  },
  {
    id: "pol-012",
    name: "Sensitive Topic Handling",
    description:
      "Special handling for politically or socially sensitive topics",
    content:
      "When discussing sensitive topics, AI must present balanced perspectives and avoid partisan positions",
    requirement: "conditional",
    severity: "medium",
    enforcement: "warn",
    source_document: "IEEE 7000-2021",
    source_section: "Clause 6.3",
    enabled: true,
    tags: ["ethics", "neutrality"],
  },
  {
    id: "pol-013",
    name: "Source Citation",
    description: "Provide citations for factual claims when possible",
    content:
      "AI should provide source citations for factual claims, especially for scientific information",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "NIST AI RMF 1.0",
    source_section: "GOVERN 1.2",
    enabled: true,
    tags: ["accuracy", "citation"],
  },
  {
    id: "pol-014",
    name: "Uncertainty Communication",
    description: "Communicate confidence levels for uncertain responses",
    content:
      "AI should indicate uncertainty when providing speculative or less certain information",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "NIST AI RMF 1.0",
    source_section: "MAP 2.3",
    enabled: true,
    tags: ["transparency", "confidence"],
  },
  {
    id: "pol-015",
    name: "Feedback Collection",
    description: "Enable user feedback mechanisms",
    content:
      "AI system should provide mechanisms for users to report issues or provide feedback",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 9.1",
    enabled: true,
    tags: ["improvement", "feedback"],
  },
  {
    id: "pol-016",
    name: "Response Length Optimization",
    description: "Optimize response length based on query complexity",
    content: "AI should adjust response length to match query complexity",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "Internal Security Policy",
    source_section: "Section 6.2",
    enabled: false,
    tags: ["ux", "efficiency"],
  },
  {
    id: "pol-017",
    name: "Multilingual Support Notice",
    description: "Inform users about language limitations",
    content:
      "When responding in non-primary languages, AI should note potential accuracy limitations",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "IEEE 7000-2021",
    source_section: "Clause 7.1",
    enabled: false,
    tags: ["i18n", "accuracy"],
  },
  {
    id: "pol-018",
    name: "Performance Monitoring",
    description: "Track response quality metrics",
    content:
      "AI system should log performance metrics for continuous improvement",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 9.2",
    enabled: true,
    tags: ["monitoring", "metrics"],
  },

  // ============ Topic Generator — Input Policies ============
  {
    id: "tg-in-001",
    name: "Research Domain Scope Validation",
    description:
      "Reject inputs where the research domain is not a recognisable academic or scientific field",
    content:
      "The 'domain' field submitted to /topics/generate-profile must identify a legitimate academic or scientific discipline. Domains such as entertainment, marketing, or unrelated commercial activities must be rejected with a request to clarify the research context.",
    requirement: "essential",
    severity: "high",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 2.1 — Input Domain Validation",
    enabled: true,
    tags: ["input", "topic-generator", "domain-validation", "academic"],
  },
  {
    id: "tg-in-002",
    name: "Custom Prompt Override Injection Guard",
    description:
      "Detect and block prompt-injection attempts in the custom_system_prompt field",
    content:
      "When a caller supplies a custom_system_prompt, the value must be scanned for jailbreak indicators: phrases such as 'ignore previous instructions', 'disregard your guidelines', 'you are now', 'act as', or base64-encoded blobs. Requests containing these patterns must be blocked and logged to the orchestration audit trail.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 2.3 — Prompt Override Security",
    enabled: true,
    tags: ["input", "topic-generator", "prompt-injection", "security"],
  },
  {
    id: "tg-in-003",
    name: "Topic Generation Count Cap",
    description: "Limit the maximum number of topics that can be requested in a single call",
    content:
      "The 'count' parameter in /topics/generate must not exceed 20. Requests with count > 20 must be rejected with HTTP 400. This prevents runaway API usage and ensures response quality remains high.",
    requirement: "essential",
    severity: "medium",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 2.5 — Request Limits",
    enabled: true,
    tags: ["input", "topic-generator", "rate-limit", "api"],
  },
  {
    id: "tg-in-004",
    name: "Search Query Content Safety",
    description:
      "Validate that search queries submitted to /search are academic in nature and free of malicious content",
    content:
      "The 'query' field sent to /search must not contain HTML tags, script fragments, SQL keywords used as operators (e.g. DROP, SELECT *), or content unrelated to academic literature. Queries that appear designed to abuse external APIs (OpenAlex, PubMed) must be blocked.",
    requirement: "essential",
    severity: "high",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 2.6 — Search Safety",
    enabled: true,
    tags: ["input", "topic-generator", "search", "xss", "injection"],
  },
  {
    id: "tg-in-005",
    name: "Query Generation Batch Size Limit",
    description: "Cap the number of topics submitted to /queries/generate in one request",
    content:
      "The 'topics' array in /queries/generate must not exceed 10 items. Larger batches cause disproportionate model token usage and risk generating low-quality Boolean queries. Requests exceeding this limit must be rejected with HTTP 400.",
    requirement: "essential",
    severity: "medium",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 2.8 — Batch Limits",
    enabled: true,
    tags: ["input", "topic-generator", "batch", "queries", "api"],
  },

  // ============ Topic Generator — Output Policies ============
  {
    id: "tg-out-001",
    name: "No Fabricated Citations in AI Output",
    description:
      "AI-generated reasoning, synthesis, and gap analysis must not contain invented paper titles, author names, or DOIs presented as real sources",
    content:
      "Outputs from /topics/reason, /synthesis, and /gaps must not include specific bibliographic references (author names + year + title combinations) unless those references were extracted verbatim from user-supplied abstracts. The model must be instructed to avoid hallucinating citations. Any output flagged as containing a citation not traceable to input data must be blocked or redacted.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.1 — Citation Integrity",
    enabled: true,
    tags: ["output", "topic-generator", "hallucination", "citation", "integrity"],
  },
  {
    id: "tg-out-002",
    name: "Boolean Search Query Format Compliance",
    description:
      "Generated search queries must be syntactically valid Boolean queries suitable for academic databases",
    content:
      "Output from /queries/generate must contain at least one Boolean operator (AND, OR, NOT), use parentheses for grouping where needed, and enclose multi-word phrases in double quotes. Queries that are plain keyword lists without any Boolean structure must trigger a warn-level flag and a suggestion to improve the query.",
    requirement: "essential",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.2 — Query Format",
    enabled: true,
    tags: ["output", "topic-generator", "search-query", "boolean", "format"],
  },
  {
    id: "tg-out-003",
    name: "Confidence Score Honesty",
    description:
      "Topic confidence levels must accurately reflect profile completeness and not default to 'high' across all outputs",
    content:
      "When the researcher profile has fewer than 3 filled fields (domain, population, focus, method, reviewType), the AI must not assign 'high' confidence to all generated topics. At least one topic should reflect 'medium' or 'low' confidence to signal the impact of incomplete profile data. Outputs where all topics are uniformly 'high' confidence despite sparse input must be flagged.",
    requirement: "essential",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.3 — Confidence Calibration",
    enabled: true,
    tags: ["output", "topic-generator", "confidence", "honesty", "calibration"],
  },
  {
    id: "tg-out-004",
    name: "Academic Tone Enforcement",
    description:
      "All AI-generated content must use formal academic language appropriate for a postgraduate research context",
    content:
      "Outputs from all topic-generator endpoints must avoid colloquialisms, first-person casual language ('I think', 'basically', 'kind of'), emojis, and marketing-style superlatives ('revolutionary', 'game-changing'). Outputs violating this standard should be flagged for tone at warn severity.",
    requirement: "essential",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.4 — Academic Register",
    enabled: true,
    tags: ["output", "topic-generator", "tone", "academic", "language"],
  },
  {
    id: "tg-out-005",
    name: "Healthcare Domain Disclaimer Requirement",
    description:
      "Outputs in healthcare or clinical domains must include a non-clinical-advice disclaimer",
    content:
      "When the researcher profile domain contains 'health', 'medical', 'clinical', 'nursing', 'pharmacy', or 'surgery', AI outputs from /topics/generate-profile, /topics/reason, and /synthesis must append a disclaimer: 'This AI-generated content is for research scoping purposes only and does not constitute clinical, diagnostic, or treatment advice.' Outputs in these domains without such a disclaimer must be blocked.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.5 — Healthcare Safety",
    enabled: true,
    tags: ["output", "topic-generator", "healthcare", "disclaimer", "safety"],
  },
  {
    id: "tg-out-006",
    name: "AI Synthesis Output Disclaimer",
    description:
      "Synthesis outputs must clearly state they are AI-generated and require researcher verification",
    content:
      "Every response from /synthesis must include the statement: 'This synthesis is AI-generated from the provided abstracts and should be independently verified before inclusion in a systematic review.' This disclaimer must appear at the start or end of the synthesis text and must not be overridden by a custom_system_prompt.",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.6 — AI Output Transparency",
    enabled: true,
    tags: ["output", "topic-generator", "synthesis", "disclaimer", "transparency"],
  },
  {
    id: "tg-out-007",
    name: "Gap Analysis Hedged Novelty Claims",
    description:
      "Gap analysis outputs must not assert absolute novelty; claims must be appropriately hedged",
    content:
      "Outputs from /gaps must not use absolute phrasing such as 'no research has ever examined', 'entirely unexplored', or 'completely absent from the literature'. Acceptable phrasing includes 'limited evidence exists', 'few studies have addressed', or 'the current literature lacks sufficient coverage of'. Absolute novelty claims must be downgraded to warn and reformulated.",
    requirement: "essential",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.7 — Gap Analysis Accuracy",
    enabled: true,
    tags: ["output", "topic-generator", "gaps", "novelty", "hedging"],
  },
  {
    id: "tg-out-008",
    name: "Matrix Cell Source Transparency",
    description:
      "Autofill matrix cells must accurately distinguish between directly extracted and AI-inferred data",
    content:
      "The 'extractionMethod' field in /matrix autofill responses must be set to 'direct_quote' only when the value is verbatim or closely paraphrased from the supplied abstract. When the value is inferred, estimated, or not found in the abstract, the field must be set to 'inferred'. Misclassifying inferred data as direct_quote is a block-level violation.",
    requirement: "essential",
    severity: "high",
    enforcement: "block",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.8 — Evidence Transparency",
    enabled: true,
    tags: ["output", "topic-generator", "matrix", "extraction", "transparency"],
  },
  {
    id: "tg-out-009",
    name: "Research Question Specificity Standard",
    description:
      "Final research questions must be specific and answerable by a systematic literature review",
    content:
      "Output from /final_question must produce a research question that includes at minimum: a defined population or context, a specific intervention or exposure or phenomenon, and a measurable outcome or comparison. Questions such as 'How does AI affect healthcare?' or 'What is the impact of X?' without population and outcome specificity must be flagged at warn severity with a reformulation suggestion.",
    requirement: "essential",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.9 — Research Question Quality",
    enabled: true,
    tags: ["output", "topic-generator", "research-question", "pico", "specificity"],
  },
  {
    id: "tg-out-010",
    name: "Tag Academic Validity",
    description:
      "Generated topic tags must be valid academic keywords, preferably aligned with MeSH or established discipline thesauri",
    content:
      "Tags generated for research topics must be recognisable academic or MeSH-aligned terms. Tags that are generic non-academic words (e.g. 'stuff', 'things', 'various'), invented compound jargon, or promotional language must be flagged at warn severity. Outputs where more than 50% of tags are not recognisable academic terms must be regenerated.",
    requirement: "recommended",
    severity: "medium",
    enforcement: "warn",
    source_document: "Topic Generator Policy v1.0",
    source_section: "Section 3.10 — Keyword Quality",
    enabled: true,
    tags: ["output", "topic-generator", "tags", "mesh", "keywords", "academic"],
  },

  // ============ Topic Generator — Research Ethics Policies ============
  {
    id: "tg-eth-001",
    name: "Research Integrity — No Plagiarism Facilitation",
    description:
      "The system must not generate content designed to be submitted as original academic work without attribution",
    content:
      "Topic-generator outputs must not be structured as ready-to-submit thesis sections, journal article drafts, or assignment answers. When a user request pattern suggests the intent is to submit AI-generated text as their own work (e.g. 'write my literature review introduction'), the system must decline and redirect to scoping/planning assistance only.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "Academic Integrity Framework",
    source_section: "Section 1 — Authorship and Attribution",
    enabled: true,
    tags: ["ethics", "topic-generator", "academic-integrity", "plagiarism"],
  },
  {
    id: "tg-eth-002",
    name: "Dual-Use Research of Concern (DURC) Flagging",
    description:
      "Research topics in biosecurity, synthetic biology, or pathogen enhancement must trigger an ethics advisory",
    content:
      "When a generated research topic involves gain-of-function research, pathogen enhancement, weaponisable biological or chemical agents, or dual-use life science research, the output must include a DURC advisory: 'This research area may fall under Dual-Use Research of Concern (DURC) guidelines. Consult your institution's biosafety committee and applicable national regulations before proceeding.' This advisory must not be suppressible by custom_system_prompt.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "US NSABB DURC Policy 2012 / WHO Biosafety Manual",
    source_section: "DURC Category Definition",
    enabled: true,
    tags: ["ethics", "topic-generator", "durc", "biosafety", "dual-use"],
  },
  {
    id: "tg-eth-003",
    name: "Vulnerable Population Ethics Advisory",
    description:
      "Research topics involving children, prisoners, pregnant women, or other vulnerable groups must flag ethics review requirements",
    content:
      "When the 'population' field or topic description identifies minors (under 18), prisoners, people with cognitive impairment, pregnant women, or refugees as the study population, the system must append: 'Research involving this population typically requires enhanced ethics review. Ensure your protocol addresses additional safeguards for vulnerable participants as per your institution's IRB/ethics board requirements.'",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "Belmont Report / ICH E6 GCP",
    source_section: "Special Populations Protection",
    enabled: true,
    tags: ["ethics", "topic-generator", "vulnerable-populations", "irb", "safeguards"],
  },
  {
    id: "tg-eth-004",
    name: "Animal Research Ethics (IACUC) Alert",
    description:
      "Topics involving animal subjects must flag the requirement for ethics committee approval",
    content:
      "When a research topic involves animal models, in-vivo studies, or preclinical animal experiments, the output must include: 'Animal research requires approval from your institution's Institutional Animal Care and Use Committee (IACUC) or equivalent ethics body. Ensure your protocol addresses the 3Rs principles: Replacement, Reduction, and Refinement.'",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "ARRIVE Guidelines 2.0 / IACUC Policy",
    source_section: "3Rs Framework",
    enabled: true,
    tags: ["ethics", "topic-generator", "animal-research", "iacuc", "3rs"],
  },
  {
    id: "tg-eth-005",
    name: "Human Subjects Research — IRB Requirement Notice",
    description:
      "Topics requiring primary data collection from human participants must flag IRB/ethics board approval",
    content:
      "When the 'method' field includes qualitative interviews, surveys, RCTs, observational cohort studies, or any primary data collection involving human participants, the system must note: 'Research involving human participants requires prior approval from your Institutional Review Board (IRB) or Research Ethics Committee (REC). Ensure informed consent procedures are in place.'",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "Declaration of Helsinki / Common Rule (45 CFR 46)",
    source_section: "Informed Consent and Ethics Review",
    enabled: true,
    tags: ["ethics", "topic-generator", "human-subjects", "irb", "consent"],
  },
  {
    id: "tg-eth-006",
    name: "Research Misconduct Prevention",
    description:
      "The system must not assist with selective reporting, p-hacking, HARKing, or outcome switching",
    content:
      "Topic-generator must not generate search queries or synthesis guidance that is explicitly designed to cherry-pick results, post-hoc rationalise hypotheses (HARKing), or support selective outcome reporting. When a request explicitly asks to 'find only studies that support X' or 'exclude studies showing negative results', the system must refuse and explain the need for pre-registered, unbiased systematic review methodology.",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "COPE Guidelines / Cochrane Handbook",
    source_section: "Reporting Bias and Research Integrity",
    enabled: true,
    tags: ["ethics", "topic-generator", "misconduct", "p-hacking", "reporting-bias"],
  },
  {
    id: "tg-eth-007",
    name: "Conflicts of Interest Disclosure Reminder",
    description:
      "Research topics involving commercial products, funders, or industry partnerships must prompt COI disclosure",
    content:
      "When a research topic involves evaluating a commercial product, pharmaceutical, medical device, or is scoped in a way that could benefit a named commercial entity, the output must include: 'Systematic reviews in this area may require explicit conflict of interest (COI) declarations. Ensure all authors disclose funding sources and relationships with relevant industry stakeholders per ICMJE guidelines.'",
    requirement: "conditional",
    severity: "medium",
    enforcement: "warn",
    source_document: "ICMJE Recommendations / PRISMA 2020",
    source_section: "Conflicts of Interest Disclosure",
    enabled: true,
    tags: ["ethics", "topic-generator", "coi", "disclosure", "industry"],
  },
  {
    id: "tg-eth-008",
    name: "Indigenous Data Sovereignty (CARE Principles)",
    description:
      "Research topics involving indigenous communities or data must acknowledge data sovereignty requirements",
    content:
      "When a research topic or population field references indigenous peoples, First Nations, Aboriginal, or Native communities, the output must append: 'Research involving indigenous communities or data should adhere to the CARE Principles for Indigenous Data Governance (Collective Benefit, Authority to Control, Responsibility, Ethics) and engage community partners early in the research design process.'",
    requirement: "conditional",
    severity: "high",
    enforcement: "warn",
    source_document: "CARE Principles for Indigenous Data Governance (2020)",
    source_section: "Indigenous Data Sovereignty Framework",
    enabled: true,
    tags: ["ethics", "topic-generator", "indigenous", "care-principles", "data-sovereignty"],
  },
  {
    id: "tg-eth-009",
    name: "Sensitive Topic Balanced Representation",
    description:
      "Topics involving race, religion, gender, sexuality, or political ideology must be handled with balanced, non-partisan framing",
    content:
      "When generated research topics or reasoning outputs address race, ethnicity, religion, gender identity, sexual orientation, or political ideology, the system must frame content neutrally, represent multiple scholarly perspectives, and avoid language that could be construed as advocating for one position. Outputs that contain ideologically loaded framing must be flagged at warn severity.",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "IEEE 7000-2021 / APA Ethics Code",
    source_section: "Principle E: Respect for People's Rights and Dignity",
    enabled: true,
    tags: ["ethics", "topic-generator", "sensitive-topics", "neutrality", "bias"],
  },
];
