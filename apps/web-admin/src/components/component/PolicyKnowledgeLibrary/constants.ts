// Policy Knowledge Library constants - icon map, colour helpers, default filter options,
// mock rule data, and typed knowledge-base asset fixtures (RDR, KG, neural-network).
import type { ElementType } from "react";
import {
  FileText,
  Shield,
  Building2,
  Cpu,
  Scale,
  Truck,
  Lock,
  Database,
  Settings,
  AlertCircle,
  Globe,
  Users,
  Sparkles,
} from "lucide-react";

import type { FilterOptions, Rule, Action, RiskLevel } from "./types";

// ============ Icon Map ============
export const ICON_MAP: Record<string, ElementType> = {
  Shield,
  Building2,
  Cpu,
  FileText,
  Scale,
  Truck,
  Lock,
  Database,
  Settings,
  AlertCircle,
  Globe,
  Users,
  Sparkles,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

// ============ Helper Functions ============
export const getIconComponent = (iconName?: string): ElementType => {
  if (!iconName) return FileText;
  return ICON_MAP[iconName] || FileText;
};

export const getRiskColor = (risk: RiskLevel) => {
  switch (risk) {
    case "critical":
      return "text-red-600 bg-red-50 border-red-200";
    case "high":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "medium":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "low":
      return "text-green-600 bg-green-50 border-green-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
};

export const getActionColor = (action: Action) => {
  switch (action) {
    case "deny":
      return "text-red-700 bg-red-100";
    case "allow":
      return "text-green-700 bg-green-100";
    case "require_approval":
      return "text-amber-700 bg-amber-100";
    case "log":
      return "text-blue-700 bg-blue-100";
    case "redact":
      return "text-purple-700 bg-purple-100";
    default:
      return "text-gray-700 bg-gray-100";
  }
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ============ Default Filter Options ============
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  domains: [
    { value: "healthcare", label: "Healthcare", icon: "Shield" },
    { value: "finance", label: "Finance", icon: "Building2" },
    { value: "it", label: "IT", icon: "Cpu" },
    { value: "education", label: "Education", icon: "FileText" },
    { value: "government", label: "Government", icon: "Scale" },
    { value: "retail", label: "Retail", icon: "Truck" },
  ],
  jurisdictions: [
    { value: "au", label: "Australia" },
    { value: "eu", label: "European Union" },
    { value: "us", label: "United States" },
    { value: "cn", label: "China" },
    { value: "uk", label: "United Kingdom" },
  ],
  intentTypes: [
    { value: "access_control", label: "Access Control", icon: "Lock" },
    { value: "data_handling", label: "Data Handling", icon: "Database" },
    { value: "model_ai_use", label: "Model/AI Use", icon: "Cpu" },
    { value: "safety_content", label: "Safety & Content", icon: "Shield" },
    { value: "compliance", label: "Compliance", icon: "Scale" },
    { value: "operational", label: "Operational Controls", icon: "Settings" },
    { value: "procurement", label: "Procurement/Vendor", icon: "Truck" },
    { value: "incident", label: "Incident & Exception", icon: "AlertCircle" },
  ],
  scopes: [
    { value: "global", label: "Global" },
    { value: "product", label: "Product" },
    { value: "org", label: "Organization" },
    { value: "team", label: "Team" },
    { value: "project", label: "Project" },
    { value: "tenant", label: "Tenant" },
    { value: "user", label: "User" },
    { value: "session", label: "Session" },
    { value: "request", label: "Request" },
    { value: "resource", label: "Resource" },
  ],
  enforcements: [
    {
      value: "pre_check",
      label: "Pre-check",
      description: "Pre-execution block/allow",
    },
    {
      value: "in_flight",
      label: "In-flight",
      description: "In-process dynamic constraints",
    },
    {
      value: "post_check",
      label: "Post-check",
      description: "Post-event audit/alerts",
    },
    {
      value: "advisory",
      label: "Advisory",
      description: "Advisory only no enforcement",
    },
  ],
  strengths: [
    { value: "must", label: "MUST", color: "bg-red-500" },
    { value: "must_not", label: "MUST NOT", color: "bg-red-600" },
    { value: "should", label: "SHOULD", color: "bg-amber-500" },
    { value: "should_not", label: "SHOULD NOT", color: "bg-amber-600" },
    { value: "may", label: "MAY", color: "bg-blue-500" },
  ],
  statuses: [
    { value: "draft", label: "Draft", color: "bg-gray-500" },
    { value: "active", label: "Active", color: "bg-green-500" },
    { value: "deprecated", label: "Deprecated", color: "bg-red-500" },
  ],
  inferenceModels: [
    {
      value: "rdr",
      label: "RDR",
      icon: "Database",
      description: "Ripple Down Rules",
    },
    {
      value: "knowledge_graph",
      label: "Knowledge Graph",
      icon: "Globe",
      description: "Graph-based reasoning",
    },
    {
      value: "neural_network",
      label: "Neural Network",
      icon: "Cpu",
      description: "Deep learning models",
    },
    {
      value: "general_llm",
      label: "General LLM",
      icon: "Sparkles",
      description: "Extracted and evaluated by a general-purpose LLM",
    },
  ],
  trustWorthys: [
    { value: "explain", label: "Explain", color: "bg-blue-500" },
    {
      value: "interpretation",
      label: "Interpretation",
      color: "bg-purple-500",
    },
    { value: "case", label: "Case", color: "bg-amber-500" },
    { value: "other", label: "Other", color: "bg-gray-500" },
  ],
};

// ============ Mock Rules ============
export const MOCK_RULES: Rule[] = [
  {
    id: "RS-DATA-PRIVACY-001",
    title: "PII Data Export Restriction",
    summary:
      "Personally identifiable information must not be exported outside approved jurisdictions without explicit approval",
    domain: ["healthcare", "finance"],
    jurisdiction: ["au", "eu"],
    intentType: "data_handling",
    scope: "global",
    enforcement: "pre_check",
    strength: "must_not",
    action: "deny",
    source: [
      { type: "regulation", reference: "GDPR Article 44-49" },
      { type: "regulation", reference: "Australian Privacy Act 1988" },
      { type: "internal", reference: "Data Governance Policy v2.3" },
    ],
    inferenceModel: "rdr",
    owner: "Data Protection Officer",
    version: "2.1.0",
    status: "active",
    lastModified: "2024-12-01T09:00:00Z",
    riskLevel: "critical",
    trustWorthy: "explain",
    changeLog: [
      {
        date: "2024-12-01",
        user: "john.doe@company.com",
        action: "Updated",
        details: "Added Australian Privacy Act reference",
      },
      {
        date: "2024-10-15",
        user: "jane.smith@company.com",
        action: "Created",
        details: "Initial rule creation",
      },
    ],
  },
  {
    id: "RS-CLINICAL-AI-001",
    title: "AI Model Selection for Medical Diagnosis",
    summary:
      "Only FDA/TGA approved AI models may be used for medical diagnosis assistance",
    domain: ["healthcare"],
    jurisdiction: ["au", "us"],
    intentType: "model_ai_use",
    scope: "product",
    enforcement: "pre_check",
    strength: "must",
    action: "deny",
    source: [
      { type: "regulation", reference: "FDA 21 CFR Part 820" },
      { type: "standard", reference: "TGA Medical Device Standards" },
    ],
    inferenceModel: "knowledge_graph",
    owner: "Clinical AI Team",
    version: "1.0.0",
    status: "active",
    lastModified: "2024-11-20T14:00:00Z",
    riskLevel: "critical",
    trustWorthy: "case",
    changeLog: [],
  },
  {
    id: "RS-RISK-MGMT-001",
    title: "Human Review for High-Risk Decisions",
    summary:
      "AI-generated decisions with high impact must receive human review before execution",
    domain: ["healthcare", "finance", "government"],
    jurisdiction: ["au", "eu", "us"],
    intentType: "operational",
    scope: "org",
    enforcement: "in_flight",
    strength: "must",
    action: "require_approval",
    source: [
      { type: "regulation", reference: "EU AI Act Article 14" },
      { type: "internal", reference: "Risk Management Framework v3.0" },
    ],
    inferenceModel: "neural_network",
    owner: "Risk Management",
    version: "1.2.0",
    status: "active",
    lastModified: "2024-12-15T10:00:00Z",
    riskLevel: "high",
    trustWorthy: "interpretation",
    changeLog: [],
  },
  {
    id: "RS-PLATFORM-001",
    title: "Rate Limiting for API Calls",
    summary: "External API calls must be rate limited to prevent abuse",
    domain: ["it"],
    jurisdiction: ["au", "eu", "us", "cn"],
    intentType: "operational",
    scope: "tenant",
    enforcement: "pre_check",
    strength: "should",
    action: "deny",
    source: [{ type: "internal", reference: "API Security Guidelines v1.5" }],
    inferenceModel: "rdr",
    owner: "Platform Engineering",
    version: "1.0.0",
    status: "active",
    lastModified: "2024-09-01T08:00:00Z",
    riskLevel: "medium",
    trustWorthy: "other",
    changeLog: [],
  },
  {
    id: "RS-TRUST-SAFETY-001",
    title: "Sensitive Content Detection",
    summary:
      "Content flagged as potentially harmful should be reviewed before distribution",
    domain: ["it", "education"],
    jurisdiction: ["au", "eu", "us"],
    intentType: "safety_content",
    scope: "request",
    enforcement: "in_flight",
    strength: "should",
    action: "require_approval",
    source: [{ type: "internal", reference: "Content Moderation Policy v2.0" }],
    inferenceModel: "neural_network",
    owner: "Trust & Safety",
    version: "2.0.0",
    status: "active",
    lastModified: "2024-11-01T12:00:00Z",
    riskLevel: "high",
    trustWorthy: "explain",
    changeLog: [],
  },
  {
    id: "RS-VENDOR-001",
    title: "Vendor Data Processing Agreement",
    summary:
      "Third-party vendors must have signed DPA before processing customer data",
    domain: ["it", "finance"],
    jurisdiction: ["eu"],
    intentType: "procurement",
    scope: "org",
    enforcement: "pre_check",
    strength: "must",
    action: "deny",
    source: [{ type: "regulation", reference: "GDPR Article 28" }],
    inferenceModel: "knowledge_graph",
    owner: "Legal",
    version: "1.0.0",
    status: "active",
    lastModified: "2024-08-15T09:00:00Z",
    riskLevel: "high",
    trustWorthy: "case",
    changeLog: [],
  },
  {
    id: "RS-COMPLIANCE-001",
    title: "Audit Log Retention",
    summary: "Audit logs must be retained for minimum 7 years",
    domain: ["healthcare", "finance", "government"],
    jurisdiction: ["au", "us"],
    intentType: "compliance",
    scope: "global",
    enforcement: "post_check",
    strength: "must",
    action: "log",
    source: [
      { type: "regulation", reference: "SOX Section 802" },
      { type: "standard", reference: "ISO 27001 A.12.4" },
    ],
    inferenceModel: "rdr",
    owner: "Compliance",
    version: "1.1.0",
    status: "active",
    lastModified: "2024-07-01T10:00:00Z",
    riskLevel: "medium",
    trustWorthy: "interpretation",
    changeLog: [],
  },
  {
    id: "RS-INCIDENT-001",
    title: "Emergency Access Override",
    summary:
      "Emergency access may bypass normal controls with post-hoc review required",
    domain: ["healthcare"],
    jurisdiction: ["au", "us", "eu"],
    intentType: "incident",
    scope: "session",
    enforcement: "advisory",
    strength: "may",
    action: "allow",
    source: [
      { type: "internal", reference: "Emergency Access Procedure v1.0" },
    ],
    inferenceModel: "knowledge_graph",
    owner: "Security",
    version: "1.0.0",
    status: "draft",
    lastModified: "2024-12-01T16:00:00Z",
    riskLevel: "critical",
    trustWorthy: "other",
    changeLog: [],
  },
  // ===== AU Psychology / Clinical rules (append) =====
  {
    id: "RS-AU-PSY-PRIVACY-001",
    title: "Psychology Notes: Privacy & Minimum Necessary Use",
    summary:
      "Clinical psychology notes and client health information must be collected/used/disclosed only as necessary; restrict access and avoid unnecessary sharing/export.",
    domain: ["healthcare"],
    jurisdiction: ["au"],
    intentType: "data_handling",
    scope: "org",
    enforcement: "pre_check",
    strength: "must",
    action: "redact",
    source: [
      {
        type: "regulation",
        reference:
          "Privacy Act 1988 (Cth) + Australian Privacy Principles (APPs)",
      },
      { type: "internal", reference: "Clinical Record Handling SOP v1.0" },
    ],
    inferenceModel: "rdr",
    owner: "Clinical Governance",
    version: "1.0.0",
    status: "active",
    lastModified: "2026-02-11T00:00:00Z",
    riskLevel: "high",
    trustWorthy: "explain",
    changeLog: [],
  },
  {
    id: "RS-AU-PSY-MANDATORY-NOTIF-001",
    title: "Mandatory Notification Workflow (AHPRA/National Law)",
    summary:
      "Where mandatory notification obligations may be triggered, the system must route the case to a registered clinician/supervisor and log the rationale and evidence trail.",
    domain: ["healthcare", "government"],
    jurisdiction: ["au"],
    intentType: "incident",
    scope: "org",
    enforcement: "in_flight",
    strength: "must",
    action: "require_approval",
    source: [
      {
        type: "regulation",
        reference:
          "National Law (AHPRA) – Mandatory notifications (mandatory reporting)",
      },
      { type: "internal", reference: "Mandatory Notification Playbook v1.2" },
    ],
    inferenceModel: "knowledge_graph",
    owner: "Clinical Director",
    version: "1.0.0",
    status: "active",
    lastModified: "2026-02-11T00:00:00Z",
    riskLevel: "critical",
    trustWorthy: "interpretation",
    changeLog: [],
  },
  {
    id: "RS-AU-PSY-TELEHEALTH-001",
    title: "Telehealth Delivery: Consent, Identity, and Environment Checks",
    summary:
      "Before telehealth psychology sessions, confirm client identity, location (for emergency response), consent, and privacy environment; otherwise pause and escalate to clinician guidance.",
    domain: ["healthcare"],
    jurisdiction: ["au"],
    intentType: "operational",
    scope: "session",
    enforcement: "pre_check",
    strength: "should",
    action: "require_approval",
    source: [
      {
        type: "standard",
        reference:
          "APS Telehealth considerations (Better Access / service delivery guidance)",
      },
      { type: "internal", reference: "Telehealth Session Checklist v2.0" },
    ],
    inferenceModel: "neural_network",
    owner: "Service Delivery Lead",
    version: "1.0.0",
    status: "active",
    lastModified: "2026-02-11T00:00:00Z",
    riskLevel: "high",
    trustWorthy: "explain",
    changeLog: [],
  },
  {
    id: "RS-AU-PSY-MHR-001",
    title: "My Health Record Access Controls",
    summary:
      "If the service participates in My Health Record, access must be role-based and logged; any export must follow participation obligations and security controls.",
    domain: ["healthcare"],
    jurisdiction: ["au"],
    intentType: "access_control",
    scope: "org",
    enforcement: "post_check",
    strength: "must",
    action: "log",
    source: [
      {
        type: "standard",
        reference: "My Health Record participation obligations (ADHA)",
      },
      { type: "internal", reference: "MHR Access & Audit Policy v1.0" },
    ],
    inferenceModel: "rdr",
    owner: "Security & Privacy",
    version: "1.0.0",
    status: "draft",
    lastModified: "2026-02-11T00:00:00Z",
    riskLevel: "high",
    trustWorthy: "other",
    changeLog: [],
  },
  {
    id: "RS-AU-PSY-NDIS-001",
    title: "NDIS Code of Conduct Compliance",
    summary:
      "When providing NDIS-funded supports, interactions must meet NDIS Code of Conduct and safeguarding requirements; suspicious events must be escalated and recorded.",
    domain: ["healthcare", "government"],
    jurisdiction: ["au"],
    intentType: "compliance",
    scope: "org",
    enforcement: "in_flight",
    strength: "must",
    action: "require_approval",
    source: [
      {
        type: "regulation",
        reference:
          "NDIS Code of Conduct (NDIS Quality & Safeguards Commission)",
      },
      { type: "internal", reference: "NDIS Service Governance SOP v1.0" },
    ],
    inferenceModel: "knowledge_graph",
    owner: "NDIS Practice Lead",
    version: "1.0.0",
    status: "active",
    lastModified: "2026-02-11T00:00:00Z",
    riskLevel: "high",
    trustWorthy: "case",
    changeLog: [],
  },
];

// ============ Knowledge Asset Types ============
export type KnowledgeAssetType = "rdr" | "knowledge_graph" | "neural_network";

export type EvidenceRef = {
  type: "regulation" | "standard" | "internal";
  reference: string;
  url?: string;
  excerpt?: string;
  locator?: string;
};

export type Provenance = {
  assetId: string;
  name: string;
  type: KnowledgeAssetType;
  version: string;
  owner: string;
  lastTrainedAt: string;
  dataset?: {
    name: string;
    version: string;
    timeRange?: { from: string; to: string };
    size?: number;
    notes?: string;
  };
  build?: {
    pipelineId: string;
    gitCommit?: string;
    environment?: "dev" | "staging" | "prod";
  };
};

export type CommonEval = {
  coverage?: number;
  accuracy?: number;
  f1?: number;
  auroc?: number;
  calibrationEce?: number;
  latencyMsP50?: number;
  latencyMsP95?: number;
};

export type KnowledgeAssetBase = {
  id: string;
  type: KnowledgeAssetType;
  title: string;
  summary: string;
  tags: string[];
  riskLevel: "critical" | "high" | "medium" | "low";
  evidence: EvidenceRef[];
  provenance: Provenance;
  eval: CommonEval;
};

export type RdrNode = {
  nodeId: string;
  label: string;
  condition?: {
    field: string;
    op: "eq" | "neq" | "in" | "not_in" | "contains" | "gte" | "lte";
    value: unknown;
  };
  conclusion?: {
    action: "allow" | "deny" | "require_approval" | "log" | "redact";
    reason: string;
  };
  stats: {
    supportCount: number;
    exceptionCount: number;
    precision?: number;
    lastUpdated: string;
    updatedBy: string;
  };
  evidenceRefs: string[];
  children?: RdrNode[];
};

export type RdrAsset = KnowledgeAssetBase & {
  type: "rdr";
  kbId: string;
  tree: {
    rootId: string;
    nodes: RdrNode;
  };
  sampleInference: {
    input: Record<string, any>;
    matchedPath: string[];
    finalDecision: { action: string; reason: string };
    explanation: string[];
  };
};

export type KgNode = {
  id: string;
  kind: "Concept" | "Rule" | "Guideline" | "Entity" | "Case";
  label: string;
  tags?: string[];
  properties?: Record<string, any>;
};

export type KgEdge = {
  id: string;
  from: string;
  to: string;
  predicate:
    | "supports"
    | "requires"
    | "prohibits"
    | "derived_from"
    | "maps_to"
    | "contradicts";
  weight?: number;
  evidenceRefs?: string[];
};

export type KgAsset = KnowledgeAssetBase & {
  type: "knowledge_graph";
  kbId: string;
  graph: {
    nodes: KgNode[];
    edges: KgEdge[];
  };
  sampleInference: {
    query: string;
    returnedSubgraph: { nodeIds: string[]; edgeIds: string[] };
    topPaths: Array<{
      path: string[];
      score: number;
      naturalLanguage: string;
      evidenceRefs: string[];
    }>;
  };
};

export type ConfusionMatrix = {
  labels: string[];
  matrix: number[][];
};

export type FeatureAttribution = {
  feature: string;
  contribution: number;
};

export type NeuralNetAsset = KnowledgeAssetBase & {
  type: "neural_network";
  kbId: string;
  model: {
    architecture: string;
    inputSchema: string[];
    outputLabels: string[];
    paramsM: number;
  };
  training: {
    epochs: number;
    bestEpoch: number;
    loss: { train: number[]; val: number[] };
    metricsByEpoch: { epoch: number; valF1: number; valAuroc: number }[];
  };
  evaluationArtifacts: {
    confusionMatrix: ConfusionMatrix;
    sliceMetrics: Array<{
      sliceName: string;
      count: number;
      f1: number;
      auroc: number;
    }>;
  };
  sampleInference: {
    input: Record<string, any>;
    output: { label: string; probability: number }[];
    explanation: {
      method: "shap" | "integrated_gradients" | "attention";
      topContributors: FeatureAttribution[];
      naturalLanguage: string[];
    };
  };
};

export type AnyAsset = RdrAsset | KgAsset | NeuralNetAsset;

const KB_RDR = "RS-DATA-PRIVACY-001";
const KB_KG = "RS-CLINICAL-AI-001";
const KB_NN = "RS-RISK-MGMT-001";

export const KB_RDR_ASSETS: RdrAsset[] = [
  {
    id: "ASSET-RDR-PII-EXPORT-01",
    kbId: KB_RDR,
    type: "rdr",
    title: "PII export decision tree (v2.1)",
    summary:
      "Blocks PII export outside AU/EU; routes to approval when token missing.",
    tags: ["data_handling", "pii", "export", "pre_check"],
    riskLevel: "critical",
    evidence: [
      {
        type: "regulation",
        reference: "GDPR Article 44-49",
        locator: "Chapter V",
        excerpt: "Cross-border transfers require safeguards.",
      },
      {
        type: "regulation",
        reference: "Australian Privacy Act 1988",
        locator: "APP 8",
        excerpt: "Overseas disclosure needs reasonable steps.",
      },
      {
        type: "internal",
        reference: "Data Governance Policy v2.3",
        locator: "Section 3.2",
        excerpt: "PII export blocked unless explicit approval exists.",
      },
    ],
    provenance: {
      assetId: "ASSET-RDR-PII-EXPORT-01",
      name: "PII Export Decision Tree",
      type: "rdr",
      version: "2.1.0",
      owner: "Data Protection Officer",
      lastTrainedAt: "2024-12-01T09:00:00Z",
      dataset: {
        name: "ExportRequests-Audit",
        version: "2024.11",
        size: 18240,
      },
      build: {
        pipelineId: "pipe_rdr_8812",
        gitCommit: "a1b2c3d4",
        environment: "staging",
      },
    },
    eval: {
      coverage: 0.94,
      accuracy: 0.97,
      f1: 0.93,
      latencyMsP50: 4,
      latencyMsP95: 12,
    },
    tree: {
      rootId: "n0",
      nodes: {
        nodeId: "n0",
        label: "Root",
        stats: {
          supportCount: 18240,
          exceptionCount: 0,
          precision: 1,
          lastUpdated: "2024-12-01",
          updatedBy: "jane.smith@company.com",
        },
        evidenceRefs: [],
        children: [
          {
            nodeId: "n1",
            label: "Contains PII?",
            condition: { field: "containsPII", op: "eq", value: true },
            stats: {
              supportCount: 6240,
              exceptionCount: 18,
              precision: 0.98,
              lastUpdated: "2024-12-01",
              updatedBy: "john.doe@company.com",
            },
            evidenceRefs: [
              "GDPR Article 44-49",
              "Australian Privacy Act 1988",
              "Data Governance Policy v2.3",
            ],
            children: [
              {
                nodeId: "n2",
                label: "Destination ∈ {au, eu}?",
                condition: {
                  field: "destJurisdiction",
                  op: "in",
                  value: ["au", "eu"],
                },
                stats: {
                  supportCount: 3120,
                  exceptionCount: 7,
                  precision: 0.96,
                  lastUpdated: "2024-12-01",
                  updatedBy: "john.doe@company.com",
                },
                evidenceRefs: ["Data Governance Policy v2.3"],
                children: [
                  {
                    nodeId: "n3",
                    label: "Has explicit approval token?",
                    condition: {
                      field: "hasExplicitApproval",
                      op: "eq",
                      value: true,
                    },
                    stats: {
                      supportCount: 980,
                      exceptionCount: 2,
                      precision: 0.99,
                      lastUpdated: "2024-12-01",
                      updatedBy: "john.doe@company.com",
                    },
                    evidenceRefs: ["Data Governance Policy v2.3"],
                    children: [
                      {
                        nodeId: "n3a",
                        label: "ALLOW export",
                        conclusion: {
                          action: "allow",
                          reason:
                            "PII export within AU/EU with explicit approval token.",
                        },
                        stats: {
                          supportCount: 980,
                          exceptionCount: 0,
                          precision: 0.995,
                          lastUpdated: "2024-12-01",
                          updatedBy: "john.doe@company.com",
                        },
                        evidenceRefs: ["Data Governance Policy v2.3"],
                      },
                    ],
                  },
                  {
                    nodeId: "n4",
                    label: "No token → REQUIRE APPROVAL",
                    conclusion: {
                      action: "require_approval",
                      reason:
                        "PII export requires explicit approval even within AU/EU.",
                    },
                    stats: {
                      supportCount: 2140,
                      exceptionCount: 0,
                      precision: 0.94,
                      lastUpdated: "2024-12-01",
                      updatedBy: "john.doe@company.com",
                    },
                    evidenceRefs: ["Data Governance Policy v2.3"],
                  },
                ],
              },
              {
                nodeId: "n5",
                label: "Outside approved → DENY",
                conclusion: {
                  action: "deny",
                  reason:
                    "PII export outside AU/EU prohibited without lawful transfer mechanism.",
                },
                stats: {
                  supportCount: 3120,
                  exceptionCount: 0,
                  precision: 0.98,
                  lastUpdated: "2024-12-01",
                  updatedBy: "jane.smith@company.com",
                },
                evidenceRefs: [
                  "GDPR Article 44-49",
                  "Australian Privacy Act 1988",
                ],
              },
            ],
          },
        ],
      },
    },
    sampleInference: {
      input: {
        requestId: "req_001",
        containsPII: true,
        destJurisdiction: "us",
        hasExplicitApproval: false,
      },
      matchedPath: ["n0", "n1", "n5"],
      finalDecision: {
        action: "deny",
        reason:
          "PII export outside AU/EU prohibited without lawful transfer mechanism.",
      },
      explanation: [
        "containsPII = true → PII branch",
        "destJurisdiction = us not in [au, eu] → deny branch",
        "Evidence: GDPR Article 44-49, Australian Privacy Act 1988",
      ],
    },
  },

  {
    id: "ASSET-RDR-TRANSFER-MECH-02",
    kbId: KB_RDR,
    type: "rdr",
    title: "Cross-border transfer mechanism checker (v1.3)",
    summary:
      "Allows export only if SCC/BCR/adequacy decision recorded; otherwise deny or route to approval.",
    tags: ["data_handling", "transfer", "gdpr", "pre_check"],
    riskLevel: "high",
    evidence: [
      {
        type: "regulation",
        reference: "GDPR Article 46",
        locator: "Art 46",
        excerpt: "Appropriate safeguards (e.g., SCC) for transfers.",
      },
      {
        type: "internal",
        reference: "Transfer Mechanism Register v1.2",
        locator: "Appendix A",
        excerpt: "Approved mechanisms list and owner attestations.",
      },
    ],
    provenance: {
      assetId: "ASSET-RDR-TRANSFER-MECH-02",
      name: "Transfer Mechanism Checker",
      type: "rdr",
      version: "1.3.0",
      owner: "Legal Ops",
      lastTrainedAt: "2024-11-12T08:00:00Z",
      dataset: { name: "Transfers-Register", version: "2024.10", size: 4200 },
      build: {
        pipelineId: "pipe_rdr_7710",
        gitCommit: "d4c3b2a1",
        environment: "prod",
      },
    },
    eval: {
      coverage: 0.81,
      accuracy: 0.93,
      f1: 0.86,
      latencyMsP50: 6,
      latencyMsP95: 14,
    },
    tree: {
      rootId: "t0",
      nodes: {
        nodeId: "t0",
        label: "Root",
        stats: {
          supportCount: 4200,
          exceptionCount: 0,
          precision: 1,
          lastUpdated: "2024-11-12",
          updatedBy: "legal.ops@company.com",
        },
        evidenceRefs: [],
        children: [
          {
            nodeId: "t1",
            label: "Is destination non-adequate?",
            condition: { field: "adequacy", op: "eq", value: false },
            stats: {
              supportCount: 2500,
              exceptionCount: 12,
              precision: 0.95,
              lastUpdated: "2024-11-12",
              updatedBy: "legal.ops@company.com",
            },
            evidenceRefs: ["GDPR Article 46"],
            children: [
              {
                nodeId: "t2",
                label: "Has SCC/BCR?",
                condition: {
                  field: "mechanism",
                  op: "in",
                  value: ["scc", "bcr"],
                },
                stats: {
                  supportCount: 980,
                  exceptionCount: 5,
                  precision: 0.92,
                  lastUpdated: "2024-11-12",
                  updatedBy: "legal.ops@company.com",
                },
                evidenceRefs: ["Transfer Mechanism Register v1.2"],
                children: [
                  {
                    nodeId: "t2a",
                    label: "ALLOW export",
                    conclusion: {
                      action: "allow",
                      reason: "Transfer mechanism recorded (SCC/BCR).",
                    },
                    stats: {
                      supportCount: 980,
                      exceptionCount: 0,
                      precision: 0.93,
                      lastUpdated: "2024-11-12",
                      updatedBy: "legal.ops@company.com",
                    },
                    evidenceRefs: ["Transfer Mechanism Register v1.2"],
                  },
                ],
              },
              {
                nodeId: "t3",
                label: "No mechanism → DENY",
                conclusion: {
                  action: "deny",
                  reason: "No lawful transfer mechanism recorded.",
                },
                stats: {
                  supportCount: 1520,
                  exceptionCount: 0,
                  precision: 0.96,
                  lastUpdated: "2024-11-12",
                  updatedBy: "legal.ops@company.com",
                },
                evidenceRefs: ["GDPR Article 46"],
              },
            ],
          },
        ],
      },
    },
    sampleInference: {
      input: { adequacy: false, mechanism: "none", destJurisdiction: "us" },
      matchedPath: ["t0", "t1", "t3"],
      finalDecision: {
        action: "deny",
        reason: "No lawful transfer mechanism recorded.",
      },
      explanation: [
        "adequacy = false → non-adequate route",
        "mechanism = none → deny",
        "Evidence: GDPR Article 46",
      ],
    },
  },
];

/** ---------- KG KB: multiple assets ---------- */
export const KB_KG_ASSETS: KgAsset[] = [
  {
    id: "ASSET-KG-MODEL-APPROVAL-01",
    kbId: KB_KG,
    type: "knowledge_graph",
    title: "Clinical model approval graph (AU/US)",
    summary:
      "Captures which diagnostic AI models are permitted and what evidence supports approval requirements.",
    tags: ["model_ai_use", "healthcare", "approval"],
    riskLevel: "critical",
    evidence: [
      {
        type: "regulation",
        reference: "FDA 21 CFR Part 820",
        locator: "QSR",
        excerpt: "Quality system requirements for medical devices.",
      },
      {
        type: "standard",
        reference: "TGA Medical Device Standards",
        locator: "Conformity",
        excerpt: "Medical device compliance in Australia.",
      },
      {
        type: "internal",
        reference: "Clinical AI Model Registry v1.4",
        locator: "Approved Models",
        excerpt: "Internal approved models and use cases.",
      },
    ],
    provenance: {
      assetId: "ASSET-KG-MODEL-APPROVAL-01",
      name: "Clinical Model Approval KG",
      type: "knowledge_graph",
      version: "1.0.0",
      owner: "Clinical AI Team",
      lastTrainedAt: "2024-11-20T14:00:00Z",
      dataset: {
        name: "ClinicalModelRegistry+RegExtracts",
        version: "2024.11",
        size: 420,
      },
      build: {
        pipelineId: "pipe_kg_2201",
        gitCommit: "ff12aa90",
        environment: "prod",
      },
    },
    eval: {
      coverage: 0.88,
      accuracy: 0.92,
      latencyMsP50: 18,
      latencyMsP95: 55,
    },
    graph: {
      nodes: [
        { id: "c0", kind: "Concept", label: "Medical diagnosis assistance" },
        { id: "c1", kind: "Concept", label: "Approval required" },
        {
          id: "g0",
          kind: "Guideline",
          label: "FDA 21 CFR Part 820",
          tags: ["us"],
        },
        {
          id: "g1",
          kind: "Guideline",
          label: "TGA Medical Device Standards",
          tags: ["au"],
        },
        {
          id: "r0",
          kind: "Rule",
          label: "Only approved models may be used",
          properties: { scope: "product", enforcement: "pre_check" },
        },
        {
          id: "e1",
          kind: "Entity",
          label: "Model: VisionDx Lite",
          properties: { approvedAU: false, approvedUS: true },
        },
        {
          id: "case0",
          kind: "Case",
          label: "Request: Use VisionDx Lite in AU",
          properties: { jurisdiction: "au" },
        },
      ],
      edges: [
        {
          id: "e01",
          from: "r0",
          to: "c1",
          predicate: "requires",
          weight: 0.9,
          evidenceRefs: ["Clinical AI Model Registry v1.4"],
        },
        {
          id: "e02",
          from: "r0",
          to: "g1",
          predicate: "derived_from",
          weight: 0.8,
          evidenceRefs: ["TGA Medical Device Standards"],
        },
        {
          id: "e03",
          from: "case0",
          to: "e1",
          predicate: "requires",
          weight: 1.0,
        },
        {
          id: "e04",
          from: "g1",
          to: "c1",
          predicate: "supports",
          weight: 0.85,
          evidenceRefs: ["TGA Medical Device Standards"],
        },
      ],
    },
    sampleInference: {
      query: "Can VisionDx Lite be used in Australia for diagnosis assistance?",
      returnedSubgraph: {
        nodeIds: ["case0", "e1", "r0", "c1", "g1"],
        edgeIds: ["e03", "e01", "e02", "e04"],
      },
      topPaths: [
        {
          path: ["case0", "e1", "r0", "c1", "g1"],
          score: 0.86,
          naturalLanguage:
            "AU request → model used for diagnosis → rule requires approval → supported by TGA standard.",
          evidenceRefs: [
            "Clinical AI Model Registry v1.4",
            "TGA Medical Device Standards",
          ],
        },
      ],
    },
  },

  {
    id: "ASSET-KG-USECASE-SCOPE-02",
    kbId: KB_KG,
    type: "knowledge_graph",
    title: "Permitted use-case scope graph (triage vs diagnosis)",
    summary:
      "Distinguishes triage support from diagnosis assistance; maps models to permitted scope under AU policy.",
    tags: ["scope", "triage", "governance"],
    riskLevel: "high",
    evidence: [
      {
        type: "internal",
        reference: "Clinical AI Use Policy v2.0",
        locator: "Section 2",
        excerpt: "Triage vs diagnosis boundaries and permitted workflows.",
      },
      {
        type: "internal",
        reference: "Model Registry v1.4",
        locator: "Use-cases",
        excerpt: "Approved uses per model.",
      },
    ],
    provenance: {
      assetId: "ASSET-KG-USECASE-SCOPE-02",
      name: "Use-case Scope KG",
      type: "knowledge_graph",
      version: "0.9.0",
      owner: "Clinical Governance",
      lastTrainedAt: "2024-10-30T10:00:00Z",
      dataset: { name: "Policies+Registry", version: "2024.10", size: 260 },
      build: {
        pipelineId: "pipe_kg_1980",
        gitCommit: "11aa22bb",
        environment: "staging",
      },
    },
    eval: {
      coverage: 0.72,
      accuracy: 0.89,
      latencyMsP50: 22,
      latencyMsP95: 70,
    },
    graph: {
      nodes: [
        { id: "u0", kind: "Concept", label: "Triage support" },
        { id: "u1", kind: "Concept", label: "Diagnosis assistance" },
        {
          id: "p0",
          kind: "Guideline",
          label: "Clinical AI Use Policy v2.0",
          tags: ["au"],
        },
        {
          id: "m0",
          kind: "Entity",
          label: "Model: VisionDx Lite",
          properties: { permittedAU: ["triage"] },
        },
        {
          id: "r0",
          kind: "Rule",
          label: "Use-case must match permitted scope",
          properties: { enforcement: "pre_check" },
        },
      ],
      edges: [
        {
          id: "x1",
          from: "r0",
          to: "p0",
          predicate: "derived_from",
          weight: 0.8,
          evidenceRefs: ["Clinical AI Use Policy v2.0"],
        },
        {
          id: "x2",
          from: "m0",
          to: "u0",
          predicate: "maps_to",
          weight: 0.7,
          evidenceRefs: ["Model Registry v1.4"],
        },
        {
          id: "x3",
          from: "p0",
          to: "u1",
          predicate: "supports",
          weight: 0.6,
          evidenceRefs: ["Clinical AI Use Policy v2.0"],
        },
      ],
    },
    sampleInference: {
      query: "Is VisionDx Lite permitted for diagnosis in AU?",
      returnedSubgraph: {
        nodeIds: ["m0", "u0", "u1", "r0", "p0"],
        edgeIds: ["x1", "x2", "x3"],
      },
      topPaths: [
        {
          path: ["m0", "u0", "r0", "p0"],
          score: 0.78,
          naturalLanguage:
            "Model permittedAU maps to triage only → rule checks scope against policy → diagnosis use not permitted.",
          evidenceRefs: ["Clinical AI Use Policy v2.0", "Model Registry v1.4"],
        },
      ],
    },
  },
];

/** ---------- NN KB: multiple assets ---------- */
export const KB_NN_ASSETS: NeuralNetAsset[] = [
  {
    id: "ASSET-NN-HIGH-RISK-DECISION-01",
    kbId: KB_NN,
    type: "neural_network",
    title: "High-impact decision risk classifier",
    summary:
      "Flags high-impact decisions that must be routed to human review in-flight.",
    tags: ["operational", "routing", "risk"],
    riskLevel: "high",
    evidence: [
      {
        type: "regulation",
        reference: "EU AI Act Article 14",
        locator: "Art 14",
        excerpt: "Human oversight requirements for high-risk systems.",
      },
      {
        type: "internal",
        reference: "Risk Management Framework v3.0",
        locator: "Section 5",
        excerpt: "High-impact decisions require human review before execution.",
      },
    ],
    provenance: {
      assetId: "ASSET-NN-HIGH-RISK-DECISION-01",
      name: "High-impact Risk Classifier",
      type: "neural_network",
      version: "1.2.0",
      owner: "Risk Management",
      lastTrainedAt: "2024-12-15T10:00:00Z",
      dataset: {
        name: "DecisionLogs-Labeled",
        version: "2024.12",
        size: 98000,
      },
      build: {
        pipelineId: "pipe_nn_4550",
        gitCommit: "aa33bb44",
        environment: "prod",
      },
    },
    eval: {
      accuracy: 0.9,
      f1: 0.87,
      auroc: 0.93,
      calibrationEce: 0.06,
      latencyMsP50: 40,
      latencyMsP95: 120,
    },
    model: {
      architecture: "Transformer + Metadata head",
      inputSchema: ["decisionText", "domain", "jurisdiction", "impactTier"],
      outputLabels: ["low_risk", "needs_review"],
      paramsM: 48,
    },
    training: {
      epochs: 6,
      bestEpoch: 5,
      loss: {
        train: [0.62, 0.49, 0.41, 0.36, 0.33, 0.32],
        val: [0.6, 0.5, 0.43, 0.4, 0.37, 0.38],
      },
      metricsByEpoch: [
        { epoch: 1, valF1: 0.78, valAuroc: 0.9 },
        { epoch: 2, valF1: 0.82, valAuroc: 0.91 },
        { epoch: 3, valF1: 0.84, valAuroc: 0.92 },
        { epoch: 4, valF1: 0.86, valAuroc: 0.925 },
        { epoch: 5, valF1: 0.87, valAuroc: 0.93 },
        { epoch: 6, valF1: 0.868, valAuroc: 0.929 },
      ],
    },
    evaluationArtifacts: {
      confusionMatrix: {
        labels: ["low_risk", "needs_review"],
        matrix: [
          [38000, 2200],
          [3100, 54000],
        ],
      },
      sliceMetrics: [
        { sliceName: "Healthcare", count: 28000, f1: 0.88, auroc: 0.94 },
        { sliceName: "Finance", count: 22000, f1: 0.86, auroc: 0.92 },
      ],
    },
    sampleInference: {
      input: {
        decisionText: "Deny loan application based on model score",
        domain: "finance",
        jurisdiction: "eu",
        impactTier: "high",
      },
      output: [
        { label: "needs_review", probability: 0.81 },
        { label: "low_risk", probability: 0.19 },
      ],
      explanation: {
        method: "shap",
        topContributors: [
          { feature: "impactTier=high", contribution: 0.42 },
          { feature: "deny/withhold", contribution: 0.2 },
          { feature: "individual outcome", contribution: 0.16 },
        ],
        naturalLanguage: [
          "High-impact tier strongly increases the need for human review.",
          "Withholding a benefit (deny) raises potential harm likelihood.",
        ],
      },
    },
  },

  {
    id: "ASSET-NN-DRIFT-WATCH-02",
    kbId: KB_NN,
    type: "neural_network",
    title: "Decision drift monitor (post-check)",
    summary:
      "Detects distribution shift in decisions to trigger post-hoc audit alerts.",
    tags: ["drift", "monitoring", "post_check"],
    riskLevel: "medium",
    evidence: [
      {
        type: "internal",
        reference: "Model Monitoring SOP v1.1",
        locator: "Section 3",
        excerpt: "Alert when drift exceeds thresholds; escalate for audit.",
      },
    ],
    provenance: {
      assetId: "ASSET-NN-DRIFT-WATCH-02",
      name: "Drift Watch",
      type: "neural_network",
      version: "0.8.0",
      owner: "MLOps",
      lastTrainedAt: "2024-11-28T03:00:00Z",
      dataset: { name: "DecisionTelemetry", version: "2024.11", size: 310000 },
      build: {
        pipelineId: "pipe_nn_3008",
        gitCommit: "cc55dd66",
        environment: "staging",
      },
    },
    eval: {
      accuracy: 0.88,
      f1: 0.8,
      auroc: 0.9,
      calibrationEce: 0.08,
      latencyMsP50: 28,
      latencyMsP95: 85,
    },
    model: {
      architecture: "Autoencoder + Threshold",
      inputSchema: ["embedding", "domain", "jurisdiction"],
      outputLabels: ["stable", "drift"],
      paramsM: 12,
    },
    training: {
      epochs: 10,
      bestEpoch: 8,
      loss: {
        train: [0.9, 0.74, 0.62, 0.54, 0.49, 0.45, 0.42, 0.4, 0.41, 0.42],
        val: [0.92, 0.77, 0.65, 0.58, 0.52, 0.48, 0.46, 0.44, 0.45, 0.46],
      },
      metricsByEpoch: [
        { epoch: 1, valF1: 0.62, valAuroc: 0.82 },
        { epoch: 4, valF1: 0.74, valAuroc: 0.87 },
        { epoch: 8, valF1: 0.8, valAuroc: 0.9 },
      ],
    },
    evaluationArtifacts: {
      confusionMatrix: {
        labels: ["stable", "drift"],
        matrix: [
          [120000, 5000],
          [6200, 18000],
        ],
      },
      sliceMetrics: [{ sliceName: "EU", count: 52000, f1: 0.81, auroc: 0.91 }],
    },
    sampleInference: {
      input: { domain: "healthcare", jurisdiction: "au", embedding: "…" },
      output: [
        { label: "stable", probability: 0.72 },
        { label: "drift", probability: 0.28 },
      ],
      explanation: {
        method: "attention",
        topContributors: [
          { feature: "embedding_shift", contribution: 0.31 },
          { feature: "jurisdiction=au", contribution: 0.05 },
        ],
        naturalLanguage: [
          "No significant drift detected; continue monitoring.",
          "If drift rises, trigger audit alert workflow.",
        ],
      },
    },
  },
];

// ===== Psychology AU KBs (simulated 3 KBs: RDR/KG/NN) =====
const KB_PSY_RDR = "RS-AU-PSY-PRIVACY-001";
const KB_PSY_KG = "RS-AU-PSY-MANDATORY-NOTIF-001";
const KB_PSY_NN = "RS-AU-PSY-TELEHEALTH-001";

// --- RDR asset (privacy/minimum necessary) ---
export const KB_PSY_RDR_ASSETS: RdrAsset[] = [
  {
    id: "ASSET-RDR-PSY-NOTES-REDACT-01",
    kbId: KB_PSY_RDR,
    type: "rdr",
    title: "Psychology notes redaction & sharing gate (v1.0)",
    summary:
      "Redacts highly sensitive note fields by default; blocks external share unless explicit approval & purpose is documented.",
    tags: ["healthcare", "data_handling", "notes", "redact", "pre_check"],
    riskLevel: "high",
    evidence: [
      {
        type: "regulation",
        reference: "Privacy Act 1988 (Cth) + APPs",
        locator: "APP 3/6/11",
        excerpt: "Collect/use/disclose only as needed; protect information.",
      },
      {
        type: "internal",
        reference: "Clinical Record Handling SOP v1.0",
        locator: "Section 4",
        excerpt:
          "Default redact & restrict sharing; require documented purpose.",
      },
    ],
    provenance: {
      assetId: "ASSET-RDR-PSY-NOTES-REDACT-01",
      name: "Psych Notes Gate",
      type: "rdr",
      version: "1.0.0",
      owner: "Clinical Governance",
      lastTrainedAt: "2026-02-11T00:00:00Z",
      dataset: {
        name: "NoteSharing-Decisions",
        version: "2026.02",
        size: 5400,
      },
      build: {
        pipelineId: "pipe_rdr_psy_0101",
        gitCommit: "psy001",
        environment: "staging",
      },
    },
    eval: {
      coverage: 0.9,
      accuracy: 0.95,
      f1: 0.9,
      latencyMsP50: 5,
      latencyMsP95: 15,
    },
    tree: {
      rootId: "p0",
      nodes: {
        nodeId: "p0",
        label: "Root",
        stats: {
          supportCount: 5400,
          exceptionCount: 0,
          precision: 1,
          lastUpdated: "2026-02-11",
          updatedBy: "clinical.gov@org",
        },
        evidenceRefs: [],
        children: [
          {
            nodeId: "p1",
            label: "Request involves psychology notes?",
            condition: { field: "dataType", op: "eq", value: "psych_notes" },
            stats: {
              supportCount: 2100,
              exceptionCount: 12,
              precision: 0.96,
              lastUpdated: "2026-02-11",
              updatedBy: "clinical.gov@org",
            },
            evidenceRefs: [
              "Privacy Act 1988 (Cth) + APPs",
              "Clinical Record Handling SOP v1.0",
            ],
            children: [
              {
                nodeId: "p2",
                label: "Is external sharing requested?",
                condition: {
                  field: "shareTarget",
                  op: "neq",
                  value: "internal",
                },
                stats: {
                  supportCount: 680,
                  exceptionCount: 8,
                  precision: 0.93,
                  lastUpdated: "2026-02-11",
                  updatedBy: "privacy@org",
                },
                evidenceRefs: ["Privacy Act 1988 (Cth) + APPs"],
                children: [
                  {
                    nodeId: "p3",
                    label: "Has documented purpose + approval?",
                    condition: { field: "hasApproval", op: "eq", value: true },
                    stats: {
                      supportCount: 220,
                      exceptionCount: 2,
                      precision: 0.95,
                      lastUpdated: "2026-02-11",
                      updatedBy: "privacy@org",
                    },
                    evidenceRefs: ["Clinical Record Handling SOP v1.0"],
                    children: [
                      {
                        nodeId: "p3a",
                        label: "REDACT & ALLOW share",
                        conclusion: {
                          action: "redact",
                          reason:
                            "External share permitted only with approval; sensitive fields redacted by default.",
                        },
                        stats: {
                          supportCount: 220,
                          exceptionCount: 0,
                          precision: 0.96,
                          lastUpdated: "2026-02-11",
                          updatedBy: "privacy@org",
                        },
                        evidenceRefs: ["Privacy Act 1988 (Cth) + APPs"],
                      },
                    ],
                  },
                  {
                    nodeId: "p4",
                    label: "No approval → DENY",
                    conclusion: {
                      action: "deny",
                      reason:
                        "External sharing of psychology notes requires documented purpose and approval.",
                    },
                    stats: {
                      supportCount: 460,
                      exceptionCount: 0,
                      precision: 0.94,
                      lastUpdated: "2026-02-11",
                      updatedBy: "privacy@org",
                    },
                    evidenceRefs: ["Privacy Act 1988 (Cth) + APPs"],
                  },
                ],
              },
              {
                nodeId: "p5",
                label: "Internal use → REDACT",
                conclusion: {
                  action: "redact",
                  reason:
                    "Minimum necessary: show only required fields for internal workflow.",
                },
                stats: {
                  supportCount: 1420,
                  exceptionCount: 0,
                  precision: 0.96,
                  lastUpdated: "2026-02-11",
                  updatedBy: "clinical.gov@org",
                },
                evidenceRefs: ["Clinical Record Handling SOP v1.0"],
              },
            ],
          },
        ],
      },
    },
    sampleInference: {
      input: {
        requestId: "req_psy_001",
        dataType: "psych_notes",
        shareTarget: "external",
        hasApproval: false,
      },
      matchedPath: ["p0", "p1", "p2", "p4"],
      finalDecision: {
        action: "deny",
        reason:
          "External sharing of psychology notes requires documented purpose and approval.",
      },
      explanation: [
        "dataType = psych_notes → apply psychology note handling",
        "shareTarget != internal → external sharing route",
        "hasApproval = false → deny",
        "Evidence: Privacy Act 1988 (Cth) + APPs",
      ],
    },
  },
];

// --- KG asset (mandatory notification workflow) ---
export const KB_PSY_KG_ASSETS: KgAsset[] = [
  {
    id: "ASSET-KG-PSY-MANDATORY-NOTIF-01",
    kbId: KB_PSY_KG,
    type: "knowledge_graph",
    title: "Mandatory notification decision graph (AU)",
    summary:
      "Maps potential triggers → required escalation steps → logging requirements for clinician review.",
    tags: ["au", "incident", "governance", "mandatory_notification"],
    riskLevel: "critical",
    evidence: [
      {
        type: "regulation",
        reference: "National Law (AHPRA) – Mandatory notifications",
        locator: "Guidance",
        excerpt: "Certain circumstances require notification to the regulator.",
      },
      {
        type: "internal",
        reference: "Mandatory Notification Playbook v1.2",
        locator: "Section 2-4",
        excerpt:
          "Escalate to registered clinician; record rationale and actions.",
      },
    ],
    provenance: {
      assetId: "ASSET-KG-PSY-MANDATORY-NOTIF-01",
      name: "Mandatory Notification KG",
      type: "knowledge_graph",
      version: "1.0.0",
      owner: "Clinical Director",
      lastTrainedAt: "2026-02-11T00:00:00Z",
      dataset: {
        name: "PolicyExtracts+CasePatterns",
        version: "2026.02",
        size: 180,
      },
      build: {
        pipelineId: "pipe_kg_psy_0201",
        gitCommit: "psykg01",
        environment: "prod",
      },
    },
    eval: { coverage: 0.7, accuracy: 0.9, latencyMsP50: 20, latencyMsP95: 60 },
    graph: {
      nodes: [
        { id: "c0", kind: "Concept", label: "Potential notification trigger" },
        {
          id: "c1",
          kind: "Concept",
          label: "Escalate to registered clinician",
        },
        {
          id: "c2",
          kind: "Concept",
          label: "Record rationale & evidence trail",
        },
        {
          id: "g0",
          kind: "Guideline",
          label: "AHPRA mandatory notifications guidance",
          tags: ["au"],
        },
        {
          id: "r0",
          kind: "Rule",
          label: "Route to clinician + log",
          properties: { enforcement: "in_flight" },
        },
        {
          id: "case0",
          kind: "Case",
          label: "Case: potential notifiable conduct",
          properties: { jurisdiction: "au" },
        },
      ],
      edges: [
        {
          id: "e1",
          from: "r0",
          to: "g0",
          predicate: "derived_from",
          weight: 0.8,
          evidenceRefs: ["National Law (AHPRA) – Mandatory notifications"],
        },
        {
          id: "e2",
          from: "case0",
          to: "c0",
          predicate: "maps_to",
          weight: 0.7,
        },
        {
          id: "e3",
          from: "r0",
          to: "c1",
          predicate: "requires",
          weight: 0.9,
          evidenceRefs: ["Mandatory Notification Playbook v1.2"],
        },
        {
          id: "e4",
          from: "r0",
          to: "c2",
          predicate: "requires",
          weight: 0.85,
          evidenceRefs: ["Mandatory Notification Playbook v1.2"],
        },
        {
          id: "e5",
          from: "g0",
          to: "c1",
          predicate: "supports",
          weight: 0.75,
          evidenceRefs: ["National Law (AHPRA) – Mandatory notifications"],
        },
      ],
    },
    sampleInference: {
      query:
        "A case may trigger mandatory notification. What must the system do?",
      returnedSubgraph: {
        nodeIds: ["case0", "c0", "r0", "c1", "c2", "g0"],
        edgeIds: ["e2", "e1", "e3", "e4", "e5"],
      },
      topPaths: [
        {
          path: ["case0", "c0", "r0", "c1", "c2", "g0"],
          score: 0.86,
          naturalLanguage:
            "Potential trigger → apply rule → escalate to registered clinician and record rationale/evidence based on AU guidance and internal playbook.",
          evidenceRefs: [
            "National Law (AHPRA) – Mandatory notifications",
            "Mandatory Notification Playbook v1.2",
          ],
        },
      ],
    },
  },
];

// --- NN asset (telehealth pre-check classifier: readiness/risk) ---
export const KB_PSY_NN_ASSETS: NeuralNetAsset[] = [
  {
    id: "ASSET-NN-PSY-TELEHEALTH-READY-01",
    kbId: KB_PSY_NN,
    type: "neural_network",
    title: "Telehealth readiness & escalation classifier",
    summary:
      "Flags sessions that are missing identity/location/consent/environment checks and routes to clinician confirmation.",
    tags: ["telehealth", "operational", "pre_check", "routing"],
    riskLevel: "high",
    evidence: [
      {
        type: "standard",
        reference: "APS Telehealth considerations",
        locator: "Service delivery",
        excerpt:
          "Confirm consent, privacy, and practical safety considerations for telehealth delivery.",
      },
      {
        type: "internal",
        reference: "Telehealth Session Checklist v2.0",
        locator: "Checklist",
        excerpt:
          "Identity/location/consent/environment checks must be completed before session.",
      },
    ],
    provenance: {
      assetId: "ASSET-NN-PSY-TELEHEALTH-READY-01",
      name: "Telehealth Readiness",
      type: "neural_network",
      version: "1.0.0",
      owner: "Service Delivery Lead",
      lastTrainedAt: "2026-02-11T00:00:00Z",
      dataset: {
        name: "Telehealth-QA-Labels",
        version: "2026.02",
        size: 24000,
      },
      build: {
        pipelineId: "pipe_nn_psy_0301",
        gitCommit: "psynn01",
        environment: "staging",
      },
    },
    eval: {
      accuracy: 0.89,
      f1: 0.84,
      auroc: 0.92,
      calibrationEce: 0.07,
      latencyMsP50: 35,
      latencyMsP95: 110,
    },
    model: {
      architecture: "Transformer + Checklist head",
      inputSchema: [
        "sessionText",
        "hasIdentityCheck",
        "hasLocation",
        "hasConsent",
        "hasPrivacyEnv",
      ],
      outputLabels: ["ready", "needs_clinician_confirm"],
      paramsM: 22,
    },
    training: {
      epochs: 6,
      bestEpoch: 5,
      loss: {
        train: [0.68, 0.54, 0.45, 0.39, 0.36, 0.35],
        val: [0.7, 0.56, 0.48, 0.42, 0.39, 0.4],
      },
      metricsByEpoch: [
        { epoch: 1, valF1: 0.72, valAuroc: 0.86 },
        { epoch: 3, valF1: 0.8, valAuroc: 0.9 },
        { epoch: 5, valF1: 0.84, valAuroc: 0.92 },
      ],
    },
    evaluationArtifacts: {
      confusionMatrix: {
        labels: ["ready", "needs_clinician_confirm"],
        matrix: [
          [9800, 620],
          [910, 12670],
        ],
      },
      sliceMetrics: [
        { sliceName: "AU telehealth", count: 24000, f1: 0.84, auroc: 0.92 },
      ],
    },
    sampleInference: {
      input: {
        sessionText:
          "Client joins from a new device; consent not yet confirmed.",
        hasIdentityCheck: true,
        hasLocation: false,
        hasConsent: false,
        hasPrivacyEnv: true,
      },
      output: [
        { label: "needs_clinician_confirm", probability: 0.86 },
        { label: "ready", probability: 0.14 },
      ],
      explanation: {
        method: "shap",
        topContributors: [
          { feature: "hasConsent=false", contribution: 0.36 },
          { feature: "hasLocation=false", contribution: 0.28 },
          { feature: "new_device_text", contribution: 0.12 },
        ],
        naturalLanguage: [
          "Consent not confirmed increases escalation likelihood.",
          "Location is required to support emergency response planning if needed.",
        ],
      },
    },
  },
];

export const KB_TO_ASSET_IDS: Record<string, string[]> = {
  [KB_RDR]: KB_RDR_ASSETS.map((a) => a.id),
  [KB_KG]: KB_KG_ASSETS.map((a) => a.id),
  [KB_NN]: KB_NN_ASSETS.map((a) => a.id),

  [KB_PSY_RDR]: KB_PSY_RDR_ASSETS.map((a) => a.id),
  [KB_PSY_KG]: KB_PSY_KG_ASSETS.map((a) => a.id),
  [KB_PSY_NN]: KB_PSY_NN_ASSETS.map((a) => a.id),
};

// ============ Asset registry ============
export const ASSET_REGISTRY: Record<string, AnyAsset> = Object.fromEntries(
  [
    ...KB_RDR_ASSETS,
    ...KB_KG_ASSETS,
    ...KB_NN_ASSETS,

    ...KB_PSY_RDR_ASSETS,
    ...KB_PSY_KG_ASSETS,
    ...KB_PSY_NN_ASSETS,
  ].map((a) => [a.id, a]),
);

// ============ Training Config Defaults ============
export const DEFAULT_TRAINING_CONFIG = {
  rdr: { maxDepth: 10, minSupport: 50, pruneThreshold: 0.01 },
  knowledge_graph: { embeddingDim: 128, walkLength: 10, numWalks: 80 },
  neural_network: {
    epochs: 10,
    learningRate: 0.001,
    batchSize: 32,
    optimizer: "adam",
  },
};

// ============ Tree Helpers ============
export function countTreeNodes(node: RdrNode): {
  total: number;
  maxDepth: number;
  leaves: number;
} {
  let total = 1;
  let leaves = 0;
  let maxDepth = 0;

  if (!node.children || node.children.length === 0) {
    leaves = 1;
  } else {
    for (const child of node.children) {
      const childStats = countTreeNodes(child);
      total += childStats.total;
      leaves += childStats.leaves;
      maxDepth = Math.max(maxDepth, childStats.maxDepth + 1);
    }
  }
  return { total, maxDepth, leaves };
}

export function getAssetsByKnowledgeBase(kb: Rule): AnyAsset[] {
  const ids = KB_TO_ASSET_IDS[kb.id];
  if (!ids || ids.length === 0) return [];
  return ids.map((id) => ASSET_REGISTRY[id]).filter(Boolean);
}
