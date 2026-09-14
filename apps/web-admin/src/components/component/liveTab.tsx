import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Activity,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildStatusCode,
  getStatusCodeInfo,
  getStatusBadgeClass,
  ResultStatus,
  ReviewerType,
  MessageStatus,
  HasExplanation,
  ContentCombination,
  ExplanationSource,
  PRIMARY_REJECT_REASONS,
  SECONDARY_REJECT_REASONS,
} from "@/lib/statusCodes";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

type ChatTrace = {
  id: string;
  createdAt: number;
  payload: unknown;
};

type HttpLog = {
  timestamp: number;
  direction?: string;
  method?: string;
  url: string;
  status_code?: number | string;
  request_headers?: Record<string, unknown>;
  response_headers?: Record<string, unknown>;
  request_body?: string;
  response_body?: string;
  trace_id?: string;
};

type PolicyViolationItem = {
  policy_id: string;
  policy_name: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  reason: string;
  suggestion?: string;
  // Extended fields for detailed display
  rule_description?: string;
  rule_content?: string;
  source_document?: string;
  source_section?: string;
  library_id?: string;
  library_name?: string;
};

type PolicyEvaluation = {
  decision: string;
  passed: boolean;
  violations: PolicyViolationItem[];
  summary: string;
  evaluation_time_ms: number;
  evaluated_policies: number;
};

type HITLRequest = {
  message_id: string;
  trace_id: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
  meta?: Record<string, unknown>;
  timestamp: number;
  policyEvaluation?: PolicyEvaluation | null;
};

