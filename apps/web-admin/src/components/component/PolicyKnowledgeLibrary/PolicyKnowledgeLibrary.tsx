// Policy Knowledge Library - main list/filter view for browsing and searching policy rules.
// Fetches rules from the backend API (GET /api/knowledge-rules).
// Supports create, edit, and delete via API.
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  X,
  FileText,
  Plus,
  ArrowUpDown,
  Loader2,
  Library,
  Sparkles,
  Database,
  Globe,
  Cpu,
  Link,
  Clock,
} from "lucide-react";
// Library/Shield/Sparkles/Database/Globe/Cpu/Link/Clock used in library card render below

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { Rule, FilterOptions, FilterState, PolicyLibrary } from "./types";
import { DEFAULT_FILTER_OPTIONS, formatDate } from "./constants";
import FilterPanel from "./FilterPanel";
import RuleCard from "./RuleCard";
import RuleDetailDrawer from "./RuleDetailDrawer";
import RuleFormDialog from "./RuleFormDialog";
import LibraryDetailDrawer from "./LibraryDetailDrawer";

const API_BASE = "/api/knowledge-rules";
const LIBRARY_API = "/api/policy-libraries";

async function fetchLibraries(): Promise<PolicyLibrary[]> {
  const res = await fetch(LIBRARY_API);
  if (!res.ok) return [];
  return res.json();
}

const MODEL_LABEL: Record<string, string> = {
  general_llm: "LLM",
  rdr: "RDR",
  knowledge_graph: "Knowledge Graph",
  neural_network: "Neural Network",
};

const MODEL_ICON: Record<string, React.ReactNode> = {
  rdr: <Database className="h-3 w-3" />,
  knowledge_graph: <Globe className="h-3 w-3" />,
  neural_network: <Cpu className="h-3 w-3" />,
  general_llm: <Sparkles className="h-3 w-3" />,
};

async function fetchRules(
  filters: FilterState,
  sortBy: string,
): Promise<Rule[]> {
  const params = new URLSearchParams();
  filters.domains.forEach((v) => params.append("domain", v));
  filters.jurisdictions.forEach((v) => params.append("jurisdiction", v));
  filters.intentTypes.forEach((v) => params.append("intent_type", v));
  filters.scopes.forEach((v) => params.append("scope", v));
  filters.enforcements.forEach((v) => params.append("enforcement", v));
  filters.strengths.forEach((v) => params.append("strength", v));
  filters.statuses.forEach((v) => params.append("status", v));
  filters.inferenceModels.forEach((v) => params.append("inference_model", v));
  filters.trustWorthys.forEach((v) => params.append("trust_worthy", v));
  if (filters.search) params.set("search", filters.search);
  params.set("sort_by", sortBy);

  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch rules: ${res.status}`);
  return res.json();
}

async function createRule(data: Partial<Rule>): Promise<Rule> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create rule: ${res.status}`);
  return res.json();
}

async function updateRule(id: string, data: Partial<Rule>): Promise<Rule> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update rule: ${res.status}`);
  return res.json();
}

async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete rule: ${res.status}`);
}

