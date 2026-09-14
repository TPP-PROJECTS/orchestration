import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { LiveTab } from "./liveTab";
import { ProvenanceTab } from "./provenanceTab";
import { RegisterListTab } from "./register";
import { LogTab } from "./logTab";
import PolicyKnowledgeLibrary from "./PolicyKnowledgeLibrary/PolicyKnowledgeLibrary";

type ChatTrace = {
  id: string;
  createdAt: number;
  payload: unknown;
};

type PolicyEvaluation = {
  decision: string;
  passed: boolean;
  violations: Array<{
    policy_id: string;
    policy_name: string;
    rule_id: string;
    rule_name: string;
    severity: string;
    reason: string;
    suggestion?: string;
  }>;
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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="text-xs">
        {value}
      </Badge>
    </div>
  );
}

export function AdminDashboard({
  externalSelectedInfo,
  onSelectedIdChange,
  syncScroll,
  onSyncScrollChange,
  triggerLiveScroll,
  autoMode,
  onAutoModeChange,
}: {
  externalSelectedInfo?: {
    traceId: string;
    messageId?: string;
    role: "user" | "assistant";
  } | null;
  onSelectedIdChange?: (id: string | null) => void;
  syncScroll?: boolean;
  onSyncScrollChange?: (sync: boolean) => void;
  triggerLiveScroll?: number;
  autoMode?: boolean;
  onAutoModeChange?: (auto: boolean) => void;
}): React.JSX.Element {
  const API_BASE = "http://localhost:8000";

  const [traces, setTraces] = React.useState<ChatTrace[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"disconnected" | "connected">(
    "disconnected",
  );
  const [httpLogs, setHttpLogs] = React.useState<unknown[]>([]);
  const [activeTab, setActiveTab] = React.useState<
    "live" | "provenance" | "register" | "logs" | "policy"
  >("live");
  const selectedTraceRef = React.useRef<HTMLDivElement>(null);
  const handleLocalSelection = React.useCallback(
    (id: string | null) => {
      setSelectedId(id);
      onSelectedIdChange?.(null);
    },
    [onSelectedIdChange],
  );
  React.useEffect(() => {
    if (!externalSelectedInfo) return;

    const { traceId, messageId, role } = externalSelectedInfo;

    const matchedTrace = traces.find((t) => {
      const payload = t.payload as Record<string, unknown>;

      if (role === "user") {
        return (
          payload?.type === "message_approved" &&
          (payload?.message_id === messageId || payload?.trace_id === traceId)
        );
      }

      if (role === "assistant") {
        return (
          payload?.type === "hitl_decision" &&
          (payload?.message_id === messageId || payload?.trace_id === traceId)
        );
      }

      return false;
    });

    if (matchedTrace && matchedTrace.id !== selectedId) {
      setSelectedId(matchedTrace.id);
      setActiveTab("live");

      setTimeout(() => {
        selectedTraceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [externalSelectedInfo, traces]);

  const [hitlQueue, setHitlQueue] = React.useState<HITLRequest[]>([]);
  const [currentHitl, setCurrentHitl] = React.useState<HITLRequest | null>(
    null,
  );
  const [isRegenerating, setIsRegenerating] = React.useState<boolean>(false);

  const [secondaryReview, setSecondaryReview] = React.useState<{
    messageId: string;
    traceId: string;
    llmResponse: string;
    effectiveMessage: string;
    adminPrompt: string;
    outputPolicyEvaluation?: PolicyEvaluation | null;
  } | null>(null);
  const [editedContent, setEditedContent] = React.useState<string>("");
  const [editedAdminPrompt, setEditedAdminPrompt] = React.useState<string>("");
  const [regenerateError, setRegenerateError] = React.useState<string>("");

  React.useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/stream`);

    es.addEventListener("open", () => {
      setStatus("connected");
    });

    es.addEventListener("error", () => {
      setStatus("disconnected");
    });

    es.addEventListener("message", (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(evt.data));

        if (parsed.type === "client_message") {
          const isAutoMode = parsed.data?.meta?.auto_mode === true;

          // Always add to traces as the "Chat → Orch" first step
          const traceItem: ChatTrace = {
            id: `client-${parsed.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "client_message",
              trace_id: parsed.trace_id,
              message_id: parsed.message_id,
              message: parsed.data.message,
              history: parsed.data.history,
              meta: parsed.data.meta,
              timestamp: parsed.ts,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === traceItem.id);
            if (exists) return prev;
            const next = [traceItem, ...prev];
            return next.slice(0, 300);
          });

          if (!isAutoMode) {
            const req: HITLRequest = {
              message_id: parsed.message_id,
              trace_id: parsed.trace_id,
              message: parsed.data.message,
              history: parsed.data.history,
              meta: parsed.data.meta,
              timestamp: parsed.ts,
            };
            setHitlQueue((prev) => [...prev, req]);
          }
        }

        if (parsed.type === "message_approved") {
          const item: ChatTrace = {
            id: `approved-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "message_approved",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              decision: parsed.data.decision,
              reviewer: parsed.data.reviewer,
              original_message: parsed.data.original_message,
              effective_message: parsed.data.effective_message,
              admin_prompt: parsed.data.admin_prompt,
              timestamp: parsed.data.timestamp,
              claude_request: parsed.data.claude_request,
              meta: parsed.data.meta,
            },
          };

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === item.id);
            if (exists) return prev;
            const next = [item, ...prev];
            return next.slice(0, 300);
          });
        }

        if (parsed.type === "policy_evaluation") {
          const policyTrace: ChatTrace = {
            id: `policy-${parsed.data.message_id}-${parsed.data.policy_type}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "policy_evaluation",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              policy_type: parsed.data.policy_type,
              decision: parsed.data.decision,
              passed: parsed.data.passed,
              violations: parsed.data.violations,
              summary: parsed.data.summary,
              evaluation_time_ms: parsed.data.evaluation_time_ms,
              source: parsed.data.source,
              url: parsed.data.url,
              evaluated_content: parsed.data.evaluated_content,
            },
          };

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === policyTrace.id);
            if (exists) return prev;
            const next = [policyTrace, ...prev];
            return next.slice(0, 300);
          });

          // Attach input policy result to matching HITL request
          if (parsed.data.policy_type === "input") {
            const evalData: PolicyEvaluation = {
              decision: parsed.data.decision,
              passed: parsed.data.passed,
              violations: parsed.data.violations || [],
              summary: parsed.data.summary || "",
              evaluation_time_ms: parsed.data.evaluation_time_ms || 0,
              evaluated_policies: parsed.data.evaluated_policies || 0,
            };
            const targetMsgId = parsed.data.message_id;

            setCurrentHitl((prev) =>
              prev && prev.message_id === targetMsgId
                ? { ...prev, policyEvaluation: evalData }
                : prev,
            );
            setHitlQueue((prev) =>
              prev.map((r) =>
                r.message_id === targetMsgId
                  ? { ...r, policyEvaluation: evalData }
                  : r,
              ),
            );
          }
        }

        if (parsed.type === "policy_check_request") {
          const checkTrace: ChatTrace = {
            id: `policy-req-${parsed.data.message_id}-${parsed.data.policy_type}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "policy_check_request",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              policy_type: parsed.data.policy_type,
              envelope_type: parsed.data.envelope_type,
              action: parsed.data.action,
              context: parsed.data.context,
              payload: parsed.data.payload,
              dry_run: parsed.data.dry_run,
            },
          };

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === checkTrace.id);
            if (exists) return prev;
            const next = [checkTrace, ...prev];
            return next.slice(0, 300);
          });
        }

        if (parsed.type === "hitl_decision") {
          const decisionTrace: ChatTrace = {
            id: `decision-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "hitl_decision",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              decision: parsed.data.decision,
              reviewer: parsed.data.reviewer,
              reason: parsed.data.reason,
              original_message: parsed.data.original_message,
              timestamp: parsed.data.timestamp,
              review_type: parsed.data.review_type,
              edited_content: parsed.data.edited_content,
              approved_content: parsed.data.approved_content,
              llm_response: parsed.data.llm_response,
            },
          };

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === decisionTrace.id);
            if (exists) return prev;
            const next = [decisionTrace, ...prev];
            return next.slice(0, 300);
          });
        }

        if (parsed.type === "llm_response_ready") {
          const llmTrace: ChatTrace = {
            id: `llm-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "llm_response_ready",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              original_message: parsed.data.original_message,
              reply: parsed.data.reply,
              claude_model: parsed.data.claude_model,
              timings_ms: parsed.data.timings_ms,
              timestamp: parsed.data.timestamp,
            },
          };

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === llmTrace.id);
            if (exists) return prev;
            const next = [llmTrace, ...prev];
            return next.slice(0, 300);
          });
        }

        // Step 4a: Orch -> HITL (manual mode only)
        if (parsed.type === "hitl_request") {
          const trace: ChatTrace = {
            id: `hitl-req-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "hitl_request",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              message: parsed.data.message,
              input_policy_decision: parsed.data.input_policy_decision,
              input_policy_passed: parsed.data.input_policy_passed,
              timestamp: parsed.data.timestamp,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === trace.id);
            if (exists) return prev;
            return [trace, ...prev].slice(0, 300);
          });
        }

        // Step 4b: HITL -> Orch (admin input decision)
        if (parsed.type === "hitl_admin_decision_input") {
          const trace: ChatTrace = {
            id: `hitl-dec-in-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "hitl_admin_decision_input",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              decision: parsed.data.decision,
              reviewer: parsed.data.reviewer,
              reason: parsed.data.reason,
              override_message: parsed.data.override_message,
              admin_prompt: parsed.data.admin_prompt,
              timestamp: parsed.data.timestamp,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === trace.id);
            if (exists) return prev;
            return [trace, ...prev].slice(0, 300);
          });
        }

        // Step 8a: Orch -> HITL (secondary review request)
        if (parsed.type === "secondary_review_request") {
          const trace: ChatTrace = {
            id: `sec-req-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "secondary_review_request",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              llm_response: parsed.data.llm_response,
              output_policy_evaluation: parsed.data.output_policy_evaluation,
              timestamp: parsed.data.timestamp,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === trace.id);
            if (exists) return prev;
            return [trace, ...prev].slice(0, 300);
          });
        }

        // Step 8b: HITL -> Orch (admin output decision)
        if (parsed.type === "hitl_admin_decision_output") {
          const trace: ChatTrace = {
            id: `hitl-dec-out-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "hitl_admin_decision_output",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              action: parsed.data.action,
              reviewer: parsed.data.reviewer,
              reject_reason: parsed.data.reject_reason,
              edited_content: parsed.data.edited_content,
              timestamp: parsed.data.timestamp,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === trace.id);
            if (exists) return prev;
            return [trace, ...prev].slice(0, 300);
          });
        }

        if (parsed.type === "external_event") {
          const trace: ChatTrace = {
            id: `ext-${parsed.source}-${parsed.ts ?? Date.now()}`,
            createdAt: parsed.ts ?? Date.now(),
            payload: {
              type: "external_event",
              source: parsed.source,
              method: parsed.data?.method,
              url: parsed.data?.url,
              status_code: parsed.data?.status_code,
              duration_ms: parsed.data?.duration_ms,
              request_body: parsed.data?.request_body,
              response_body: parsed.data?.response_body,
            },
          };
          setTraces((prev) => {
            const exists = prev.some((t) => t.id === trace.id);
            if (exists) return prev;
            return [trace, ...prev].slice(0, 300);
          });
        }

      } catch {
        // ignore malformed SSE frames
      }
    });

    return () => {
      es.close();
    };
  }, [API_BASE]);

  React.useEffect(() => {
    if (currentHitl || hitlQueue.length === 0) return;

    const processNextHitl = async () => {
      const next = hitlQueue[0];
      setHitlQueue((prev) => prev.slice(1));

      try {
        await fetch(`${API_BASE}/api/provenance/raw-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: next.message_id,
            trace_id: next.trace_id,
            message: next.message,
            history: next.history || [],
            meta: next.meta || {},
          }),
        });
      } catch {
        // non-critical: provenance store failure doesn't block HITL flow
      }

      setCurrentHitl(next);
    };

    void processNextHitl();
  }, [currentHitl, hitlQueue.length, API_BASE]);

  const handleAllow = async (
    messageId: string,
    traceId: string,
    overrides?: { override_message?: string; admin_prompt?: string },
  ) => {
    const effectiveMsg =
      overrides?.override_message || currentHitl?.message || "";
    const adminPromptValue = overrides?.admin_prompt || "";
    setCurrentHitl(null);

    try {
      const response = await fetch(`/api/admin/decide/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          decision: "ALLOW",
          override_message: overrides?.override_message,
          admin_prompt: overrides?.admin_prompt,
        }),
      });

      if (!response.ok) return;

      const result = await response.json();

      if (result.status === "awaiting_secondary_review") {
        setSecondaryReview({
          messageId: messageId,
          traceId: traceId,
          llmResponse: result.llm_response,
          effectiveMessage: effectiveMsg,
          adminPrompt: adminPromptValue,
          outputPolicyEvaluation: result.output_policy_evaluation || null,
        });
        setEditedContent(result.llm_response);
        setEditedAdminPrompt(adminPromptValue);
        setRegenerateError("");
      }
    } catch {
      // ignore network errors for allow decision
    }
  };

  const handleRegenerate = async () => {
    if (!secondaryReview) return;

    setIsRegenerating(true);
    setRegenerateError("");

    try {
      const response = await fetch(
        `/api/admin/regenerate/${secondaryReview.messageId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: secondaryReview.messageId,
            trace_id: secondaryReview.traceId,
            message: secondaryReview.effectiveMessage,
            admin_prompt: editedAdminPrompt,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        const errorMsg = errorData.detail || `HTTP ${response.status}`;
        setRegenerateError(`Failed to regenerate: ${errorMsg}`);
        return;
      }

      const result = await response.json();

      setEditedContent(result.llm_response);

      setSecondaryReview((prev) =>
        prev
          ? {
              ...prev,
              adminPrompt: editedAdminPrompt,
            }
          : null,
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setRegenerateError(`Network error: ${errorMsg}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSecondaryReject = async (errorCode: string, reason: string) => {
    if (!secondaryReview) return;

    const { messageId, traceId } = secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "REJECT",
          error_code: errorCode,
          reject_reason: reason,
        }),
      });
    } catch {
      // ignore network errors for reject decision
    }
  };

  const handleSecondaryEdit = async () => {
    if (!secondaryReview) return;
    if (!editedContent.trim()) {
      setRegenerateError("Please provide edited content");
      return;
    }

    const { messageId, traceId, effectiveMessage } = secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "EDIT",
          edited_content: editedContent,
          effective_message: effectiveMessage,
          admin_prompt: editedAdminPrompt,
        }),
      });
    } catch {
      // ignore network errors for edit decision
    }
  };

  const handleSecondaryApprove = async () => {
    if (!secondaryReview) return;

    const { messageId, traceId, llmResponse, effectiveMessage } =
      secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "APPROVE",
          edited_content: llmResponse,
          effective_message: effectiveMessage,
          admin_prompt: editedAdminPrompt,
        }),
      });
    } catch {
      // ignore network errors for approve decision
    }
  };

  const handleReject = async (errorCode: string, reason: string) => {
    if (!currentHitl) return;

    setCurrentHitl(null);

    const messageId = currentHitl.message_id;
    const traceId = currentHitl.trace_id;

    try {
      await fetch(`/api/admin/decide/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          decision: "DENY",
          error_code: errorCode,
          reason: reason,
        }),
      });
    } catch {
      // ignore network errors for deny decision
    }
  };

  const handleSecondarySend = async () => {
    if (!secondaryReview) return;

    const { llmResponse } = secondaryReview;
    const finalContent = editedContent.trim();
    const originalContent = (llmResponse ?? "").trim();

    if (!finalContent) {
      setRegenerateError("Please provide content to send");
      return;
    }

    const isModified = finalContent !== originalContent;

    if (isModified) {
      await handleSecondaryEdit();
    } else {
      await handleSecondaryApprove();
    }
  };

  const fetchHttpLogs = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/logs?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setHttpLogs(data.logs || []);
      }
    } catch {
      // ignore network errors for log polling
    }
  }, [API_BASE]);

  React.useEffect(() => {
    fetchHttpLogs();

    const logsInterval = setInterval(fetchHttpLogs, 10000);

    return () => clearInterval(logsInterval);
  }, [fetchHttpLogs]);

  const onClear = React.useCallback(() => {
    setTraces([]);
    setSelectedId(null);
  }, []);

  const handleCloseSecondaryReview = () => {
    setSecondaryReview(null);
    setRegenerateError("");
  };

  return (
    <div className="h-screen p-4 md:p-8 bg-background overflow-y-auto">
      <div className="mx-auto max-w-full space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <div className="flex flex-wrap items-center gap-4">
              <StatChip label="Stream" value={status} />
              <StatChip label="Total Traces" value={String(traces.length)} />
              <StatChip label="HITL Queue" value={String(hitlQueue.length)} />
              {autoMode && (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-300 border-green-500/30"
                >
                  Auto Mode Active
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClear}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 bg-muted/40">
            <TabsTrigger
              value="live"
              className={ACTIVE_TAB_CLS}
            >
              Live
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className={ACTIVE_TAB_CLS}
            >
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="policy"
              className={ACTIVE_TAB_CLS}
            >
              Policy
            </TabsTrigger>
            <TabsTrigger
              value="provenance"
              className={ACTIVE_TAB_CLS}
            >
              Provenance
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className={ACTIVE_TAB_CLS}
            >
              Registry
            </TabsTrigger>
          </TabsList>

          {/* LIVE TAB */}
          <TabsContent value="live" className="mt-4">
            <LiveTab
              traces={traces}
              selectedId={selectedId}
              onSelectedIdChange={handleLocalSelection}
              currentHitl={currentHitl}
              hitlQueue={hitlQueue}
              onHandleAllow={handleAllow}
              onHandleReject={handleReject}
              secondaryReview={secondaryReview}
              onCloseSecondaryReview={handleCloseSecondaryReview}
              onHandleSecondaryReject={handleSecondaryReject}
              onHandleSecondarySend={handleSecondarySend}
              onHandleRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
              editedContent={editedContent}
              onEditedContentChange={setEditedContent}
              editedAdminPrompt={editedAdminPrompt}
              onEditedAdminPromptChange={setEditedAdminPrompt}
              regenerateError={regenerateError}
              onRegenerateErrorChange={setRegenerateError}
              syncScroll={syncScroll}
              onSyncScrollChange={onSyncScrollChange}
              triggerLiveScroll={triggerLiveScroll}
              autoMode={autoMode}
              onAutoModeChange={onAutoModeChange}
              logs={httpLogs as any}
              apiBase={API_BASE}
              onNavigateToLogs={() => setActiveTab("logs")}
            />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <LogTab apiBase={API_BASE} />
          </TabsContent>

          <TabsContent value="policy" className="mt-4">
            <PolicyKnowledgeLibrary />
          </TabsContent>

          <TabsContent value="provenance" className="mt-4">
            <ProvenanceTab apiBase={API_BASE} />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterListTab apiBase={API_BASE} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