const ACTIVE_TAB_CLS =
  "text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:shadow-sm";

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Safely convert an unknown value to a string safe to render in JSX. */
function toStr(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tryGet(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function getStatusBadge(statusCode: string) {
  const info = getStatusCodeInfo(statusCode);
  return {
    label: `${statusCode} - ${info.label}`,
    className: getStatusBadgeClass(statusCode),
  };
}

function buildDisplayCode(
  isSuccess: boolean,
  isHuman: boolean,
  messageStatus: MessageStatus,
  hasExpl: HasExplanation = HasExplanation.NO,
  contentComb: ContentCombination = ContentCombination.NONE,
  explSource: ExplanationSource = ExplanationSource.NONE,
): string {
  return buildStatusCode({
    resultStatus: isSuccess ? ResultStatus.SUCCESS : ResultStatus.FAILURE,
    reviewerType: isHuman ? ReviewerType.HUMAN : ReviewerType.MACHINE,
    messageStatus,
    hasExplanation: hasExpl,
    contentCombination: contentComb,
    explanationSource: explSource,
  });
}

function JsonPanel({
  title,
  data,
  copyable = true,
}: {
  title: string;
  data: unknown;
  copyable?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeStringify(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {copyable ? (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void onCopy()}
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="text-xs overflow-auto rounded-md bg-muted p-3">
          {safeStringify(data)}
        </pre>
      </CardContent>
    </Card>
  );
}

function metaToPairs(meta: Record<string, unknown> | undefined) {
  if (!meta) return [];
  return Object.entries(meta).map(([k, v]) => {
    let s: string;
    if (typeof v === "string") s = v;
    else if (typeof v === "number" || typeof v === "boolean") s = String(v);
    else if (v == null) s = "null";
    else s = safeStringify(v);
    return [k, s] as const;
  });
}

interface LiveTabProps {
  traces: ChatTrace[];
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  currentHitl: HITLRequest | null;
  hitlQueue: HITLRequest[];
  onHandleAllow: (
    messageId: string,
    traceId: string,
    overrides?: { override_message?: string; admin_prompt?: string },
  ) => Promise<void>;
  onHandleReject: (errorCode: string, reason: string) => Promise<void>;
  secondaryReview: {
    messageId: string;
    traceId: string;
    llmResponse: string;
    effectiveMessage: string;
    adminPrompt: string;
    outputPolicyEvaluation?: PolicyEvaluation | null;
  } | null;
  onCloseSecondaryReview: () => void;
  onHandleSecondaryReject: (errorCode: string, reason: string) => Promise<void>;
  onHandleSecondarySend: () => Promise<void>;
  onHandleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  editedContent: string;
  onEditedContentChange: (content: string) => void;
  editedAdminPrompt: string;
  onEditedAdminPromptChange: (prompt: string) => void;
  regenerateError: string;
  onRegenerateErrorChange: (error: string) => void;
  syncScroll?: boolean;
  onSyncScrollChange?: (sync: boolean) => void;
  triggerLiveScroll?: number;
  autoMode?: boolean;
  onAutoModeChange?: (auto: boolean) => void;
  apiBase?: string;
  onNavigateToLogs?: () => void;
}

function LogDetailsDialog({
  open,
  onOpenChange,
  selectedPayload,
  logs = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPayload: Record<string, unknown>;
  logs: HttpLog[];
}) {
  const messageId = selectedPayload?.message_id as string | undefined;
  const llmResponse = selectedPayload?.llm_response as
    | Record<string, unknown>
    | undefined;

  // llmResponse.content is the Claude API content blocks array: [{type:"text", text:"..."}]
  // Extract the plain text from the first text block, falling back gracefully.
  const llmResponseText = React.useMemo(() => {
    if (!llmResponse) return undefined;
    // If it's a plain string already
    if (typeof llmResponse === "string") return llmResponse as string;
    // Claude API envelope: content is an array of blocks
    const blocks = llmResponse.content;
    if (Array.isArray(blocks)) {
      return (
        blocks
          .filter(
            (b): b is { type: string; text: string } =>
              typeof b === "object" &&
              b !== null &&
              (b as Record<string, unknown>).type === "text",
          )
          .map((b) => b.text)
          .join("\n") || undefined
      );
    }
    // Fallback: stringify
    if (typeof blocks === "string") return blocks;
    return undefined;
  }, [llmResponse]);

  const messageContent =
    (selectedPayload?.original_message as string | undefined) ||
    llmResponseText;
  const timestamp = selectedPayload?.timestamp as string | number | undefined;
  const originalMessage = selectedPayload?.original_message as
    | string
    | undefined;

  const relatedLogs = React.useMemo(() => {
    if (!selectedPayload) return [];

    const timestampNum = timestamp ? new Date(timestamp).getTime() / 1000 : 0;
    const timeWindow = 5;

    return logs.filter((log) => {
      if (timestampNum > 0) {
        const logTime = log.timestamp;
        if (Math.abs(logTime - timestampNum) > timeWindow) {
          return false;
        }
      }

      if (messageContent && messageContent.length > 10) {
        const contentSnippet = messageContent.substring(0, 20);
        const hasContent =
          (log.request_body && log.request_body.includes(contentSnippet)) ||
          (log.response_body && log.response_body.includes(contentSnippet));
        if (hasContent) return true;
      }

      if (messageId) {
        const hasMessageId =
          (log.request_body && log.request_body.includes(messageId)) ||
          (log.response_body && log.response_body.includes(messageId));
        if (hasMessageId) return true;
      }

      if (log.url.includes("/claude/") && originalMessage) {
        return true;
      }

      if (
        selectedPayload.type === "hitl_decision" &&
        log.url.includes("/hitl/")
      ) {
        return true;
      }

      if (
        selectedPayload.trace_id &&
        log.trace_id === selectedPayload.trace_id
      ) {
        return true;
      }

      return false;
    });
  }, [
    logs,
    selectedPayload,
    messageId,
    messageContent,
    timestamp,
    originalMessage,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Related HTTP Logs</DialogTitle>
          <DialogDescription className="flex gap-2 flex-wrap">
            {!!selectedPayload?.trace_id && (
              <Badge variant="outline">
                Trace: {String(selectedPayload.trace_id)}
              </Badge>
            )}
            {!!selectedPayload?.message_id && (
              <Badge variant="outline">
                Message: {String(selectedPayload.message_id)}
              </Badge>
            )}
            {timestamp && (
              <Badge variant="outline">
                Time:{" "}
                {new Date(timestamp as string | number).toLocaleTimeString()}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {relatedLogs.length === 0 ? (
            <div className="text-center p-8 bg-muted rounded-md">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                No related logs found for this communication
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Logs are matched based on timing, content snippets, message IDs,
                and API endpoints
              </p>
            </div>
          ) : (
            relatedLogs.map((log, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {log.direction === "inbound" ? (
                      <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-purple-400" />
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusBadgeClass(String(log.status_code || 0))}`}
                    >
                      {log.method} {log.status_code}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-sm font-mono truncate">{log.url}</p>

                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    View Details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3">
                    {/* Request Headers */}
                    {log.request_headers &&
                      Object.keys(log.request_headers).length > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              Request Headers:
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  JSON.stringify(log.request_headers, null, 2),
                                );
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <div className="rounded bg-muted p-3">
                            <table className="w-full text-xs font-mono">
                              <tbody>
                                {Object.entries(log.request_headers).map(
                                  ([k, v]) => (
                                    <tr key={k} className="align-top">
                                      <td className="pr-3 text-muted-foreground whitespace-nowrap py-0.5 w-1/3">
                                        {k}
                                      </td>
                                      <td className="break-all py-0.5">
                                        {String(v)}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    {/* Response Headers */}
                    {log.response_headers &&
                      Object.keys(log.response_headers).length > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              Response Headers:
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  JSON.stringify(log.response_headers, null, 2),
                                );
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <div className="rounded bg-muted p-3">
                            <table className="w-full text-xs font-mono">
                              <tbody>
                                {Object.entries(log.response_headers).map(
                                  ([k, v]) => (
                                    <tr key={k} className="align-top">
                                      <td className="pr-3 text-muted-foreground whitespace-nowrap py-0.5 w-1/3">
                                        {k}
                                      </td>
                                      <td className="break-all py-0.5">
                                        {String(v)}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    {/* Request Body */}
                    {log.request_body && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            Request Body:
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                log.request_body ?? "",
                              );
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <JsonDisplay content={log.request_body} />
                      </div>
                    )}
                    {/* Response Body */}
                    {log.response_body && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            Response Body:
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                log.response_body ?? "",
                              );
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <JsonDisplay content={log.response_body} />
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 添加JSON格式化显示组件
function JsonDisplay({ content }: { content: string }) {
  try {
    const jsonData = JSON.parse(content);
    return (
      <div className="rounded bg-muted p-3 relative">
        <pre className="text-xs overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    );
  } catch (e) {
    return (
      <div className="rounded bg-muted p-3">
        <pre className="text-xs overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all">
          {content}
        </pre>
      </div>
    );
  }
}

function PolicyEvaluationAlert({
  evaluation,
  label,
}: {
  evaluation: PolicyEvaluation;
  label: string;
}) {
  const isBlock = evaluation.decision === "BLOCK";
  const isWarn = evaluation.decision === "WARN";
  const isPass = evaluation.decision === "ALLOW";

  return (
    <div
      className={[
        "rounded-lg border p-3 space-y-2",
        isBlock
          ? "border-red-500/50 bg-red-500/10"
          : isWarn
            ? "border-yellow-500/50 bg-yellow-500/10"
            : "border-green-500/50 bg-green-500/10",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {isPass ? (
          <ShieldCheck className="h-4 w-4 text-green-400" />
        ) : (
          <ShieldAlert
            className={`h-4 w-4 ${isBlock ? "text-red-400" : "text-yellow-400"}`}
          />
        )}
        <span className="text-sm font-medium">{label}</span>
        <Badge
          className={
            isBlock
              ? "bg-red-500 text-white"
              : isWarn
                ? "bg-yellow-500 text-black"
                : "bg-green-500 text-white"
          }
        >
          {evaluation.decision}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {evaluation.evaluation_time_ms}ms
        </span>
      </div>

      {evaluation.summary && (
        <p className="text-sm text-muted-foreground">{evaluation.summary}</p>
      )}

      {evaluation.violations.length > 0 && (
        <div className="space-y-2">
          {evaluation.violations.map((v, idx) => (
            <div
              key={idx}
              className={[
                "rounded px-3 py-2.5 text-xs",
                v.severity === "block"
                  ? "bg-red-500/20 border border-red-500/30"
                  : v.severity === "warn"
                    ? "bg-yellow-500/20 border border-yellow-500/30"
                    : "bg-blue-500/20 border border-blue-500/30",
              ].join(" ")}
            >
              {/* Header: Severity + Rule Name */}
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1 py-0 ${
                    v.severity === "block"
                      ? "text-red-300 border-red-500/40"
                      : v.severity === "warn"
                        ? "text-yellow-300 border-yellow-500/40"
                        : "text-blue-300 border-blue-500/40"
                  }`}
                >
                  {v.severity.toUpperCase()}
                </Badge>
                <span className="font-medium">{v.rule_name}</span>
                <span className="text-muted-foreground text-[10px] ml-auto">
                  Policy: {v.policy_name}
                </span>
              </div>

              {/* Exact Policy Library provenance */}
              {v.rule_id && v.rule_id !== "implicit" && (
                <p className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground/80">Rule ID:</span>{" "}
                  <a
                    href={`/api/knowledge-rules/${encodeURIComponent(v.rule_id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline underline-offset-2 hover:text-foreground"
                  >
                    {v.rule_id}
                  </a>
                  {v.library_name && ` · Library: ${v.library_name}`}
                </p>
              )}

              {/* Description */}
              {v.rule_description && (
                <p className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground/80">
                    Description:
                  </span>{" "}
                  {v.rule_description}
                </p>
              )}

              {/* Rule Content */}
              {v.rule_content && (
                <p className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground/80">Rule:</span>{" "}
                  {v.rule_content}
                </p>
              )}

              {/* Source */}
              {(v.source_document || v.source_section) && (
                <p className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground/80">
                    Source:
                  </span>{" "}
                  {v.source_document}
                  {v.source_section && ` (${v.source_section})`}
                </p>
              )}

              {/* Reason (AI evaluation result) */}
              <div className="mt-2 pt-2 border-t border-current/10">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    Violation:
                  </span>{" "}
                  {v.reason}
                </p>
              </div>

              {/* Suggestion */}
              {v.suggestion && (
                <p className="text-muted-foreground mt-1.5 italic bg-black/10 rounded px-2 py-1">
                  💡 Suggestion: {v.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveTab({
  traces,
  selectedId,
  onSelectedIdChange,
  currentHitl,
  hitlQueue: _hitlQueue,
  onHandleAllow,
  onHandleReject,
  secondaryReview,
  onCloseSecondaryReview,
  onHandleSecondaryReject,
  onHandleSecondarySend,
  onHandleRegenerate,
  isRegenerating,
  editedContent,
  onEditedContentChange,
  editedAdminPrompt,
  onEditedAdminPromptChange,
  regenerateError,
  onRegenerateErrorChange,
  syncScroll,
  onSyncScrollChange,
  triggerLiveScroll,
  autoMode,
  onAutoModeChange,
  logs = [],
  apiBase,
  onNavigateToLogs,
}: LiveTabProps & { logs?: HttpLog[] }): React.JSX.Element {
  const [logDialogOpen, setLogDialogOpen] = React.useState(false);
  const [logDialogPayload, setLogDialogPayload] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const [editableUserMessage, setEditableUserMessage] =
    React.useState<string>("");
  const [adminPrompt, setAdminPrompt] = React.useState<string>("");
  const [selectedRejectReason, setSelectedRejectReason] =
    React.useState<string>("");
  const [customRejectReason, setCustomRejectReason] =
    React.useState<string>("");
  const [showRejectInput, setShowRejectInput] = React.useState<boolean>(false);
  const [selectedSecondaryRejectReason, setSelectedSecondaryRejectReason] =
    React.useState<string>("");
  const [customSecondaryRejectReason, setCustomSecondaryRejectReason] =
    React.useState<string>("");
  const [showSecondaryRejectInput, setShowSecondaryRejectInput] =
    React.useState<boolean>(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [flowDialogOpen, setFlowDialogOpen] = React.useState(false);
  const [flowEntries, setFlowEntries] = React.useState<
    Array<{ id: string; timestamp: number; role: string; preview: string }>
  >([]);
  const [flowLoading, setFlowLoading] = React.useState(false);

  const selected = React.useMemo(
    () => traces.find((t) => t.id === selectedId) ?? null,
    [traces, selectedId],
  );
  const firstClientMessageId = React.useMemo(() => {
    // traces is prepended newest-first, so the LAST client_message = oldest = End User → Orch
    const msgs = traces.filter(
      (t) => (t.payload as { type?: string })?.type === "client_message",
    );
    return msgs[msgs.length - 1]?.id ?? null;
  }, [traces]);

  const handleViewFlow = React.useCallback(
    async (traceId: string) => {
      if (!apiBase) return;
      setFlowLoading(true);
      setFlowDialogOpen(true);
      setFlowEntries([]);
      try {
        const response = await fetch(`${apiBase}/api/comm-logs?limit=500`);
        if (response.ok) {
          const data = (await response.json()) as {
            logs?: Array<{
              id: string;
              timestamp: number;
              channel?: string;
              payload?: Record<string, unknown>;
            }>;
          };
          const allLogs = data.logs ?? [];
          const filtered = allLogs.filter((log) => {
            const p = log.payload;
            if (!p) return false;
            return (
              p._session_id === traceId ||
              p.trace_id === traceId
            );
          });
          const getRole = (p: Record<string, unknown>): string => {
            const msg = (p.message ?? {}) as Record<string, unknown>;
            if (typeof msg.role === "string") return msg.role;
            if (typeof p.role === "string") return p.role;
            return "unknown";
          };
          const getPreview = (p: Record<string, unknown>): string => {
            const msg = (p.message ?? {}) as Record<string, unknown>;
            const content = msg.content ?? p.content;
            if (typeof content === "string") return content.slice(0, 120);
            if (Array.isArray(content)) {
              const textItem = (
                content as Array<{ type?: string; text?: string }>
              ).find((c) => c.type === "text");
              if (textItem?.text) return textItem.text.slice(0, 120);
              if (
                (content as Array<{ type?: string }>).some(
                  (c) => c.type === "tool_use" || c.type === "tool_result",
                )
              )
                return "(tool call)";
            }
            return "";
          };
          const entries = filtered
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((log) => ({
              id: log.id,
              timestamp: log.timestamp,
              role: getRole(log.payload ?? {}),
              preview: getPreview(log.payload ?? {}) || "(no preview)",
            }));
          setFlowEntries(entries);
        }
      } catch {
        // ignore
      } finally {
        setFlowLoading(false);
      }
    },
    [apiBase],
  );

  const selectedTraceRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {}, [traces]);
  React.useEffect(() => {
    if (syncScroll && triggerLiveScroll && triggerLiveScroll > 0) {
      const scrollContainer = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [triggerLiveScroll, syncScroll]);

  React.useEffect(() => {
    if (selectedId && selectedTraceRef.current) {
      selectedTraceRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedId]);

  React.useEffect(() => {
    if (!currentHitl) return;
    setEditableUserMessage(currentHitl.message ?? "");
    setAdminPrompt("");
  }, [currentHitl]);

  React.useEffect(() => {
    if (currentHitl) {
      setShowRejectInput(false);
      setSelectedRejectReason("");
      setCustomRejectReason("");
    }
  }, [currentHitl?.message_id]);

  React.useEffect(() => {
    if (secondaryReview) {
      setShowSecondaryRejectInput(false);
      setSelectedSecondaryRejectReason("");
      setCustomSecondaryRejectReason("");
    }
  }, [secondaryReview?.messageId]);
  const renderTraceRow = (t: ChatTrace) => {
    const when = new Date(t.createdAt).toLocaleString();
    const payload = t.payload as {
      type?: string;
      trace_id?: string;
      message_id?: string;
      reviewer?: string;
      decision?: string;
      review_type?: string;
      error_code?: string;
      effective_message?: string;
      original_message?: string;
      admin_prompt?: string;
      passed?: boolean;
      policy_type?: string;
      summary?: string;
      evaluation_time_ms?: number;
      [key: string]: unknown;
    };
    const isSelected =
      t.id === selectedId ||
      payload?.trace_id === selectedId ||
      payload?.message_id === selectedId;

    if (payload?.type === "message_approved") {
      const isEdited =
        payload.effective_message !== payload.original_message ||
        payload.admin_prompt;
      const hasInfoAdded =
        !!payload.admin_prompt &&
        payload.effective_message === payload.original_message;
      const msgStatus = hasInfoAdded
        ? MessageStatus.INFO_ADDED
        : isEdited
          ? MessageStatus.MODIFIED
          : MessageStatus.ORIGINAL;
      const reviewerLower = (payload.reviewer || "").toLowerCase();
      const isHumanReviewer =
        !reviewerLower.includes("auto") &&
        !reviewerLower.includes("system") &&
        !reviewerLower.includes("policy");
      const statusCode = buildDisplayCode(true, isHumanReviewer, msgStatus);
      const badge = getStatusBadge(statusCode);

      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Orch → Chat AI
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            Approved user message forwarded to AI pipeline
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span>{when}</span>
            <span>Approver: {payload.reviewer}</span>
          </div>
        </button>
      );
    }

    if (payload?.type === "hitl_decision") {
      const decision = payload.decision;
      const reviewType = payload.review_type || "primary_review";
      const errorCode = payload.error_code;

      const isPolicyViolation =
        typeof errorCode === "string" && errorCode.includes("POLICY_VIOLATION");
      const reviewerLower = (payload.reviewer || "").toLowerCase();
      const isHumanReviewer =
        !reviewerLower.includes("auto") &&
        !reviewerLower.includes("system") &&
        !reviewerLower.includes("policy");

      let statusCode: string;
      let badge: { label: string; className: string };

      if (isPolicyViolation) {
        const isInput = errorCode === "INPUT_POLICY_VIOLATION";
        statusCode = buildDisplayCode(
          false,
          false,
          MessageStatus.ORIGINAL,
          HasExplanation.YES,
          ContentCombination.EXPLANATION_ONLY,
          ExplanationSource.EXTERNAL_REF,
        );
        badge = {
          label: isInput
            ? `${statusCode} - BLOCKED (Input Policy)`
            : `${statusCode} - BLOCKED (Output Policy)`,
          className: "bg-orange-500 text-white hover:bg-orange-600",
        };
      } else if (decision === "DENY") {
        if (typeof errorCode === "string" && /^\d{7}$/.test(errorCode)) {
          statusCode = errorCode;
        } else {
          statusCode = buildDisplayCode(
            false,
            isHumanReviewer,
            MessageStatus.ORIGINAL,
          );
        }
        badge = getStatusBadge(statusCode);
      } else if (
        reviewType === "secondary_review_edited" ||
        payload.edited_content
      ) {
        statusCode = buildDisplayCode(
          true,
          isHumanReviewer,
          MessageStatus.MODIFIED,
        );
        badge = getStatusBadge(statusCode);
      } else {
        statusCode = buildDisplayCode(
          true,
          isHumanReviewer,
          MessageStatus.ORIGINAL,
        );
        badge = getStatusBadge(statusCode);
      }

      return (
        <button
          key={t.id}
          onClick={() => onSelectedIdChange(t.id)}
          ref={isSelected ? selectedTraceRef : null}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Orch → Chat AI
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            {decision === "DENY"
              ? "AI response rejected and denial notice sent to chat"
              : "AI response reviewed and delivered to chat"}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span>{when}</span>
            <span>Approver: {payload.reviewer}</span>
          </div>
        </button>
      );
    }

    if (payload?.type === "policy_evaluation") {
      const policyType = payload.policy_type;
      const decision = payload.decision;
      const passed = payload.passed;

      const policyTypeStr = (policyType ?? "").toUpperCase();
      const badge = passed
        ? {
            label: `PASS`,
            className: "bg-green-500 text-white",
          }
        : decision === "BLOCK"
          ? {
              label: `BLOCK`,
              className: "bg-red-500 text-white",
            }
          : {
              label: `WARN`,
              className: "bg-yellow-500 text-black",
            };

      return (
        <button
          key={t.id}
          onClick={() => onSelectedIdChange(t.id)}
          ref={isSelected ? selectedTraceRef : null}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Policy Engine → Orch
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            {(payload as Record<string, unknown>).source
              ? `[${(payload as Record<string, unknown>).source}] `
              : ""}
            {policyTypeStr} policy → {badge.label}
            {payload.summary ? `: ${payload.summary.slice(0, 80)}` : ""}
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    if (payload?.type === "policy_check_request") {
      const policyType = payload.policy_type;
      const policyTypeStr = (policyType ?? "").toUpperCase();

      return (
        <button
          key={t.id}
          onClick={() => onSelectedIdChange(t.id)}
          ref={isSelected ? selectedTraceRef : null}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Orch → Policy Engine
            </span>
            <Badge className="text-xs flex-shrink-0 whitespace-nowrap bg-green-600 text-white">
              Success
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            {policyTypeStr} policy evaluation request dispatched to policy
            engine
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    if (payload?.type === "client_message") {
      const isAutoMode = !!(
        payload?.meta as Record<string, unknown> | undefined
      )?.auto_mode;
      const componentId = (payload?.meta as Record<string, unknown> | undefined)
        ?.component_id;
      const source = componentId
        ? `${String(componentId)}`
        : isAutoMode
          ? "Chat (Auto)"
          : "Chat";
      const isFirstMessage = t.id === firstClientMessageId;
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              {isFirstMessage ? "End User → Orch" : "Chat AI → Orch"}
            </span>
            <Badge className="text-xs flex-shrink-0 bg-green-600 text-white">
              Success
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            Incoming message from {source} received by orchestration system
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    // Step 4a: Orch -> HITL
    if (payload?.type === "hitl_request") {
      const passed = payload.input_policy_passed as boolean | undefined;
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Orch → HITL
            </span>
            <Badge className={`text-xs flex-shrink-0 whitespace-nowrap ${passed === false ? "bg-yellow-500 text-black" : "bg-blue-600 text-white"}`}>
              {passed === false ? "Policy Warning" : "Input Review"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            Message sent to admin for input review — awaiting decision, flow paused
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    // Step 4b: HITL -> Orch (admin input decision)
    if (payload?.type === "hitl_admin_decision_input") {
      const dec = payload.decision as string | undefined;
      const isAllow = dec === "ALLOW";
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              HITL → Orch
            </span>
            <Badge className={`text-xs flex-shrink-0 whitespace-nowrap ${isAllow ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
              {isAllow ? "Allowed" : "Rejected"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            {isAllow
              ? "Admin approved — message forwarded to AI pipeline"
              : "Admin rejected — flow terminated, no AI response will be sent"}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span>{when}</span>
            {payload.reason ? <span>Reason: {toStr(payload.reason)}</span> : null}
          </div>
        </button>
      );
    }

    // Step 8a: Orch -> HITL (secondary review)
    if (payload?.type === "secondary_review_request") {
      const outputEval = payload.output_policy_evaluation as Record<string, unknown> | undefined | null;
      const hasPolicyWarning = outputEval && outputEval.passed === false;
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Orch → HITL
            </span>
            <Badge className={`text-xs flex-shrink-0 whitespace-nowrap ${hasPolicyWarning ? "bg-yellow-500 text-black" : "bg-blue-600 text-white"}`}>
              Output Review
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            AI response sent to admin for output review — awaiting decision, flow paused
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    // Step 8b: HITL -> Orch (admin output decision)
    if (payload?.type === "hitl_admin_decision_output") {
      const action = payload.action as string | undefined;
      const badgeCls =
        action === "APPROVE"
          ? "bg-green-600 text-white"
          : action === "EDIT"
            ? "bg-blue-500 text-white"
            : "bg-red-600 text-white";
      const badgeLabel =
        action === "APPROVE" ? "Approved" : action === "EDIT" ? "Edited" : "Rejected";
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              HITL → Orch
            </span>
            <Badge className={`text-xs flex-shrink-0 whitespace-nowrap ${badgeCls}`}>
              {badgeLabel}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            {action === "APPROVE"
              ? "Admin approved AI response — delivering to chat"
              : action === "EDIT"
                ? "Admin approved with edits — delivering modified response to chat"
                : "Admin rejected AI response — flow terminated, no response delivered"}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span>{when}</span>
            {payload.reject_reason ? <span>Reason: {toStr(payload.reject_reason)}</span> : null}
          </div>
        </button>
      );
    }

    if (payload?.type === "llm_response_ready") {
      const model = (payload as Record<string, unknown>).claude_model as
        | string
        | undefined;
      const timings = (payload as Record<string, unknown>).timings_ms as
        | Record<string, number>
        | undefined;
      const errors = (payload as Record<string, unknown>).errors as
        | unknown[]
        | undefined;
      const hasFailed = Array.isArray(errors) && errors.length > 0;
      const totalMs = timings?.total ?? timings?.llm ?? null;
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Chat AI → Orch
            </span>
            <Badge className={`text-xs flex-shrink-0 ${hasFailed ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
              {hasFailed ? "Failed" : "Success"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground text-wrap">
            AI generated response received by orchestration system
            {model ? ` (${model})` : ""}
            {totalMs != null ? ` · ${totalMs}ms` : ""}
          </div>
          <div className="mt-1 text-xs text-gray-400">{when}</div>
        </button>
      );
    }

    if (payload?.type === "external_event") {
      const p = payload as Record<string, unknown>;
      const source = p.source as string | undefined;
      const method = p.method as string | undefined;
      const url = p.url as string | undefined;
      const statusCode = p.status_code as number | undefined;
      const durationMs = p.duration_ms as number | undefined;
      const isOk = !statusCode || statusCode < 400;
      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              {source ?? "External"} → Orch
            </span>
            <Badge
              className={`text-xs flex-shrink-0 ${isOk ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}
            >
              {method ?? "REQUEST"}{statusCode ? ` ${statusCode}` : ""}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">{url}</div>
          <div className="mt-1 text-xs text-gray-400">
            {when}{durationMs != null ? ` · ${durationMs}ms` : ""}
          </div>
        </button>
      );
    }

    return null;
  };

  const selectedPayload = (selected?.payload ?? {}) as {
    type?: string;
    trace_id?: string;
    message_id?: string;
    timestamp?: string | number;
    decision?: string;
    error_code?: string;
    reviewer?: string;
    review_type?: string;
    reason?: string;
    original_message?: string;
    effective_message?: string;
    admin_prompt?: string;
    edited_content?: string;
    approved_content?: string;
    llm_response?: Record<string, unknown>;
    policy_type?: string;
    passed?: boolean;
    summary?: string;
    violations?: Record<string, unknown>[];
    evaluation_time_ms?: number;
    evaluated_policies?: number;
    // policy_check_request fields
    envelope_type?: string;
    action?: string;
    context?: Record<string, unknown>;
    dry_run?: boolean;
    [key: string]: unknown;
  };
  const traceType = selectedPayload?.type;

  const isMessageApproved = traceType === "message_approved";
  const isHitlDecision = traceType === "hitl_decision";
  const isPolicyEvaluation = traceType === "policy_evaluation";
  const isPolicyCheckRequest = traceType === "policy_check_request";
  const isClientMessage = traceType === "client_message";
  const isLlmResponse = traceType === "llm_response_ready";
  const isExternalEvent = traceType === "external_event";
  const messageApprovedData = isMessageApproved
    ? {
        original_message: tryGet(selectedPayload, ["original_message"]),
        effective_message: tryGet(selectedPayload, ["effective_message"]),
        admin_prompt: tryGet(selectedPayload, ["admin_prompt"]),
        claude_request: tryGet(selectedPayload, ["claude_request"]),
        reviewer: tryGet(selectedPayload, ["reviewer"]),
        timestamp: tryGet(selectedPayload, ["timestamp"]),
        meta: tryGet(selectedPayload, ["meta"]),
      }
    : null;

  return (
    <>
      <LogDetailsDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        selectedPayload={logDialogPayload ?? {}}
        logs={logs}
      />

      {/* Flow Modal */}
      <Dialog open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Conversation Flow</DialogTitle>
            <DialogDescription>
              LLM conversation flow entries for this trace
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {flowLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Loading flow…
              </div>
            ) : flowEntries.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No flow entries found for this trace
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {flowEntries.map((entry, idx) => {
                  const roleColor =
                    entry.role === "user"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : entry.role === "assistant"
                        ? "bg-green-500/20 text-green-300 border-green-500/30"
                        : "bg-gray-500/20 text-gray-300 border-gray-500/30";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-md bg-muted/40 px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                        {idx + 1}
                      </span>
                      <Badge
                        className={`text-xs shrink-0 border ${roleColor}`}
                      >
                        {entry.role}
                      </Badge>
                      <span className="text-sm text-foreground whitespace-pre-wrap break-words min-w-0">
                        {entry.preview}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {onNavigateToLogs && (
            <DialogFooter className="border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFlowDialogOpen(false);
                  onNavigateToLogs();
                }}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Logs Tab
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* HITL Modal */}
      <Dialog
        open={!!currentHitl && !autoMode}
        onOpenChange={(open) => {
          if (!open && currentHitl) {
            onHandleAllow(currentHitl.message_id, currentHitl.trace_id, {
              override_message: editableUserMessage,
              admin_prompt: adminPrompt,
            });
            setShowRejectInput(false);
            setSelectedRejectReason("");
            setCustomRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Message Review</DialogTitle>
            <DialogDescription>
              Review the request below and decide whether to allow or deny it.
            </DialogDescription>
          </DialogHeader>

          {currentHitl && (
            <div className="space-y-4">
              {currentHitl.meta && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-sm font-medium mb-2">
                    Request Metadata
                  </div>
                  <div className="space-y-1">
                    {metaToPairs(currentHitl.meta).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0">
                          {k}:
                        </span>
                        <span className="whitespace-pre-wrap break-words">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentHitl.policyEvaluation && (
                <PolicyEvaluationAlert
                  evaluation={currentHitl.policyEvaluation}
                  label="Input Policy Check"
                />
              )}

              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">User Request</div>
                <Textarea
                  value={editableUserMessage}
                  onChange={(e) => setEditableUserMessage(e.target.value)}
                  className="min-h-[120px]"
                  placeholder="Edit user request..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Prompt</label>
                <Textarea
                  value={adminPrompt}
                  onChange={(e) => setAdminPrompt(e.target.value)}
                  className="min-h-[90px] font-mono text-sm"
                  placeholder="Optional: add an instruction/prompt that will be appended to the Claude request..."
                />
                <div className="text-xs text-muted-foreground">
                  If provided, this prompt will be included in the Claude API
                  request.
                </div>
              </div>

              {showRejectInput && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Rejection Reason
                    </label>
                    <Select
                      value={selectedRejectReason}
                      onValueChange={(value: React.SetStateAction<string>) => {
                        setSelectedRejectReason(value);
                        const reason = PRIMARY_REJECT_REASONS.find(
                          (r) => r.value === value,
                        );
                        if (reason) {
                          setCustomRejectReason(reason.label);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIMARY_REJECT_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Details (Optional)
                    </label>
                    <Textarea
                      value={customRejectReason}
                      onChange={(e) => setCustomRejectReason(e.target.value)}
                      placeholder="Add additional context or details..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Trace ID: {currentHitl?.trace_id?.slice(0, 12)}...
              </div>
              <div className="flex gap-2">
                {showRejectInput ? (
                  <>
                    <Button
                      onClick={() => {
                        setShowRejectInput(false);
                        setSelectedRejectReason("");
                        setCustomRejectReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const reason = PRIMARY_REJECT_REASONS.find(
                          (r) => r.value === selectedRejectReason,
                        );
                        if (reason) {
                          const formattedReason = customRejectReason.trim()
                            ? customRejectReason
                            : reason.label;
                          void onHandleReject(reason.code, formattedReason);
                        }
                      }}
                      disabled={!selectedRejectReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectInput(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() =>
                        currentHitl &&
                        onHandleAllow(
                          currentHitl.message_id,
                          currentHitl.trace_id,
                          {
                            override_message: editableUserMessage,
                            admin_prompt: adminPrompt,
                          },
                        )
                      }
                      disabled={!editableUserMessage.trim()}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Allow
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secondary Review Modal */}
      <Dialog
        open={!!secondaryReview && !autoMode}
        onOpenChange={(open) => {
          if (!open) {
            onCloseSecondaryReview();
            setShowSecondaryRejectInput(false);
            setSelectedSecondaryRejectReason("");
            setCustomSecondaryRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Response Review</DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated response. You can modify the
              prompt and regenerate if needed.
            </DialogDescription>
          </DialogHeader>

          {secondaryReview && (
            <div className="space-y-4">
              {/* Output Policy Evaluation Alert */}
              {secondaryReview.outputPolicyEvaluation && (
                <PolicyEvaluationAlert
                  evaluation={secondaryReview.outputPolicyEvaluation}
                  label="Output Policy Check"
                />
              )}

              {/* User Message (Effective) */}
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">
                  User Message (Sent to AI)
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {secondaryReview.effectiveMessage}
                </div>
              </div>

              {/* Admin Prompt (Editable) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Prompt</label>
                <Textarea
                  value={editedAdminPrompt}
                  onChange={(e) => {
                    onEditedAdminPromptChange(e.target.value);
                    onRegenerateErrorChange("");
                  }}
                  className="min-h-[90px] font-mono text-sm"
                  placeholder="Optional: add or modify the instruction/prompt..."
                />
                <div className="text-xs text-muted-foreground">
                  This prompt will be included when regenerating the response.
                </div>

                {regenerateError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{regenerateError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Regenerate Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => void onHandleRegenerate()}
                  disabled={isRegenerating}
                  size="sm"
                  variant="outline"
                >
                  <RotateCcw
                    className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`}
                  />
                  {isRegenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>

              {/* AI Response (Editable) */}
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">
                  AI Response
                  {editedContent.trim() !==
                    secondaryReview.llmResponse.trim() && (
                    <span className="text-xs text-orange-500 ml-2">
                      (Modified)
                    </span>
                  )}
                </div>
                <Textarea
                  value={editedContent || secondaryReview.llmResponse}
                  onChange={(e) => {
                    onEditedContentChange(e.target.value);
                    onRegenerateErrorChange("");
                  }}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="AI response..."
                />
              </div>

              {showSecondaryRejectInput && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Rejection Reason
                    </label>
                    <Select
                      value={selectedSecondaryRejectReason}
                      onValueChange={(value: React.SetStateAction<string>) => {
                        setSelectedSecondaryRejectReason(value);
                        const reason = SECONDARY_REJECT_REASONS.find(
                          (r) => r.value === value,
                        );
                        if (reason) {
                          setCustomSecondaryRejectReason(reason.label);
                        }
                        onRegenerateErrorChange("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECONDARY_REJECT_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Details (Optional)
                    </label>
                    <Textarea
                      value={customSecondaryRejectReason}
                      onChange={(e) => {
                        setCustomSecondaryRejectReason(e.target.value);
                        onRegenerateErrorChange("");
                      }}
                      placeholder="Add additional context or details..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Trace ID: {secondaryReview?.traceId?.slice(0, 12)}...
              </div>
              <div className="flex gap-2">
                {showSecondaryRejectInput ? (
                  <>
                    <Button
                      onClick={() => {
                        setShowSecondaryRejectInput(false);
                        setSelectedSecondaryRejectReason("");
                        setCustomSecondaryRejectReason("");
                        onRegenerateErrorChange("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const reason = SECONDARY_REJECT_REASONS.find(
                          (r) => r.value === selectedSecondaryRejectReason,
                        );
                        if (reason) {
                          const formattedReason =
                            customSecondaryRejectReason.trim()
                              ? customSecondaryRejectReason
                              : reason.label;
                          void onHandleSecondaryReject(
                            reason.code,
                            formattedReason,
                          );
                        }
                      }}
                      disabled={!selectedSecondaryRejectReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSecondaryRejectInput(true);
                        onRegenerateErrorChange("");
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => void onHandleSecondarySend()}
                      disabled={!editedContent.trim() || isRegenerating}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Trace Feed</CardTitle>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-mode"
                    checked={!!autoMode}
                    onCheckedChange={onAutoModeChange}
                    className="
                      data-[state=unchecked]:bg-zinc-600
    data-[state=checked]:bg-zinc-200
    data-[state=checked]:border-black
    data-[state=unchecked]:border-black
                    "
                  />
                  <Label htmlFor="auto-mode" className="text-xs cursor-pointer">
                    Auto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync-mode"
                    checked={!!syncScroll}
                    onCheckedChange={onSyncScrollChange}
                    className="
    data-[state=unchecked]:bg-zinc-600
    data-[state=checked]:bg-zinc-200
    data-[state=checked]:border-black
    data-[state=unchecked]:border-black
  "
                  />
                  <Label htmlFor="sync-mode" className="text-xs cursor-pointer">
                    Sync
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea ref={scrollAreaRef} className="h-full pr-3">
              <div className="space-y-2">
                {[...traces]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map(renderTraceRow)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Trace Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {isMessageApproved && messageApprovedData && (
              <Tabs defaultValue="request" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                  {["request", "meta"].map((v) => (
                    <TabsTrigger key={v} value={v} className={ACTIVE_TAB_CLS}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="request" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        User Message & LLM Request
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Original User Message
                          </div>
                          <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                            {typeof messageApprovedData.original_message ===
                            "string"
                              ? messageApprovedData.original_message
                              : safeStringify(
                                  messageApprovedData.original_message,
                                )}
                          </div>
                        </div>

                        {typeof messageApprovedData.effective_message ===
                          "string" &&
                          typeof messageApprovedData.original_message ===
                            "string" &&
                          messageApprovedData.effective_message !==
                            messageApprovedData.original_message && (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Edited Message</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                                  >
                                    {buildDisplayCode(
                                      true,
                                      true,
                                      MessageStatus.MODIFIED,
                                    )}{" "}
                                    - Modified
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-yellow-900/20 border border-yellow-500/30 p-3 text-sm whitespace-pre-wrap">
                                  {messageApprovedData.effective_message}
                                </div>
                              </div>
                            </>
                          )}

                        {typeof messageApprovedData.admin_prompt === "string" &&
                          messageApprovedData.admin_prompt.trim() && (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Prompt</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30"
                                  >
                                    System Instruction
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-purple-900/20 border border-purple-500/30 p-3 text-sm whitespace-pre-wrap font-mono">
                                  {messageApprovedData.admin_prompt}
                                </div>
                              </div>
                            </>
                          )}
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            LLM Request (to be sent)
                          </div>
                          <pre className="text-xs overflow-auto rounded-md bg-muted p-3">
                            {safeStringify(messageApprovedData.claude_request)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <JsonPanel
                    title="Meta Information"
                    data={{
                      reviewer: messageApprovedData.reviewer,
                      timestamp: messageApprovedData.timestamp,
                      ...(messageApprovedData.meta as Record<string, unknown>),
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}

            {isHitlDecision && (
              <Tabs defaultValue="reply" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-muted/40">
                  {["reply", "routing", "mcp", "meta"].map((v) => (
                    <TabsTrigger key={v} value={v} className={ACTIVE_TAB_CLS}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="reply" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        AI Response Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Decision
                          </div>
                          <div className="flex gap-2">
                            {(() => {
                              const decision = selectedPayload.decision;
                              const errorCode = selectedPayload.error_code;
                              const editedContent =
                                selectedPayload.edited_content;
                              // 判断是否为人工审核
                              const reviewerLower = (
                                selectedPayload.reviewer || ""
                              ).toLowerCase();
                              const isHumanReviewer =
                                !reviewerLower.includes("auto") &&
                                !reviewerLower.includes("system") &&
                                !reviewerLower.includes("policy");

                              let statusCode: string;
                              if (
                                typeof errorCode === "string" &&
                                /^\d{7}$/.test(errorCode)
                              ) {
                                // Already a 7-digit code
                                statusCode = errorCode;
                              } else if (decision === "DENY") {
                                statusCode = buildDisplayCode(
                                  false,
                                  isHumanReviewer,
                                  MessageStatus.ORIGINAL,
                                );
                              } else if (editedContent) {
                                statusCode = buildDisplayCode(
                                  true,
                                  isHumanReviewer,
                                  MessageStatus.MODIFIED,
                                );
                              } else {
                                statusCode = buildDisplayCode(
                                  true,
                                  isHumanReviewer,
                                  MessageStatus.ORIGINAL,
                                );
                              }

                              const badge = getStatusBadge(statusCode);

                              return (
                                <Badge className={badge.className}>
                                  {badge.label}
                                </Badge>
                              );
                            })()}
                            {selectedPayload.review_type && (
                              <Badge variant="outline">
                                {selectedPayload.review_type}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Reviewer
                          </div>
                          <div className="text-sm">
                            {selectedPayload.reviewer}
                          </div>
                        </div>

                        {selectedPayload.reason && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>Reason</span>
                              {selectedPayload.error_code && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Error {selectedPayload.error_code}
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                              {selectedPayload.reason}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const llmResp = selectedPayload.llm_response;
                          const claudeReq = llmResp?.claude_request as
                            | Record<string, unknown>
                            | undefined;
                          const messages = claudeReq?.messages as
                            | Array<Record<string, unknown>>
                            | undefined;
                          const lastUserMsg = messages?.length
                            ? messages[messages.length - 1]
                            : null;
                          const userContent =
                            lastUserMsg?.role === "user"
                              ? (lastUserMsg.content as string)
                              : null;

                          return userContent ? (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                <span>User Message (Sent to AI)</span>
                                <Badge variant="outline" className="text-xs">
                                  From Claude Request
                                </Badge>
                              </div>
                              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                                {userContent}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {(() => {
                          const llmResp = selectedPayload.llm_response;
                          const claudeReq = llmResp?.claude_request as
                            | Record<string, unknown>
                            | undefined;
                          const systemPrompt = claudeReq?.system as
                            | string
                            | undefined;

                          return systemPrompt &&
                            typeof systemPrompt === "string" ? (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Prompt</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30"
                                  >
                                    System Instruction
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-purple-900/20 border border-purple-500/30 p-3 text-sm whitespace-pre-wrap font-mono">
                                  {systemPrompt}
                                </div>
                              </div>
                            </>
                          ) : null;
                        })()}

                        {selectedPayload.edited_content && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>AI Response</span>
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                              >
                                {buildDisplayCode(
                                  true,
                                  true,
                                  MessageStatus.MODIFIED,
                                )}{" "}
                                - Edited & Sent
                              </Badge>
                            </div>
                            <div className="rounded-md bg-yellow-900/20 border border-yellow-500/30 p-3 text-sm whitespace-pre-wrap">
                              {selectedPayload.edited_content}
                            </div>
                          </div>
                        )}

                        {selectedPayload.approved_content && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>AI Response</span>
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-500/10 text-green-300 border-green-500/30"
                              >
                                {buildDisplayCode(
                                  true,
                                  true,
                                  MessageStatus.ORIGINAL,
                                )}{" "}
                                - Original & Sent
                              </Badge>
                            </div>
                            <div className="rounded-md bg-green-900/20 border border-green-500/30 p-3 text-sm whitespace-pre-wrap">
                              {selectedPayload.approved_content}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const llmResp = selectedPayload.llm_response;
                          const usage = llmResp?.usage as
                            | { input_tokens?: number; output_tokens?: number }
                            | undefined;

                          return usage ? (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Token Usage
                              </div>
                              <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Input:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {usage.input_tokens || 0}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Output:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {usage.output_tokens || 0}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Total:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {(usage.input_tokens || 0) +
                                      (usage.output_tokens || 0)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {selectedPayload.llm_response && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                              <span>Full LLM Response (JSON)</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (selectedPayload) {
                                      setLogDialogPayload(selectedPayload);
                                      setLogDialogOpen(true);
                                    } else {
                                      alert(
                                        "No payload data found for this record",
                                      );
                                    }
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Log
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const data = selectedPayload.llm_response;
                                    void navigator.clipboard.writeText(
                                      safeStringify(data),
                                    );
                                  }}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                            <pre className="text-xs overflow-auto rounded-md bg-muted p-3 max-h-[400px]">
                              {safeStringify(selectedPayload.llm_response)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="routing" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        Routing Decision
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const llmResp = selectedPayload.llm_response;
                        const _meta = llmResp?._meta as
                          | Record<string, unknown>
                          | undefined;
                        const routing = _meta?.routing as
                          | {
                              requires_mcp?: boolean;
                              tools_available?: number | string;
                              tools_used?: number;
                              tool_use_rounds?: number;
                              reason?: string;
                              suggested_servers?: string[];
                            }
                          | undefined;

                        if (!routing) {
                          return (
                            <div className="text-sm text-muted-foreground">
                              No routing info
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Used MCP Tools:
                              </span>
                              <Badge
                                variant={
                                  routing.requires_mcp ? "default" : "secondary"
                                }
                              >
                                {routing.requires_mcp ? "Yes" : "No"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  Tools available:
                                </span>
                                <span className="text-sm font-mono">
                                  {routing.tools_available ?? "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  Tools used:
                                </span>
                                <span className="text-sm font-mono">
                                  {routing.tools_used ?? 0}
                                </span>
                              </div>
                              {(routing.tool_use_rounds ?? 0) > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    Rounds:
                                  </span>
                                  <span className="text-sm font-mono">
                                    {routing.tool_use_rounds}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground mb-1">
                                Detail
                              </div>
                              <div className="text-sm">{routing.reason}</div>
                            </div>

                            {routing.suggested_servers &&
                              routing.suggested_servers.length > 0 && (
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    MCP Servers Used
                                  </div>
                                  <div className="flex gap-2">
                                    {routing.suggested_servers.map(
                                      (server: string) => (
                                        <Badge key={server} variant="outline">
                                          {server}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="mcp" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">MCP Context</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const llmResp = selectedPayload.llm_response;
                        const mcpMeta = llmResp?._meta as
                          | Record<string, unknown>
                          | undefined;
                        const mcpContext = mcpMeta?.mcp_context as
                          | {
                              server_name?: string;
                              tool?: string;
                              duration_ms?: number;
                              error?: string;
                              args?: unknown;
                              result?: unknown;
                            }[]
                          | undefined;

                        if (!mcpContext || mcpContext.length === 0) {
                          return (
                            <div className="text-sm text-muted-foreground">
                              No MCP tools were used
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {mcpContext.map((call, idx: number) => (
                              <div key={idx} className="rounded-lg border p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">
                                    {call.server_name}
                                  </Badge>
                                  <span className="text-sm font-mono">
                                    {call.tool}
                                  </span>
                                  {call.duration_ms && (
                                    <span className="text-xs text-muted-foreground">
                                      {call.duration_ms}ms
                                    </span>
                                  )}
                                </div>

                                {call.error ? (
                                  <Alert variant="destructive">
                                    <AlertDescription>
                                      {call.error}
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Arguments
                                    </div>
                                    <pre className="text-xs overflow-auto rounded-md bg-muted p-2 mb-2">
                                      {JSON.stringify(call.args, null, 2)}
                                    </pre>

                                    {call.result && (
                                      <>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">
                                          Result
                                        </div>
                                        <pre className="text-xs overflow-auto rounded-md bg-muted p-2">
                                          {JSON.stringify(call.result, null, 2)}
                                        </pre>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <JsonPanel
                    title="Metadata"
                    data={{
                      trace_id: selectedPayload.trace_id,
                      message_id: selectedPayload.message_id,
                      timestamp: selectedPayload.timestamp,
                      model:
                        (tryGet(selectedPayload, [
                          "llm_response",
                          "model",
                        ]) as string) || "N/A",
                      decision: selectedPayload.decision,
                      error_code: selectedPayload.error_code,
                      reviewer: selectedPayload.reviewer,
                      review_type: selectedPayload.review_type,
                      enriched_at: (
                        selectedPayload.llm_response?._meta as
                          | Record<string, unknown>
                          | undefined
                      )?.enriched_at,
                      policy: (
                        selectedPayload.llm_response?._meta as
                          | Record<string, unknown>
                          | undefined
                      )?.policy,
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}

            {/* ── Client Message (auto mode) Detail ── */}
            {isClientMessage && (
              <div className="space-y-4 mt-2">
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600 text-white text-xs">
                      Auto Mode
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {selectedPayload.trace_id}
                    </span>
                  </div>
                </div>
                {apiBase &&
                  Array.isArray(selectedPayload.history) &&
                  (selectedPayload.history as unknown[]).length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleViewFlow(
                          (selectedPayload.trace_id as string) ||
                            (selectedPayload.message_id as string) ||
                            selected!.id,
                        )
                      }
                      className="flex items-center gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      View Flow
                    </Button>
                  </div>
                )}
                <JsonPanel title="Message" data={selectedPayload.message} />
                {Array.isArray(selectedPayload.history) &&
                  selectedPayload.history.length > 0 && (
                    <JsonPanel title="History" data={selectedPayload.history} />
                  )}
                {selectedPayload.meta != null && (
                  <JsonPanel title="Meta" data={selectedPayload.meta} />
                )}
              </div>
            )}

            {/* ── Policy Check Request Detail ── */}
            {isPolicyCheckRequest &&
              (() => {
                const pr = selectedPayload as {
                  policy_type?: string;
                  envelope_type?: string;
                  action?: string;
                  context?: Record<string, unknown>;
                  payload?: Record<string, unknown>;
                  dry_run?: boolean;
                  trace_id?: string;
                  message_id?: string;
                };
                const requestEnvelope = {
                  jsonrpc: "2.0",
                  id: pr.message_id,
                  envelope_type: pr.envelope_type,
                  params: {
                    action: pr.action,
                    context: pr.context ?? {},
                    ...(pr.payload ? { payload: pr.payload } : {}),
                    ...(pr.dry_run ? { dry_run: pr.dry_run } : {}),
                  },
                  _meta: {
                    trace_id: pr.trace_id,
                    message_id: pr.message_id,
                  },
                };
                return (
                  <div className="space-y-4 mt-2">
                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium capitalize">
                          {pr.policy_type} Policy Check Request
                        </span>
                        <Badge className="bg-blue-600 text-white">
                          {(pr.policy_type ?? "").toUpperCase()} CHECK
                        </Badge>
                        {pr.dry_run && (
                          <Badge
                            variant="outline"
                            className="text-xs text-blue-300 border-blue-500/40 ml-auto"
                          >
                            DRY RUN
                          </Badge>
                        )}
                      </div>
                    </div>
                    <JsonPanel
                      title="Request Envelope"
                      data={requestEnvelope}
                    />
                  </div>
                );
              })()}

            {/* ── Policy Evaluation Detail ── */}
            {isPolicyEvaluation &&
              (() => {
                const pe = selectedPayload as {
                  decision?: string;
                  passed?: boolean;
                  policy_type?: string;
                  summary?: string;
                  evaluation_time_ms?: number;
                  violations?: Array<{
                    severity?: string;
                    rule_name?: string;
                    rule_id?: string;
                    policy_name?: string;
                    reason?: string;
                    suggestion?: string;
                    library_id?: string;
                    library_name?: string;
                  }>;
                  trace_id?: string;
                  message_id?: string;
                  source?: string;
                  url?: string;
                  evaluated_content?: string;
                };
                const isBlock = pe.decision === "BLOCK";
                const isWarn = pe.decision === "WARN";

                return (
                  <div className="space-y-4 mt-2">
                    {/* Summary header */}
                    <div
                      className={[
                        "rounded-lg border p-3 space-y-2",
                        isBlock
                          ? "border-red-500/50 bg-red-500/10"
                          : isWarn
                            ? "border-yellow-500/50 bg-yellow-500/10"
                            : "border-green-500/50 bg-green-500/10",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        {pe.passed ? (
                          <ShieldCheck className="h-4 w-4 text-green-400" />
                        ) : (
                          <ShieldAlert
                            className={`h-4 w-4 ${isBlock ? "text-red-400" : "text-yellow-400"}`}
                          />
                        )}
                        <span className="text-sm font-medium capitalize">
                          {pe.policy_type} Policy Check
                        </span>
                        <Badge
                          className={
                            isBlock
                              ? "bg-red-500 text-white"
                              : isWarn
                                ? "bg-yellow-500 text-black"
                                : "bg-green-500 text-white"
                          }
                        >
                          {pe.decision}
                        </Badge>
                        {pe.evaluation_time_ms != null && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {pe.evaluation_time_ms}ms
                          </span>
                        )}
                      </div>
                      {pe.source && (
                        <div className="text-xs text-muted-foreground">
                          Source: <span className="font-mono">{pe.source}</span>
                          {pe.url && <span className="ml-2 opacity-60 truncate">{pe.url}</span>}
                        </div>
                      )}
                      {pe.summary && (
                        <p className="text-sm text-muted-foreground">
                          {pe.summary}
                        </p>
                      )}
                    </div>

                    {/* Evaluated content */}
                    {pe.evaluated_content && (
                      <JsonPanel title="Evaluated Content" data={pe.evaluated_content} />
                    )}

                    {/* Violations list */}
                    {pe.violations && pe.violations.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            Violations ({pe.violations.length})
                          </div>
                          <Button disabled>Modify</Button>
                        </div>
                        {(pe.violations ?? []).map((v, idx: number) => (
                          <div
                            key={idx}
                            className={[
                              "rounded-lg border p-3 space-y-1.5",
                              v.severity === "block"
                                ? "border-red-500/30 bg-red-500/5"
                                : v.severity === "warn"
                                  ? "border-yellow-500/30 bg-yellow-500/5"
                                  : "border-blue-500/30 bg-blue-500/5",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  v.severity === "block"
                                    ? "text-red-300 border-red-500/40"
                                    : v.severity === "warn"
                                      ? "text-yellow-300 border-yellow-500/40"
                                      : "text-blue-300 border-blue-500/40"
                                }`}
                              >
                                {(v.severity || "info").toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">
                                {v.rule_name || v.rule_id}
                              </span>
                            </div>
                            {v.policy_name && (
                              <div className="text-xs text-muted-foreground">
                                Policy: {v.policy_name}
                              </div>
                            )}
                            {v.rule_id && v.rule_id !== "implicit" && (
                              <div className="text-xs text-muted-foreground">
                                Rule ID:{" "}
                                <a
                                  href={`/api/knowledge-rules/${encodeURIComponent(v.rule_id)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono underline underline-offset-2 hover:text-foreground"
                                >
                                  {v.rule_id}
                                </a>
                                {v.library_name && ` · Library: ${v.library_name}`}
                              </div>
                            )}
                            <p className="text-sm">{v.reason}</p>
                            {v.suggestion && (
                              <p className="text-xs text-muted-foreground italic">
                                Suggestion: {v.suggestion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Response Envelope */}
                    <JsonPanel
                      title="Response Envelope"
                      data={{
                        jsonrpc: "2.0",
                        id: pe.message_id,
                        envelope_type: `policy.${pe.policy_type}`,
                        result: {
                          decision: pe.decision,
                          passed: pe.passed,
                          violations: pe.violations ?? [],
                          summary: pe.summary,
                          evaluation_time_ms: pe.evaluation_time_ms,
                        },
                      }}
                    />
                  </div>
                );
              })()}

            {/* ── LLM Response Ready Detail ── */}
            {isLlmResponse &&
              (() => {
                const lr = selectedPayload as {
                  reply?: string;
                  claude_model?: string;
                  timings_ms?: Record<string, number>;
                  original_message?: string;
                  message_id?: string;
                  trace_id?: string;
                };
                return (
                  <div className="space-y-4 mt-2">
                    <div className="rounded-lg border border-purple-500/50 bg-purple-500/10 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowDownLeft className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium">
                          Chat AI → Orch
                        </span>
                        <Badge className="bg-purple-600 text-white">
                          AI Response
                        </Badge>
                        {lr.claude_model && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {lr.claude_model}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI generated a response and sent it to the orchestration
                        system for output governance.
                      </p>
                      {lr.timings_ms && (
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {Object.entries(lr.timings_ms).map(([k, v]) => (
                            <span key={k}>
                              {k}: {v}ms
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {lr.original_message && (
                      <JsonPanel
                        title="Original Message"
                        data={lr.original_message}
                      />
                    )}
                    {lr.reply && <JsonPanel title="AI Reply" data={lr.reply} />}
                  </div>
                );
              })()}

            {/* ── External Event Detail ── */}
            {isExternalEvent &&
              (() => {
                const ev = selectedPayload as {
                  source?: string;
                  method?: string;
                  url?: string;
                  status_code?: number;
                  duration_ms?: number;
                  request_body?: string;
                  response_body?: string;
                };
                const isOk = !ev.status_code || ev.status_code < 400;
                return (
                  <div className="space-y-4 mt-2">
                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium">
                          {ev.source ?? "External"} → Orch
                        </span>
                        <Badge
                          className={`text-xs ${isOk ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}
                        >
                          {ev.method ?? "REQUEST"}
                          {ev.status_code ? ` ${ev.status_code}` : ""}
                        </Badge>
                        {ev.duration_ms != null && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {ev.duration_ms}ms
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground break-all">
                        {ev.url}
                      </p>
                    </div>
                    {ev.request_body && (
                      <JsonPanel title="Request Body" data={ev.request_body} />
                    )}
                    {ev.response_body && (
                      <JsonPanel title="Response Body" data={ev.response_body} />
                    )}
                  </div>
                );
              })()}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