// ============ Main Component ============
export default function PolicyKnowledgeLibrary() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [libraries, setLibraries] = useState<PolicyLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLibrary, setSelectedLibrary] = useState<PolicyLibrary | null>(
    null,
  );
  const [librarySheetOpen, setLibrarySheetOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    domains: [],
    jurisdictions: [],
    intentTypes: [],
    scopes: [],
    enforcements: [],
    strengths: [],
    statuses: [],
    inferenceModels: [],
    trustWorthys: [],
    search: "",
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(
    DEFAULT_FILTER_OPTIONS,
  );

  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("lastModified");

  const [newRuleDialogOpen, setNewRuleDialogOpen] = useState(false);
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // ---- Data fetching ----
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRules(filters, sortBy);
      setRules(data);
    } catch (e: any) {
      setError(e.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    fetchLibraries()
      .then(setLibraries)
      .catch(() => {});
  }, []);

  // ---- Client-side sort (backend returns pre-sorted, this is a safety net) ----
  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      switch (sortBy) {
        case "lastModified":
          return (
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
          );
        case "title":
          return a.title.localeCompare(b.title);
        case "riskLevel": {
          const riskOrder: Record<string, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
        }
        default:
          return 0;
      }
    });
  }, [rules, sortBy]);

  // ---- Handlers ----
  const handleLibraryClick = (lib: PolicyLibrary) => {
    setSelectedLibrary(lib);
    setLibrarySheetOpen(true);
  };

  const handleRuleClick = (rule: Rule) => {
    setSelectedRule(rule);
    setDrawerOpen(true);
  };

  const handleCreate = async (ruleData: Partial<Rule>) => {
    try {
      const created = await createRule(ruleData);
      setRules((prev) => [created, ...prev]);
      setNewRuleDialogOpen(false);
    } catch (e: any) {
      console.error("Create rule failed:", e);
    }
  };

  const handleEdit = async (ruleData: Partial<Rule>) => {
    if (!editingRule) return;
    try {
      const updated = await updateRule(editingRule.id, ruleData);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedRule?.id === updated.id) setSelectedRule(updated);
      setEditRuleDialogOpen(false);
      setEditingRule(null);
    } catch (e: any) {
      console.error("Update rule failed:", e);
    }
  };

  const handleDelete = async (rule: Rule) => {
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      if (selectedRule?.id === rule.id) {
        setSelectedRule(null);
        setDrawerOpen(false);
      }
    } catch (e: any) {
      console.error("Delete rule failed:", e);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-white">
      {/* Header */}
      <header className="border-b px-6 py-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => setNewRuleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Filters */}
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
          onFilterOptionsChange={setFilterOptions}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-3 border-b bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="pl-9 h-9 w-64"
                />
              </div>
              <span className="text-sm text-gray-600">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  <>
                    <span className="font-medium">{sortedRules.length}</span>{" "}
                    result{sortedRules.length !== 1 ? "s" : ""} found
                  </>
                )}
              </span>

              {/* Active filter tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {filters.domains.map((d) => (
                  <Badge
                    key={d}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-gray-200"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        domains: filters.domains.filter((x) => x !== d),
                      })
                    }
                  >
                    {filterOptions.domains.find((dom) => dom.value === d)
                      ?.label || d}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
                {filters.statuses.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-gray-200"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        statuses: filters.statuses.filter((x) => x !== s),
                      })
                    }
                  >
                    {filterOptions.statuses.find((st) => st.value === s)
                      ?.label || s}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-9">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastModified">Last Modified</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="riskLevel">Risk Level</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rule List */}
          <ScrollArea className="flex-1 p-6">
            {error && (
              <div className="text-center py-8 text-red-500 text-sm">
                {error}{" "}
                <button className="underline ml-1" onClick={loadRules}>
                  Retry
                </button>
              </div>
            )}

            {/* Policy Library cards — one per uploaded document from component registration */}
            {libraries.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Policy Libraries ({libraries.length})
                </p>
                <div className="space-y-3">
                  {libraries.map((lib) => (
                    <div
                      key={lib.id}
                      className="p-4 border border-gray-200 bg-white rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => handleLibraryClick(lib)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500 truncate">
                              {lib.id}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs bg-green-500 text-white border-0 shrink-0"
                            >
                              {lib.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-900 truncate">
                            {lib.name}
                          </h4>
                          {lib.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {lib.description}
                            </p>
                          )}
                        </div>
                        <div className="px-2 py-1 rounded text-xs font-medium border bg-blue-50 border-blue-200 text-blue-700 shrink-0">
                          {lib.ruleCount} RULES
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="secondary" className="gap-1">
                          <Library className="h-3 w-3" />
                          Policy Library
                        </Badge>
                        <Badge variant="outline" className="gap-1 text-xs">
                          {MODEL_ICON[lib.inferenceModel] ?? (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {MODEL_LABEL[lib.inferenceModel] ??
                            lib.inferenceModel?.replace(/_/g, " ")}
                        </Badge>
                        {lib.sourceFile && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-gray-50"
                          >
                            {lib.sourceFile}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(lib.createdAt)}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-full font-medium",
                            lib.tier === "external"
                              ? "bg-blue-100 text-blue-700"
                              : lib.tier === "internal"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {lib.tier}
                        </span>
                        {lib.componentName && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Link className="h-3 w-3" />
                            {lib.componentName}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-6 mb-6" />
              </div>
            )}

            <div className="space-y-3">
              {sortedRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRule?.id === rule.id}
                  onClick={() => handleRuleClick(rule)}
                  filterOptions={filterOptions}
                />
              ))}

              {!loading && !error && sortedRules.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No rules found
                  </h3>
                  <p className="text-gray-500">
                    Try adjusting your filters or search terms
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Rule Detail Drawer */}
      <RuleDetailDrawer
        rule={selectedRule}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(rule) => {
          setEditingRule(rule);
          setEditRuleDialogOpen(true);
        }}
        onDelete={handleDelete}
        filterOptions={filterOptions}
      />

      {/* Create Dialog */}
      <RuleFormDialog
        open={newRuleDialogOpen}
        onClose={() => setNewRuleDialogOpen(false)}
        onSave={handleCreate}
        filterOptions={filterOptions}
      />

      {/* Edit Dialog */}
      <RuleFormDialog
        open={editRuleDialogOpen}
        rule={editingRule}
        onClose={() => {
          setEditRuleDialogOpen(false);
          setEditingRule(null);
        }}
        onSave={handleEdit}
        filterOptions={filterOptions}
      />

      {/* Library Detail Drawer */}
      <LibraryDetailDrawer
        library={selectedLibrary}
        open={librarySheetOpen}
        onClose={() => setLibrarySheetOpen(false)}
        filterOptions={filterOptions}
      />
    </div>
  );
}
