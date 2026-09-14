/**
 * ImportDocumentDialog — upload a policy document and parse it into a library + rules.
 *
 * - One document = one Policy Library
 * - LLM extracts individual rules as children of that library
 * - Tier: internal or external
 * - Inference model: general_llm (default) | rdr | knowledge_graph | neural_network
 * - If tier=internal, user can optionally attribute it to a registered external component
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, X } from "lucide-react";

interface ExternalComponent {
  id: string;
  name: string;
}

interface ImportResult {
  library_id: string;
  library_name: string;
  tier: string;
  rules_created: number;
}

interface ImportDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  apiBase?: string;
}

const TIER_OPTIONS = [
  { value: "internal", label: "Internal", description: "Organization's own policy (school handbook, company rules)" },
  { value: "external", label: "External", description: "Regulatory or industry standard (GDPR, HIPAA, etc.)" },
];

const MODEL_OPTIONS = [
  { value: "general_llm", label: "General LLM", description: "Best for most documents — uses Claude Sonnet" },
  { value: "rdr",         label: "RDR",         description: "Ripple Down Rules — lightweight, uses Claude Haiku" },
  { value: "knowledge_graph", label: "Knowledge Graph", description: "Graph-based reasoning" },
  { value: "neural_network",  label: "Neural Network",  description: "Deep learning" },
];

export default function ImportDocumentDialog({
  open,
  onClose,
  onImported,
  apiBase = "",
}: ImportDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tier, setTier] = useState<"internal" | "external">("internal");
  const [inferenceModel, setInferenceModel] = useState("general_llm");
  const [libraryName, setLibraryName] = useState("");
  const [componentId, setComponentId] = useState("");
  const [components, setComponents] = useState<ExternalComponent[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch registered external components for internal-tier attribution
  useEffect(() => {
    if (!open) return;
    fetch(`${apiBase}/api/external/components`)
      .then((r) => r.json())
      .then((data: ExternalComponent[]) => setComponents(data))
      .catch(() => setComponents([]));
  }, [open, apiBase]);

  const reset = () => {
    setFile(null);
    setTier("internal");
    setInferenceModel("general_llm");
    setLibraryName("");
    setComponentId("");
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tier", tier);
      form.append("inference_model", inferenceModel);
      if (libraryName.trim()) form.append("library_name", libraryName.trim());
      if (tier === "internal" && componentId) {
        form.append("component_id", componentId);
        const comp = components.find((c) => c.id === componentId);
        if (comp) form.append("component_name", comp.name);
      }

      const res = await fetch(`${apiBase}/api/policy-libraries/import`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Import failed" }));
        throw new Error(err.detail || "Import failed");
      }

      const data = await res.json() as ImportResult;
      setResult(data);
      onImported();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const selectedComp = components.find((c) => c.id === componentId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Policy Document
          </DialogTitle>
          <DialogDescription>
            Upload a document to extract policy rules using AI.
            One document becomes one <span className="font-medium">Policy Library</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 py-4">

            {/* File upload */}
            <div className="space-y-2">
              <Label>Document File</Label>
              <div
                className="border-2 border-dashed border-muted rounded-md p-4 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById("import-file-input")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) setFile(f);
                }}
              >
                <input
                  id="import-file-input"
                  type="file"
                  accept=".txt,.md,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                    e.target.value = "";
                  }}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium truncate max-w-[260px]">{file.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive ml-1"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click or drag &amp; drop — .txt, .md, .pdf
                  </p>
                )}
              </div>
            </div>

            {/* Tier */}
            <div className="space-y-2">
              <Label>Policy Tier</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIER_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTier(t.value as "internal" | "external")}
                    className={`text-left p-3 rounded-md border text-sm transition-colors ${
                      tier === t.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Internal attribution */}
            {tier === "internal" && (
              <div className="space-y-2">
                <Label>Attributed Component (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Link this library to the external component it governs. Shown as metadata on the library.
                </p>
                <Select value={componentId} onValueChange={setComponentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a component (optional)">
                      {selectedComp ? (
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">internal</Badge>
                          {selectedComp.name}
                        </span>
                      ) : "None"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {components.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Inference model */}
            <div className="space-y-2">
              <Label>Processing Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setInferenceModel(m.value)}
                    className={`text-left p-3 rounded-md border text-sm transition-colors ${
                      inferenceModel === m.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Library name override */}
            <div className="space-y-2">
              <Label>Library Name (Optional)</Label>
              <Input
                placeholder="Leave blank to auto-detect from document"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
              />
            </div>

            {/* Result */}
            {result && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 border border-green-200 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-green-800">Import successful</div>
                  <div className="text-green-700 mt-0.5">
                    Created library <span className="font-mono">{result.library_name}</span> with{" "}
                    <span className="font-semibold">{result.rules_created}</span> rules.
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div className="text-red-700">{error}</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Parsing…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
