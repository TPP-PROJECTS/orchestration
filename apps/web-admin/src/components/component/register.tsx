import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Search,
  Plus,
  Settings,
  Trash2,
  Server,
  Brain,
  Database,
  Wrench,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  HelpCircle,
  Sparkles,
  Globe,
  Zap,
  FileCode,
  Link,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PolicyEngineConfig } from "./policyEngineConfig";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleMeta {
  version?: string;
  framework?: string;
  provider?: string;
  model?: string;
  database?: string;
  collection?: string;
  endpoint?: string;
  extra?: Record<string, unknown>;
}

interface RegistryModule {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  configurable: boolean;
  enabled: boolean;
  meta?: ModuleMeta;
  error_message?: string;
  explanation?: string;
}

interface RegistryCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  configurable: boolean;
  modules: RegistryModule[];
}

interface MCPToolInfo {
  name: string;
  description?: string;
  enabled: boolean;
  input_schema?: Record<string, unknown>;
  server_id: string;
  server_name: string;
  explanation?: string;
}

interface MCPServerWithTools {
  server_id: string;
  name: string;
  status: string;
  description?: string;
  script_path?: string;
  tools: MCPToolInfo[];
  tool_count: number;
  error_message?: string;
  explanation?: string;
}

interface MCPCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  configurable: boolean;
  servers: MCPServerWithTools[];
  total_tools: number;
  enabled_tools: number;
}

interface ExplanationTarget {
  name: string;
  type: "module" | "tool" | "server" | "external";
  explanation?: string;
  description?: string;
  trustWorthys?: string[];
  trustWorthyDescription?: string;
}

interface RegistryResponse {
  categories: RegistryCategory[];
  mcp?: MCPCategory;
  total_modules: number;
  total_tools: number;
}

interface LLMConfig {
  provider: string;
  model: string;
  api_key_configured: boolean;
  api_key_preview: string;
  max_tokens: number;
  available_models: string[];
}

interface DatabaseConfig {
  provider: string;
  uri_configured: boolean;
  uri_preview: string;
  database: string;
  collection: string;
  connected: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

interface RegisteredEngine {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  categories: unknown[];
  version: string;
  url: string;
  type: string;
  policies: unknown[];
  created_at: number;
  updated_at: number;
}

interface ExternalComponent {
  id: string;
  name: string;
  description?: string;
  connection_type: "http" | "ws" | "openclaw";
  endpoint: string;
  auth_token?: string;
  status: string;
  error_message?: string;
  trustWorthys?: string[];
  trustWorthyDescription?: string;
  explanation?: string;
  created_at: number;
  updated_at: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <Server className="h-5 w-5" />,
  extensions: <Wrench className="h-5 w-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500/10 text-green-400 border-green-500/30",
  connected: "bg-green-500/10 text-green-400 border-green-500/30",
  configured: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  disconnected: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  unknown: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const TRUSTWORTHY_OPTIONS = [
  { value: "interpretable", label: "Interpretable" },
  { value: "explainable", label: "Explainable" },
  { value: "case", label: "Case" },
];

function LLMConfigDialog({
  open,
  onOpenChange,
  apiBase,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  onSaved: () => void;
}) {
  const [config, setConfig] = React.useState<LLMConfig | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [showApiKey, setShowApiKey] = React.useState(false);

  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState(1200);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setTestResult(null);
      fetch(`${apiBase}/api/config/llm`)
        .then((res) => res.json())
        .then((data: LLMConfig) => {
          setConfig(data);
          setModel(data.model);
          setMaxTokens(data.max_tokens);
          setApiKey("");
        })
        .catch(() => { /* ignore config fetch errors */ })
        .finally(() => setLoading(false));
    }
  }, [open, apiBase]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (apiKey || model !== config?.model) {
        await fetch(`${apiBase}/api/config/llm`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey || undefined,
            model: model !== config?.model ? model : undefined,
          }),
        });
      }

      const res = await fetch(`${apiBase}/api/config/llm/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/config/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm: {
            api_key: apiKey || undefined,
            model: model !== config?.model ? model : undefined,
            max_tokens:
              maxTokens !== config?.max_tokens ? maxTokens : undefined,
          },
        }),
      });
      onSaved();
      onOpenChange(false);
    } catch {
      // save error is non-critical; dialog stays open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configure AI Model
          </DialogTitle>
          <DialogDescription>
            Configure your Anthropic Claude API settings
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : config ? (
          <div className="space-y-4 py-4">
            {/* Provider Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">Provider</div>
                <div className="text-sm text-muted-foreground">Anthropic</div>
              </div>
              <Badge
                variant="outline"
                className={
                  config.api_key_configured
                    ? STATUS_COLORS.configured
                    : STATUS_COLORS.disconnected
                }
              >
                {config.api_key_configured ? "Configured" : "Not Configured"}
              </Badge>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={
                      config.api_key_configured
                        ? `Current: ${config.api_key_preview}`
                        : "Enter API key"
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to keep current key. Get your key from{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  className="underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {config.available_models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min={1}
                max={8192}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1200)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum tokens in AI response (1-8192)
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-lg ${testResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={
                      testResult.success ? "text-green-400" : "text-red-400"
                    }
                  >
                    {testResult.message}
                  </span>
                </div>
                {testResult.latency_ms && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Latency: {testResult.latency_ms}ms
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ============ Explanation Dialog ============

function ExplanationDialog({
  open,
  onOpenChange,
  target,
  apiBase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ExplanationTarget | null;
  apiBase: string;
}) {
  const [aiText, setAiText] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  // Reset state when target changes
  React.useEffect(() => {
    if (target) {
      setAiText(target.explanation?.trim() || "");
      setEditing(false);
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  const hasContent = aiText.trim() !== "";

  const handleAskAI = async () => {
    setLoading(true);
    setError(null);
    try {
      const explainType = target.type === "external" ? "module" : target.type;
      const res = await fetch(`${apiBase}/api/registry/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: target.name,
          type: explainType,
          description: target.description,
          explanation: aiText || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiText(data.explanation || "");
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get AI explanation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400" />
            {target.name}
          </DialogTitle>
          <DialogDescription>
            {target.type === "module" && "Module — System Architecture & Trustworthy AI Role"}
            {target.type === "tool" && "MCP Tool — System Architecture & Trustworthy AI Role"}
            {target.type === "server" && "MCP Server — System Architecture & Trustworthy AI Role"}
            {target.type === "external" && "External Component — System Architecture & Trustworthy AI Role"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {/* Description */}
          {target.description && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Description</div>
              <p className="text-sm">{target.description}</p>
            </div>
          )}

          {(target.trustWorthys?.length || target.trustWorthyDescription) && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Trustworthy</div>
              {target.trustWorthys && target.trustWorthys.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {target.trustWorthys.map((item) => {
                    const option = TRUSTWORTHY_OPTIONS.find((opt) => opt.value === item);
                    return (
                      <Badge key={item} variant="outline" className="text-xs">
                        {option?.label || item}
                      </Badge>
                    );
                  })}
                </div>
              )}
              {target.trustWorthyDescription && (
                <p className="text-sm mt-2 whitespace-pre-wrap">
                  {target.trustWorthyDescription}
                </p>
              )}
            </div>
          )}

          {/* AI Explanation area */}
          <div className="rounded-lg border border-dashed">
            {/* Header row */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs font-medium text-muted-foreground">AI Explanation</span>
              </div>
              {hasContent && !loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "Preview" : "Edit"}
                </Button>
              )}
            </div>

            {/* Content */}
            <div className="px-3 pb-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                  <p className="text-sm text-muted-foreground">Asking AI about {target.name}...</p>
                </div>
              ) : error ? (
                <div className="text-sm text-destructive py-2">{error}</div>
              ) : hasContent ? (
                editing ? (
                  <Textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    className="text-sm min-h-[200px] font-mono"
                    placeholder="Edit the explanation..."
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiText}</p>
                )
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No explanation yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click <span className="font-medium">Ask AI</span> to generate one.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleAskAI}
            disabled={loading}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {hasContent ? "Regenerate" : "Ask AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Help Icon Button ============

function HelpIconButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 w-6 p-0 hover:bg-blue-500/10 ${className || ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-400 transition-colors" />
    </Button>
  );
}

