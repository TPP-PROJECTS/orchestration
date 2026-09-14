// ============ Types ============
export interface Rule {
  id: string;
  title: string;
  summary: string;
  domain: string[];
  jurisdiction: string[];
  intentType: IntentType;
  scope: Scope;
  enforcement: Enforcement;
  strength: Strength;
  action: Action;
  source: Source[];
  inferenceModel: InferenceModel;
  owner: string;
  version: string;
  status: Status;
  lastModified: string;
  riskLevel: RiskLevel;
  trustWorthy: TrustWorthy;
  changeLog: ChangeLogEntry[];
  // Three-tier policy fields
  tier?: "external" | "internal" | "implicit";
  libraryId?: string;
  libraryName?: string;
  componentId?: string;
  componentName?: string;
  sourceFile?: string;
}

export interface PolicyLibrary {
  id: string;
  name: string;
  description?: string;
  tier: "external" | "internal";
  inferenceModel: string;
  sourceFile?: string;
  componentId?: string;
  componentName?: string;
  ruleCount: number;
  status: string;
  createdAt: string;
}

export type InferenceModel =
  | "rdr"
  | "knowledge_graph"
  | "neural_network"
  | string;

export type IntentType =
  | "access_control"
  | "data_handling"
  | "model_ai_use"
  | "safety_content"
  | "compliance"
  | "operational"
  | "procurement"
  | "incident"
  | string;

export type Scope =
  | "global"
  | "product"
  | "org"
  | "team"
  | "project"
  | "tenant"
  | "user"
  | "session"
  | "request"
  | "resource"
  | string;

export type Enforcement =
  | "pre_check"
  | "in_flight"
  | "post_check"
  | "advisory"
  | string;

export type Strength =
  | "must"
  | "must_not"
  | "should"
  | "should_not"
  | "may"
  | string;

export type Action =
  | "deny"
  | "allow"
  | "require_approval"
  | "log"
  | "redact"
  | string;

export type Status = "draft" | "active" | "deprecated" | string;

export type RiskLevel = "critical" | "high" | "medium" | "low" | string;

export type TrustWorthy =
  | "explain"
  | "interpretation"
  | "case"
  | "other"
  | string;

export interface Source {
  type: "regulation" | "standard" | "internal";
  reference: string;
  url?: string;

  // new: for uploaded file
  fileMeta?: {
    originalName: string;
    renamedName: string; // editable
    size: number;
    mime: string;
  };
  fileUrl?: string; // e.g., URL.createObjectURL(file)
}

export interface ChangeLogEntry {
  date: string;
  user: string;
  action: string;
  details: string;
}

// ============ Filter Option Type ============
export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface FilterOptions {
  domains: FilterOption[];
  jurisdictions: FilterOption[];
  intentTypes: FilterOption[];
  scopes: FilterOption[];
  enforcements: FilterOption[];
  strengths: FilterOption[];
  statuses: FilterOption[];
  inferenceModels: FilterOption[];
  trustWorthys: FilterOption[];
}

export interface FilterState {
  domains: string[];
  jurisdictions: string[];
  intentTypes: string[];
  scopes: string[];
  enforcements: string[];
  strengths: string[];
  statuses: string[];
  inferenceModels: string[];
  trustWorthys: string[];
  search: string;
}
