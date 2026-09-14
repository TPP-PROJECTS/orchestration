import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";

type ProvListItem = {
  event_id: string;
  envelope_type?: string | null;
};

type ProvEvent = {
  event_id: string;
  session_id?: string | null;
  trace_id?: string | null;
  timestamp?: string | null;
  actor?: string | null;
  module_id?: string | null;
  envelope_type?: string | null;
  input_ref?: Record<string, any>;
  output_ref?: unknown;
  policy_ref?: unknown;
  meta?: unknown;
  status?: "SUCCESS" | "ERROR" | string;
  prev_event_hash?: string | null;
  event_hash?: string | null;
  ledger_anchor?: string | null;
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
              className="text-white border-white hover:bg-white hover:text-black"
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

interface ProvenanceTabProps {
  apiBase: string;
}

export function ProvenanceTab({
  apiBase,
}: ProvenanceTabProps): React.JSX.Element {
  const [provList, setProvList] = React.useState<ProvListItem[]>([]);
  const [provListLoading, setProvListLoading] = React.useState(false);
  const [provListError, setProvListError] = React.useState<string | null>(null);

  const [selectedProvId, setSelectedProvId] = React.useState<string | null>(
    null,
  );

  const [provDetail, setProvDetail] = React.useState<ProvEvent | null>(null);
  const [provDetailLoading, setProvDetailLoading] = React.useState(false);
  const [provDetailError, setProvDetailError] = React.useState<string | null>(
    null,
  );

  const fetchProvList = React.useCallback(async () => {
    setProvListLoading(true);
    setProvListError(null);

    try {
      const res = await fetch(`${apiBase}/api/provenance?limit=200`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setProvList(items);

      if (!selectedProvId && items.length) {
        setSelectedProvId(items[0].event_id);
      }
    } catch (e: unknown) {
      setProvListError(e instanceof Error ? e.message : String(e));
      setProvList([]);
    } finally {
      setProvListLoading(false);
    }
  }, [apiBase, selectedProvId]);

  const fetchProvDetail = React.useCallback(
    async (eventId: string) => {
      setProvDetailLoading(true);
      setProvDetailError(null);

      try {
        const res = await fetch(`${apiBase}/api/provenance/${eventId}`);
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${txt}`);
        }
        const data = await res.json();
        setProvDetail(data);
      } catch (e: unknown) {
        setProvDetailError(e instanceof Error ? e.message : String(e));
        setProvDetail(null);
      } finally {
        setProvDetailLoading(false);
      }
    },
    [apiBase],
  );

  React.useEffect(() => {
    if (provListLoading) return;
    if (provList.length) return;
    void fetchProvList();
  }, [provList.length, provListLoading, fetchProvList]);

  React.useEffect(() => {
    if (!selectedProvId) return;
    void fetchProvDetail(selectedProvId);
  }, [selectedProvId, fetchProvDetail]);

  const renderProvRow = (item: ProvListItem) => {
    const isSelected = item.event_id === selectedProvId;
    const env =
      typeof item.envelope_type === "string" && item.envelope_type
        ? item.envelope_type
        : "-";

    const getBadgeColor = (envelopeType: string) => {
      switch (envelopeType) {
        case "hitlRequest":
          return "bg-orange-500/10 text-orange-300 border-orange-500/30";
        case "policyEvaluate":
          return "bg-blue-500/10 text-blue-300 border-blue-500/30";
        case "policyEvaluationResult": // ← 新增
          return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
        case "HITLDecisionEnvelope":
          return "bg-green-500/10 text-green-300 border-green-500/30";
        case "LLMRawResultEnvelope":
          return "bg-purple-500/10 text-purple-300 border-purple-500/30";
        case "FinalResponseEnvelope":
          return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
        default:
          return "bg-gray-500/10 text-gray-300 border-gray-500/30";
      }
    };

    return (
      <button
        key={item.event_id}
        onClick={() => setSelectedProvId(item.event_id)}
        className={[
          "w-full text-left rounded-lg px-3 py-2 border transition-colors",
          isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-sm font-medium break-words text-black">
            {item.event_id ?? "(no id)"}
          </div>
        </div>
        <div className="mt-1 text-xs text-gray-400 break-all">
          <Badge variant="outline" className={getBadgeColor(env)}>
            {env}
          </Badge>
        </div>
      </button>
    );
  };

  const prov = provDetail;
  const provInput = prov?.input_ref ?? null;
  const provOutput = prov?.output_ref ?? null;
  const provPolicy = prov?.policy_ref ?? null;
  const provMeta = prov?.meta ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Provenance Events</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {String(provList.length)}
              </Badge>
              <Button
                size="sm"
                onClick={() => void fetchProvList()}
                disabled={provListLoading}
              >
                {provListLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[calc(140vh-12rem)] w-full pr-3">
            <div className="space-y-2">
              {provListError ? (
                <div className="text-sm text-destructive p-3 whitespace-pre-wrap">
                  {provListError}
                </div>
              ) : null}

              {provListLoading && !provList.length ? (
                <div className="text-sm text-muted-foreground p-3">
                  Loading provenance list...
                </div>
              ) : null}

              {!provListLoading && !provList.length && !provListError ? (
                <div className="text-sm text-muted-foreground p-3">
                  No provenance events.
                </div>
              ) : null}

              {provList.map(renderProvRow)}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Provenance Details</CardTitle>
            {selectedProvId ? (
              <Badge variant="secondary" className="text-xs">
                {selectedProvId}
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!selectedProvId ? (
            <div className="text-sm text-muted-foreground">
              Select a provenance event.
            </div>
          ) : provDetailLoading && !provDetail ? (
            <div className="text-sm text-muted-foreground">
              Loading provenance detail...
            </div>
          ) : provDetailError ? (
            <div className="text-sm text-destructive whitespace-pre-wrap">
              {provDetailError}
            </div>
          ) : !prov ? (
            <div className="text-sm text-muted-foreground">
              No provenance detail loaded.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {prov.status ?? "UNKNOWN"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {prov.envelope_type ?? "envelope: -"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {prov.actor ? `actor: ${prov.actor}` : "actor: -"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {prov.module_id ? `module: ${prov.module_id}` : "module: -"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {prov.session_id
                    ? `session: ${prov.session_id}`
                    : "session: -"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {prov.trace_id ? `trace: ${prov.trace_id}` : "trace: -"}
                </Badge>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-muted/40">
                  {["overview", "input", "output", "policy", "meta"].map(
                    (v) => (
                      <TabsTrigger
                        key={v}
                        value={v}
                        className={ACTIVE_TAB_CLS}
                      >
                        {v[0].toUpperCase() + v.slice(1)}
                      </TabsTrigger>
                    ),
                  )}
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">
                          Envelope Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Envelope Type
                            </div>
                            <Badge variant="outline" className="text-sm">
                              {prov?.envelope_type || "Unknown"}
                            </Badge>
                          </div>

                          {prov?.envelope_type === "hitlRequest" &&
                            provInput?.envelope?.params && (
                              <>
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Reason
                                  </div>
                                  <div className="text-sm">
                                    {provInput.envelope.params.reason || "-"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Required Role
                                  </div>
                                  <Badge variant="secondary">
                                    {provInput.envelope.params.required_role ||
                                      "-"}
                                  </Badge>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Proposed Action
                                  </div>
                                  <div className="text-sm">
                                    {provInput.envelope.params
                                      .proposed_action || "-"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Risk Level
                                  </div>
                                  <Badge
                                    variant={
                                      provInput.envelope.params.risk === "high"
                                        ? "destructive"
                                        : provInput.envelope.params.risk ===
                                            "medium"
                                          ? "default"
                                          : "secondary"
                                    }
                                  >
                                    {provInput.envelope.params.risk || "-"}
                                  </Badge>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    User Message
                                  </div>
                                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
                                    {provInput.envelope.params.payload
                                      ?.message || "-"}
                                  </div>
                                </div>
                              </>
                            )}

                          {prov?.envelope_type === "policyEvaluate" &&
                            provInput?.envelope?.params && (
                              <>
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Action
                                  </div>
                                  <div className="text-sm">
                                    {provInput.envelope.params.action ||
                                      "(empty)"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Context
                                  </div>
                                  <pre className="text-xs overflow-auto rounded-md bg-muted p-3">
                                    {JSON.stringify(
                                      provInput.envelope.params.context || {},
                                      null,
                                      2,
                                    )}
                                  </pre>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Dry Run
                                  </div>
                                  <Badge
                                    variant={
                                      provInput.envelope.params.dry_run
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {provInput.envelope.params.dry_run
                                      ? "Yes"
                                      : "No"}
                                  </Badge>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    User Message
                                  </div>
                                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
                                    {provInput.envelope.params.payload
                                      ?.message || "-"}
                                  </div>
                                </div>
                              </>
                            )}

                          {prov?.envelope_type === "policyEvaluationResult" &&
                            provInput?.envelope?.params && (
                              <>
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Decision
                                  </div>
                                  <Badge
                                    variant={
                                      provInput.envelope.params.decision ===
                                      "ALLOW"
                                        ? "default"
                                        : "destructive"
                                    }
                                  >
                                    {provInput.envelope.params.decision}
                                  </Badge>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Requires HITL
                                  </div>
                                  <Badge
                                    variant={
                                      provInput.envelope.params.requires_hitl
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {provInput.envelope.params.requires_hitl
                                      ? "Yes"
                                      : "No"}
                                  </Badge>
                                </div>

                                {provInput.envelope.params.residual_risk && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Residual Risk
                                    </div>
                                    <Badge variant="outline">
                                      {provInput.envelope.params.residual_risk}
                                    </Badge>
                                  </div>
                                )}

                                {provInput.envelope.params
                                  .policy_binding_id && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Policy Binding ID
                                    </div>
                                    <div className="text-sm font-mono">
                                      {
                                        provInput.envelope.params
                                          .policy_binding_id
                                      }
                                    </div>
                                  </div>
                                )}

                                {provInput.envelope.params.constraints &&
                                  provInput.envelope.params.constraints.length >
                                    0 && (
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">
                                        Constraints
                                      </div>
                                      <div className="space-y-1">
                                        {provInput.envelope.params.constraints.map(
                                          (constraint: string, idx: number) => (
                                            <div key={idx} className="text-sm">
                                              • {constraint}
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    User Message
                                  </div>
                                  <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
                                    {provInput.original_message || "-"}
                                  </div>
                                </div>
                              </>
                            )}

                          {prov?.envelope_type &&
                            prov.envelope_type !== "hitlRequest" &&
                            prov.envelope_type !== "policyEvaluate" &&
                            prov.envelope_type !== "policyEvaluationResult" && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  Details
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  No specialized view for this envelope type.
                                  See Raw JSON below for complete details.
                                </div>
                              </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 完整的 Raw JSON */}
                    <Card>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm">
                            Complete Raw JSON
                          </CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-white border-white hover:bg-white hover:text-black"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                safeStringify(prov),
                              )
                            }
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <pre className="text-xs overflow-auto rounded-md bg-muted p-3 max-h-[600px]">
                          {safeStringify(prov)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="input" className="mt-3">
                  <JsonPanel title="input_ref" data={provInput} />
                </TabsContent>

                <TabsContent value="output" className="mt-3">
                  <JsonPanel title="output_ref" data={provOutput} />
                </TabsContent>

                <TabsContent value="policy" className="mt-3">
                  <JsonPanel title="policy_ref" data={provPolicy} />
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <JsonPanel title="meta" data={provMeta} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