// ============ Database Config Dialog ============

function DatabaseConfigDialog({
  open,
  onOpenChange,
  apiBase,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  onSaved: () => void;
}) {
  const [config, setConfig] = React.useState<DatabaseConfig | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [showUri, setShowUri] = React.useState(false);

  const [uri, setUri] = React.useState("");
  const [database, setDatabase] = React.useState("");
  const [collection, setCollection] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setTestResult(null);
      fetch(`${apiBase}/api/config/database`)
        .then((res) => res.json())
        .then((data: DatabaseConfig) => {
          setConfig(data);
          setDatabase(data.database);
          setCollection(data.collection);
          setUri("");
        })
        .catch(() => { /* ignore config fetch errors */ })
        .finally(() => setLoading(false));
    }
  }, [open, apiBase]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const updates: Record<string, string> = {};
      if (uri) updates.uri = uri;
      if (database !== config?.database) updates.database = database;
      if (collection !== config?.collection) updates.collection = collection;

      if (Object.keys(updates).length > 0) {
        await fetch(`${apiBase}/api/config/database`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }

      const res = await fetch(`${apiBase}/api/config/database/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/config/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: {
            uri: uri || undefined,
            database: database !== config?.database ? database : undefined,
            collection:
              collection !== config?.collection ? collection : undefined,
          },
        }),
      });
      onSaved();
      onOpenChange(false);
    } catch {
      // save error is non-critical; dialog stays open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Configure Database
          </DialogTitle>
          <DialogDescription>
            Configure your MongoDB connection settings
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : config ? (
          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">MongoDB</div>
                <div className="text-sm text-muted-foreground">
                  {config.uri_configured
                    ? config.uri_preview
                    : "Not configured"}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  config.connected
                    ? STATUS_COLORS.connected
                    : STATUS_COLORS.disconnected
                }
              >
                {config.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            {/* URI */}
            <div className="space-y-2">
              <Label>Connection URI</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showUri ? "text" : "password"}
                    placeholder={
                      config.uri_configured
                        ? "Leave empty to keep current"
                        : "mongodb://localhost:27017"
                    }
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowUri(!showUri)}
                  >
                    {showUri ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Database Name */}
            <div className="space-y-2">
              <Label>Database Name</Label>
              <Input
                placeholder="orch"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              />
            </div>

            {/* Collection Name */}
            <div className="space-y-2">
              <Label>Provenance Collection</Label>
              <Input
                placeholder="prov_events"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              />
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-lg ${testResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={
                      testResult.success ? "text-green-400" : "text-red-400"
                    }
                  >
                    {testResult.message}
                  </span>
                </div>
                {testResult.latency_ms && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Latency: {testResult.latency_ms}ms
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <p className="text-xs text-muted-foreground">
              Note: Restart the API server after saving to apply connection
              changes.
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Main Component ============

export function RegisterListTab({ apiBase }: { apiBase: string }) {
  const [registry, setRegistry] = React.useState<RegistryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedServers, setExpandedServers] = React.useState<Set<string>>(
    new Set(),
  );

  const [isAddMCPDialogOpen, setIsAddMCPDialogOpen] = React.useState(false);
  const [isLLMConfigOpen, setIsLLMConfigOpen] = React.useState(false);
  const [isDatabaseConfigOpen, setIsDatabaseConfigOpen] = React.useState(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = React.useState(false);
  const [newMCPServer, setNewMCPServer] = React.useState<{
    name: string;
    script_path: string;
    description: string;
    type?: string;
    endpoint?: string;
    auth_type?: string;
    auth_value?: string;
    webhook_url?: string;
    trigger_event?: string;
    runtime?: string;
  }>({
    name: "",
    script_path: "",
    description: "",
    type: "mcp-server",
  });
  const [isExplanationOpen, setIsExplanationOpen] = React.useState(false);
  const [explanationTarget, setExplanationTarget] =
    React.useState<ExplanationTarget | null>(null);
  const [serverToDelete, setServerToDelete] =
    React.useState<MCPServerWithTools | null>(null);

  // ── External Components state ──────────────────────────────────────────────
  const [externalComponents, setExternalComponents] = React.useState<ExternalComponent[]>([]);
  const [isAddExternalOpen, setIsAddExternalOpen] = React.useState(false);
  const [externalToDelete, setExternalToDelete] = React.useState<ExternalComponent | null>(null);
  const [testingExternal, setTestingExternal] = React.useState<string | null>(null);
  const [editingExternal, setEditingExternal] = React.useState<ExternalComponent | null>(null);
  const [editExternalForm, setEditExternalForm] = React.useState({
    name: "", description: "", endpoint: "", auth_token: "", connection_type: "http" as "http" | "ws" | "openclaw",
  });
  const [newExternal, setNewExternal] = React.useState({
    name: "",
    description: "",
    connection_type: "http" as "http" | "ws" | "openclaw",
    endpoint: "",
    auth_token: "",
    trustWorthys: [] as string[],
    trustWorthyDescription: "",
    domains: [] as string[],
    domainInput: "",
    policyFiles: [] as File[],
  });

  const fetchExternalComponents = React.useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/external/components`);
      if (res.ok) {
        const data = await res.json();
        setExternalComponents(data);
      }
    } catch {
      // ignore network errors
    }
  }, [apiBase]);

  React.useEffect(() => {
    void fetchExternalComponents();
  }, [fetchExternalComponents]);

  const handleRegisterExternal = async () => {
    try {
      const res = await fetch(`${apiBase}/api/external/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newExternal.name,
          description: newExternal.description || undefined,
          connection_type: newExternal.connection_type,
          endpoint: newExternal.endpoint,
          auth_token: newExternal.auth_token || undefined,
          trustWorthys: newExternal.trustWorthys.length > 0 ? newExternal.trustWorthys : undefined,
          trustWorthyDescription: newExternal.trustWorthyDescription || undefined,
          domains: newExternal.domains.length > 0 ? newExternal.domains : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        // Upload internal policy documents — each file becomes one Policy Library
        // parsed by LLM via /api/policy-libraries/import
        if (newExternal.policyFiles.length > 0) {
          await Promise.all(
            newExternal.policyFiles.map((f) => {
              const form = new FormData();
              form.append("file", f);
              form.append("tier", "internal");
              form.append("inference_model", "general_llm");
              form.append("component_id", data.id);
              form.append("component_name", newExternal.name);
              return fetch(`${apiBase}/api/policy-libraries/import`, {
                method: "POST",
                body: form,
              });
            }),
          );
        }
        await fetchExternalComponents();
        setIsAddExternalOpen(false);
        setNewExternal({
          name: "",
          description: "",
          connection_type: "http",
          endpoint: "",
          auth_token: "",
          trustWorthys: [],
          trustWorthyDescription: "",
          domains: [],
          domainInput: "",
          policyFiles: [],
        });
      }
    } catch {
      // ignore errors
    }
  };

  const handleDeleteExternal = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/external/components/${id}`, { method: "DELETE" });
      await fetchExternalComponents();
      setExternalToDelete(null);
    } catch {
      // ignore errors
    }
  };

  const handleTestExternal = async (id: string) => {
    setTestingExternal(id);
    try {
      await fetch(`${apiBase}/api/external/components/${id}/test`, { method: "POST" });
      await fetchExternalComponents();
    } catch {
      // ignore errors
    } finally {
      setTestingExternal(null);
    }
  };

  const openEditExternal = (comp: ExternalComponent) => {
    setEditingExternal(comp);
    setEditExternalForm({
      name: comp.name,
      description: comp.description ?? "",
      endpoint: comp.endpoint,
      auth_token: comp.auth_token ?? "",
      connection_type: comp.connection_type,
    });
  };

  const handleUpdateExternal = async () => {
    if (!editingExternal) return;
    try {
      const res = await fetch(`${apiBase}/api/external/components/${editingExternal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editExternalForm.name || undefined,
          description: editExternalForm.description || undefined,
          endpoint: editExternalForm.endpoint || undefined,
          auth_token: editExternalForm.auth_token || undefined,
          connection_type: editExternalForm.connection_type,
        }),
      });
      if (res.ok) {
        await fetchExternalComponents();
        setEditingExternal(null);
      }
    } catch {
      // ignore errors
    }
  };

  const fetchRegistry = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/registry`);
      if (response.ok) {
        const data = await response.json();

        const infraCategory = data.categories.find(
          (c: RegistryCategory) => c.id === "infrastructure",
        );
        const dbCategory = data.categories.find(
          (c: RegistryCategory) =>
            c.id === "database" ||
            c.id === "data-store" ||
            c.id === "datastore" ||
            c.name?.toLowerCase().includes("data"),
        );

        if (infraCategory && dbCategory) {
          infraCategory.modules = [
            ...infraCategory.modules,
            ...dbCategory.modules,
          ];
          data.categories = data.categories.filter(
            (c: RegistryCategory) =>
              c.id !== "database" &&
              c.id !== "data-store" &&
              c.id !== "datastore" &&
              !c.name?.toLowerCase().includes("data store"),
          );
        }

        setRegistry(data);
        if (data.mcp?.servers) {
          const serversWithTools = data.mcp.servers
            .filter((s: MCPServerWithTools) => s.tools.length > 0)
            .map((s: MCPServerWithTools) => s.server_id);
          setExpandedServers(new Set(serversWithTools));
        }
      }
    } catch {
      // ignore network errors for registry fetch
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => {
    void fetchRegistry();
  }, [fetchRegistry]);

  const toggleServerExpanded = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const handleToggleServer = async (serverId: string, connect: boolean) => {
    try {
      const endpoint = connect ? "connect" : "disconnect";
      await fetch(
        `${apiBase}/api/modules/mcp-servers/${serverId}/${endpoint}`,
        {
          method: "POST",
        },
      );
      await fetchRegistry();
    } catch {
      // ignore toggle server errors
    }
  };

  const handleToggleTool = async (
    serverId: string,
    toolName: string,
    enabled: boolean,
  ) => {
    try {
      await fetch(
        `${apiBase}/api/modules/mcp-servers/${serverId}/tools/${toolName}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      await fetchRegistry();
    } catch {
      // ignore toggle tool errors
    }
  };

  const handleRegisterMCPServer = async () => {
    try {
      const response = await fetch(`${apiBase}/api/modules/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: `mcp-${Date.now()}`,
          name: newMCPServer.name,
          script_path: newMCPServer.script_path,
          description: newMCPServer.description,
        }),
      });
      if (response.ok) {
        await fetchRegistry();
        setIsAddMCPDialogOpen(false);
        setNewMCPServer({ name: "", script_path: "", description: "" });
      }
    } catch {
      // ignore register MCP server errors
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await fetch(`${apiBase}/api/modules/mcp-servers/${serverId}`, {
        method: "DELETE",
      });
      await fetchRegistry();
      setServerToDelete(null);
    } catch {
      // ignore delete server errors
    }
  };

  const filterTools = (tools: MCPToolInfo[]) => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  };

  const getStatusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={STATUS_COLORS[status] || STATUS_COLORS.unknown}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );

  const handleOpenExplanation = (target: ExplanationTarget) => {
    setExplanationTarget(target);
    setIsExplanationOpen(true);
  };


  const mockPolicyEngines: RegisteredEngine[] = [
    {
      id: "security",
      name: "Security Policies",
      status: "running",
      description: "Security policies for infrastructure protection",
      category: "security",
      categories: [
        {
          id: "input_validation",
          name: "Input Validation",
          rules: [
            {
              id: "rule1",
              name: "Sanitize User Input",
              description: "Ensures all user input is properly sanitized",
              severity: "high",
              content:
                "All user input must be validated and sanitized before processing",
            },
            {
              id: "rule2",
              name: "SQL Injection Prevention",
              description: "Prevents SQL injection attacks",
              severity: "critical",
              content: "Use parameterized queries or prepared statements",
            },
          ],
        },
        {
          id: "access_control",
          name: "Access Control",
          rules: [
            {
              id: "rule3",
              name: "Principle of Least Privilege",
              description: "Apply minimum necessary privileges",
              severity: "medium",
              content: "Grant minimal permissions required for the task",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol1",
          name: "Web Security Policy",
          rules: [
            {
              id: "rule1",
              name: "XSS Prevention",
              description: "Prevents cross-site scripting attacks",
              severity: "high",
              content: "Sanitize all output and encode special characters",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/security",
      type: "security",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    {
      id: "output",
      name: "Output Policies",
      status: "running",
      description: "Policies for managing system outputs",
      category: "output",
      categories: [
        {
          id: "data_export",
          name: "Data Export",
          rules: [
            {
              id: "rule4",
              name: "Data Format Validation",
              description: "Validates data formats for exports",
              severity: "medium",
              content: "Ensure data is formatted correctly before export",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol2",
          name: "Export Policy",
          rules: [
            {
              id: "rule5",
              name: "Sensitive Data Redaction",
              description: "Redacts sensitive information",
              severity: "high",
              content: "Redact PII and sensitive data before export",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/output",
      type: "output",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    {
      id: "system",
      name: "System Policies",
      status: "running",
      description: "Core system policies",
      category: "infrastructure",
      categories: [
        {
          id: "infrastructure",
          name: "Infrastructure",
          rules: [
            {
              id: "rule6",
              name: "Resource Utilization",
              description: "Monitors resource usage",
              severity: "low",
              content: "Maintain resource utilization below 80% threshold",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol3",
          name: "System Health Policy",
          rules: [
            {
              id: "rule7",
              name: "Health Check Frequency",
              description: "Defines health check intervals",
              severity: "medium",
              content: "Perform health checks at 5-minute intervals",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/system",
      type: "system",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  ];

  const fetchEngines = React.useCallback(async () => {
    try {
      // 使用模拟数据而不是API调用
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch {
    } finally {
    }
  }, [apiBase]);

  React.useEffect(() => {
    if (isEngineModalOpen) fetchEngines();
  }, [isEngineModalOpen, fetchEngines]);

  const handleSettingsClick = (moduleId: string) => {
    if (moduleId === "claude-api") {
      setIsLLMConfigOpen(true);
    } else if (moduleId === "mongodb") {
      setIsDatabaseConfigOpen(true);
    }
  };

  React.useEffect(() => {
    if (!isEngineModalOpen) return;

    setTimeout(() => {}, 500);
  }, [isEngineModalOpen, apiBase, mockPolicyEngines]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{registry?.total_modules ?? "—"}</div>
            <div className="text-sm text-muted-foreground">Total Modules</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">
              {registry?.mcp?.servers.length ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">MCP Servers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">
              {registry?.total_tools ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">Total Tools</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">
              {registry?.mcp?.enabled_tools ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">Enabled Tools</div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchRegistry}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* System Categories */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">System Components</h2>
        {!registry && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading system components...</span>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(registry?.categories ?? []).map((category) => (
            <Card key={category.id} className="flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  {CATEGORY_ICONS[category.id] || (
                    <Server className="h-5 w-5" />
                  )}
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {!category.configurable && (
                    <Badge variant="outline" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <CardDescription className="text-xs">
                    {category.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0 flex-1 overflow-y-auto max-h-[300px]">
                <div className="space-y-2">
                  {category.modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {module.name}
                          </span>
                          {getStatusBadge(module.status)}
                          <HelpIconButton
                            onClick={() =>
                              handleOpenExplanation({
                                name: module.name,
                                type: "module",
                                explanation: module.explanation,
                                description: module.description,
                              })
                            }
                          />
                        </div>
                        {module.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {module.description}
                          </p>
                        )}
                        {module.meta && (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {module.meta.model && (
                              <Badge variant="outline" className="text-xs">
                                {module.meta.model}
                              </Badge>
                            )}
                            {module.meta.framework && (
                              <Badge variant="outline" className="text-xs">
                                {module.meta.framework}
                              </Badge>
                            )}
                            {module.meta.database && (
                              <Badge variant="outline" className="text-xs">
                                DB: {module.meta.database}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {module.configurable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSettingsClick(module.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Tooling Category - MCP Servers */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  <CardTitle className="text-base">Tooling</CardTitle>
                </div>
                <Button size="sm" onClick={() => setIsAddMCPDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tools
                </Button>
              </div>
              <CardDescription className="text-xs">
                External tools and MCP server integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-y-auto max-h-[300px]">
              <div className="space-y-2">
                {/* MCP Servers Section */}
                {registry?.mcp && registry.mcp.servers.length > 0 ? (
                  registry.mcp.servers.map((server) => {
                    const isExpanded = expandedServers.has(server.server_id);
                    const filteredTools = filterTools(server.tools);
                    const isConnected = server.status === "connected";

                    return (
                      <Collapsible
                        key={server.server_id}
                        open={isExpanded}
                        onOpenChange={() =>
                          toggleServerExpanded(server.server_id)
                        }
                      >
                        <div className="rounded-lg bg-muted/50 overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/70 transition-colors">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="font-medium text-sm truncate">
                                  {server.name}
                                </span>
                                {getStatusBadge(server.status)}
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {server.tool_count} tools
                                </Badge>
                                <HelpIconButton
                                  onClick={() =>
                                    handleOpenExplanation({
                                      name: server.name,
                                      type: "server",
                                      explanation: server.explanation,
                                      description: server.description,
                                    })
                                  }
                                />
                              </div>
                              <div
                                className="flex items-center gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() =>
                                    handleToggleServer(
                                      server.server_id,
                                      !isConnected,
                                    )
                                  }
                                >
                                  {isConnected ? (
                                    <PowerOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => setServerToDelete(server)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-2 pb-2 pt-1 border-t border-muted">
                              {server.description && (
                                <p className="text-xs text-muted-foreground mb-2 pl-6">
                                  {server.description}
                                </p>
                              )}
                              {server.error_message && (
                                <div className="mb-2 mx-6 p-2 rounded bg-red-500/10 text-red-400 text-xs">
                                  {server.error_message}
                                </div>
                              )}
                              {filteredTools.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">
                                  {searchQuery
                                    ? "No matching tools"
                                    : "No tools available"}
                                </p>
                              ) : (
                                <div className="space-y-1 pl-6">
                                  {filteredTools.map((tool) => (
                                    <div
                                      key={`${server.server_id}-${tool.name}`}
                                      className="flex items-center justify-between p-2 rounded bg-background/50 hover:bg-background transition-colors"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <code className="font-medium text-xs">
                                            {tool.name}
                                          </code>
                                          {!tool.enabled && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs bg-gray-500/10"
                                            >
                                              Off
                                            </Badge>
                                          )}
                                          <HelpIconButton
                                            onClick={() =>
                                              handleOpenExplanation({
                                                name: tool.name,
                                                type: "tool",
                                                explanation: tool.explanation,
                                                description: tool.description,
                                              })
                                            }
                                          />
                                        </div>
                                        {tool.description && (
                                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {tool.description}
                                          </p>
                                        )}
                                      </div>
                                      <Switch
                                        checked={tool.enabled}
                                        onCheckedChange={(checked) =>
                                          handleToggleTool(
                                            server.server_id,
                                            tool.name,
                                            checked,
                                          )
                                        }
                                        className="data-[state=unchecked]:bg-zinc-600 data-[state=checked]:bg-zinc-200 data-[state=checked]:border-black data-[state=unchecked]:border-black"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Wrench className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No MCP servers registered
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setIsAddMCPDialogOpen(true)}
                    >
                      Add your first MCP server
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* External Components Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">External Components</h2>
          <Button size="sm" onClick={() => setIsAddExternalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Register Component
          </Button>
        </div>

        {externalComponents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <ExternalLink className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No external components registered</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Register an external project or component to route chat messages through it with governance applied.
              </p>
              <Button variant="link" size="sm" className="mt-2" onClick={() => setIsAddExternalOpen(true)}>
                Register your first component
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {externalComponents.map((comp) => (
              <Card key={comp.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{comp.name}</span>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[comp.status] || STATUS_COLORS.unknown}
                        >
                          {comp.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono uppercase">
                          {comp.connection_type}
                        </Badge>
                      </div>
                      {comp.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{comp.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{comp.endpoint}</p>
                      {comp.error_message && (
                        <p className="text-xs text-red-400 mt-1 truncate">{comp.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <HelpIconButton
                        onClick={() =>
                          handleOpenExplanation({
                            name: comp.name,
                            type: "external",
                            description: comp.description,
                            explanation: comp.explanation,
                            trustWorthys: comp.trustWorthys,
                            trustWorthyDescription: comp.trustWorthyDescription,
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={testingExternal === comp.id}
                        onClick={() => handleTestExternal(comp.id)}
                        title="Test connection"
                      >
                        {testingExternal === comp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : comp.status === "connected" ? (
                          <Link className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Unlink className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => openEditExternal(comp)}
                        title="Edit component"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setExternalToDelete(comp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: <span className="font-mono">{comp.id}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Config Dialogs */}
      <LLMConfigDialog
        open={isLLMConfigOpen}
        onOpenChange={setIsLLMConfigOpen}
        apiBase={apiBase}
        onSaved={fetchRegistry}
      />
      <DatabaseConfigDialog
        open={isDatabaseConfigOpen}
        onOpenChange={setIsDatabaseConfigOpen}
        apiBase={apiBase}
        onSaved={fetchRegistry}
      />
      {/* 删除重复的弹窗，使用下面的弹窗 */}

      {/* Policy Engine Config Dialog */}
      <PolicyEngineConfig
        open={isEngineModalOpen}
        onOpenChange={setIsEngineModalOpen}
        apiBase={apiBase}
      />

      <ExplanationDialog
        open={isExplanationOpen}
        onOpenChange={setIsExplanationOpen}
        target={explanationTarget}
        apiBase={apiBase}
      />

      {/* Add External Tool Dialog */}
      <Dialog open={isAddMCPDialogOpen} onOpenChange={setIsAddMCPDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register External Tool</DialogTitle>
            <DialogDescription>
              Add a new external tool or integration to your system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tool Type Selection */}
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <Select
                value={newMCPServer.type || "mcp-server"}
                onValueChange={(v) =>
                  setNewMCPServer({ ...newMCPServer, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tool type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcp-server">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span>MCP Server</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rest-api">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>REST API</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="webhook">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span>Webhook</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="custom-script">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      <span>Custom Script</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Common: Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder={
                  newMCPServer.type === "rest-api"
                    ? "e.g., Weather API"
                    : newMCPServer.type === "webhook"
                      ? "e.g., Slack Notification"
                      : newMCPServer.type === "custom-script"
                        ? "e.g., Data Processor"
                        : "e.g., Medical Calculator"
                }
                value={newMCPServer.name}
                onChange={(e) =>
                  setNewMCPServer({ ...newMCPServer, name: e.target.value })
                }
              />
            </div>

            {/* MCP Server Fields */}
            {(!newMCPServer.type || newMCPServer.type === "mcp-server") && (
              <div className="space-y-2">
                <Label htmlFor="script_path">Script Path</Label>
                <Input
                  id="script_path"
                  placeholder="/path/to/mcp_server.py"
                  value={newMCPServer.script_path}
                  onChange={(e) =>
                    setNewMCPServer({
                      ...newMCPServer,
                      script_path: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Path to the Python MCP server script
                </p>
              </div>
            )}

            {/* REST API Fields */}
            {newMCPServer.type === "rest-api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    placeholder="https://api.example.com/v1"
                    value={newMCPServer.endpoint || ""}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        endpoint: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authentication</Label>
                  <Select
                    value={newMCPServer.auth_type || "none"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, auth_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Authentication</SelectItem>
                      <SelectItem value="api-key">API Key</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newMCPServer.auth_type &&
                  newMCPServer.auth_type !== "none" && (
                    <div className="space-y-2">
                      <Label htmlFor="auth_value">
                        {newMCPServer.auth_type === "api-key"
                          ? "API Key"
                          : newMCPServer.auth_type === "bearer"
                            ? "Bearer Token"
                            : "Credentials (user:password)"}
                      </Label>
                      <Input
                        id="auth_value"
                        type="password"
                        placeholder={
                          newMCPServer.auth_type === "basic"
                            ? "username:password"
                            : "Enter your key or token"
                        }
                        value={newMCPServer.auth_value || ""}
                        onChange={(e) =>
                          setNewMCPServer({
                            ...newMCPServer,
                            auth_value: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
              </>
            )}

            {/* Webhook Fields */}
            {newMCPServer.type === "webhook" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    placeholder="https://hooks.example.com/webhook"
                    value={newMCPServer.webhook_url || ""}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        webhook_url: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Events</Label>
                  <Select
                    value={newMCPServer.trigger_event || "on-response"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, trigger_event: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on-response">
                        On AI Response
                      </SelectItem>
                      <SelectItem value="on-input">On User Input</SelectItem>
                      <SelectItem value="on-error">On Error</SelectItem>
                      <SelectItem value="on-approval">
                        On HITL Approval
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Custom Script Fields */}
            {newMCPServer.type === "custom-script" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="script_path">Script Path</Label>
                  <Input
                    id="script_path"
                    placeholder="/path/to/script.py"
                    value={newMCPServer.script_path}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        script_path: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Runtime Environment</Label>
                  <Select
                    value={newMCPServer.runtime || "python"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, runtime: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="node">Node.js</SelectItem>
                      <SelectItem value="shell">Shell / Bash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Common: Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of this tool"
                value={newMCPServer.description}
                onChange={(e) =>
                  setNewMCPServer({
                    ...newMCPServer,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMCPDialogOpen(false);
                setNewMCPServer({
                  name: "",
                  script_path: "",
                  description: "",
                  type: "mcp-server",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegisterMCPServer}
              disabled={
                !newMCPServer.name ||
                ((!newMCPServer.type || newMCPServer.type === "mcp-server") &&
                  !newMCPServer.script_path) ||
                (newMCPServer.type === "rest-api" && !newMCPServer.endpoint) ||
                (newMCPServer.type === "webhook" &&
                  !newMCPServer.webhook_url) ||
                (newMCPServer.type === "custom-script" &&
                  !newMCPServer.script_path)
              }
            >
              Register Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!serverToDelete}
        onOpenChange={() => setServerToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{serverToDelete?.name}"? This
              will remove the server and all its tools from the registry.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServerToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                serverToDelete && handleDeleteServer(serverToDelete.server_id)
              }
            >
              Delete Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register External Component Dialog */}
      <Dialog open={isAddExternalOpen} onOpenChange={setIsAddExternalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Register External Component
            </DialogTitle>
            <DialogDescription>
              Register an external project or service. Messages from Chat Simulation will be
              governed and forwarded to this component's HTTP endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ext-name">Name</Label>
              <Input
                id="ext-name"
                placeholder="e.g., OpenClaw, My Agent"
                value={newExternal.name}
                onChange={(e) => setNewExternal({ ...newExternal, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <div className="flex gap-2">
                {(["http", "ws", "openclaw"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewExternal({ ...newExternal, connection_type: t })}
                    className={[
                      "flex-1 rounded-md border px-3 py-1.5 text-sm font-mono transition-colors",
                      newExternal.connection_type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    ].join(" ")}
                  >
                    {t === "openclaw" ? "OpenClaw" : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {newExternal.connection_type === "http"
                  ? "HTTP: endpoint receives POST with { message, trace_id } and returns { reply }"
                  : newExternal.connection_type === "ws"
                  ? "WebSocket: server receives JSON { message, trace_id } and sends back { reply }"
                  : "OpenClaw: connects to an OpenClaw Gateway using the proprietary WS protocol with device pairing"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-endpoint">
                {newExternal.connection_type === "http"
                  ? "HTTP"
                  : newExternal.connection_type === "ws"
                  ? "WebSocket"
                  : "OpenClaw Gateway WS"}{" "}
                Endpoint
              </Label>
              <Input
                id="ext-endpoint"
                placeholder={
                  newExternal.connection_type === "http"
                    ? "http://localhost:3000/chat"
                    : newExternal.connection_type === "ws"
                    ? "ws://localhost:3000/ws"
                    : "ws://127.0.0.1:18789"
                }
                value={newExternal.endpoint}
                onChange={(e) => setNewExternal({ ...newExternal, endpoint: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-auth">Bearer Token (Optional)</Label>
              <Input
                id="ext-auth"
                type="password"
                placeholder="Leave empty if no auth required"
                value={newExternal.auth_token}
                onChange={(e) => setNewExternal({ ...newExternal, auth_token: e.target.value })}
              />
            </div>
            {/* External Policy Domains */}
            <div className="space-y-2">
              <Label>Policy Domains (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Describe the domains this component operates in. The system will automatically search for
                applicable <span className="font-medium">external regulations</span> (e.g. GDPR, HIPAA, FERPA)
                and store them as policy rules.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder='e.g. "K-12 student data privacy" or "medical AI diagnostics"'
                  value={newExternal.domainInput}
                  onChange={(e) => setNewExternal({ ...newExternal, domainInput: e.target.value })}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && newExternal.domainInput.trim()) {
                      e.preventDefault();
                      const tag = newExternal.domainInput.trim().replace(/,$/, "");
                      if (tag && !newExternal.domains.includes(tag)) {
                        setNewExternal((prev) => ({
                          ...prev,
                          domains: [...prev.domains, tag],
                          domainInput: "",
                        }));
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 px-3 py-1 text-sm rounded border border-input bg-background hover:bg-accent disabled:opacity-40"
                  disabled={!newExternal.domainInput.trim()}
                  onClick={() => {
                    const tag = newExternal.domainInput.trim();
                    if (tag && !newExternal.domains.includes(tag)) {
                      setNewExternal((prev) => ({
                        ...prev,
                        domains: [...prev.domains, tag],
                        domainInput: "",
                      }));
                    }
                  }}
                >
                  Add
                </button>
              </div>
              {newExternal.domains.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {newExternal.domains.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() =>
                          setNewExternal((prev) => ({
                            ...prev,
                            domains: prev.domains.filter((_, j) => j !== i),
                          }))
                        }
                        className="hover:text-destructive"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Trustworthy Options</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRUSTWORTHY_OPTIONS.map((option) => {
                  const checked = newExternal.trustWorthys.includes(option.value);
                  return (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const isChecked = value === true;
                          setNewExternal((prev) => ({
                            ...prev,
                            trustWorthys: isChecked
                              ? [...prev.trustWorthys, option.value]
                              : prev.trustWorthys.filter((item) => item !== option.value),
                          }));
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-trust-desc">Trustworthy Description (Optional)</Label>
              <Textarea
                id="ext-trust-desc"
                placeholder="Describe the trustworthy aspects of this component"
                value={newExternal.trustWorthyDescription}
                onChange={(e) =>
                  setNewExternal({ ...newExternal, trustWorthyDescription: e.target.value })
                }
                className="min-h-[90px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-desc">Description (Optional)</Label>
              <Input
                id="ext-desc"
                placeholder="Brief description of this component"
                value={newExternal.description}
                onChange={(e) => setNewExternal({ ...newExternal, description: e.target.value })}
              />
            </div>
            {/* Internal Policy Documents */}
            <div className="space-y-2">
              <Label>Internal Policy Documents (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Upload your organization's policy files (e.g. school handbook, company code of conduct).
                These become <span className="font-medium">internal-tier</span> rules evaluated against every message this component sends or receives.
                Accepted: .txt, .md, .pdf (text)
              </p>
              <div
                className="border-2 border-dashed border-muted rounded-md p-4 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById("policy-file-input")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = Array.from(e.dataTransfer.files);
                  setNewExternal((prev) => ({
                    ...prev,
                    policyFiles: [...prev.policyFiles, ...dropped],
                  }));
                }}
              >
                <input
                  id="policy-file-input"
                  type="file"
                  multiple
                  accept=".txt,.md,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    setNewExternal((prev) => ({
                      ...prev,
                      policyFiles: [...prev.policyFiles, ...selected],
                    }));
                    e.target.value = "";
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Click or drag &amp; drop policy files here
                </p>
              </div>
              {newExternal.policyFiles.length > 0 && (
                <ul className="space-y-1 mt-1">
                  {newExternal.policyFiles.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="truncate max-w-[220px]">{f.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                        onClick={() =>
                          setNewExternal((prev) => ({
                            ...prev,
                            policyFiles: prev.policyFiles.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          </div>{/* end scroll wrapper */}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddExternalOpen(false);
                setNewExternal({
                  name: "",
                  description: "",
                  connection_type: "http",
                  endpoint: "",
                  auth_token: "",
                  trustWorthys: [],
                  trustWorthyDescription: "",
                  domains: [],
                  domainInput: "",
                  policyFiles: [],
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegisterExternal}
              disabled={!newExternal.name || !newExternal.endpoint}
            >
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit External Component Dialog */}
      <Dialog open={!!editingExternal} onOpenChange={(o) => { if (!o) setEditingExternal(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit External Component</DialogTitle>
            <DialogDescription>Update the registration details for this component.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editExternalForm.name} onChange={(e) => setEditExternalForm({ ...editExternalForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <div className="flex gap-2">
                {(["http", "ws", "openclaw"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={editExternalForm.connection_type === t ? "default" : "outline"}
                    onClick={() => setEditExternalForm({ ...editExternalForm, connection_type: t })}
                  >
                    {t.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input value={editExternalForm.endpoint} onChange={(e) => setEditExternalForm({ ...editExternalForm, endpoint: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bearer Token (Optional)</Label>
              <Input type="password" value={editExternalForm.auth_token} onChange={(e) => setEditExternalForm({ ...editExternalForm, auth_token: e.target.value })} placeholder="Leave empty to keep unchanged" />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input value={editExternalForm.description} onChange={(e) => setEditExternalForm({ ...editExternalForm, description: e.target.value })} />
            </div>
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExternal(null)}>Cancel</Button>
            <Button onClick={handleUpdateExternal} disabled={!editExternalForm.name || !editExternalForm.endpoint}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete External Component Dialog */}
      <Dialog open={!!externalToDelete} onOpenChange={() => setExternalToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove External Component</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{externalToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExternalToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => externalToDelete && handleDeleteExternal(externalToDelete.id)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
