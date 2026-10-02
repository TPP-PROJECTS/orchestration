"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Link,
  Clock,
  Library,
  Shield,
  Sparkles,
  Database,
  Globe,
  Cpu,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { PolicyLibrary, Rule, FilterOptions } from "./types";
import { formatDate } from "./constants";

const API_BASE = "/api/knowledge-rules";

const MODEL_LABEL: Record<string, string> = {
  general_llm: "LLM",
  rdr: "RDR",
  knowledge_graph: "Knowledge Graph",
  neural_network: "Neural Network",
};

const MODEL_ICON: Record<string, React.ReactNode> = {
  rdr: <Database className="h-4 w-4 text-blue-600" />,
  knowledge_graph: <Globe className="h-4 w-4 text-green-600" />,
  neural_network: <Cpu className="h-4 w-4 text-purple-600" />,
  general_llm: <Sparkles className="h-4 w-4 text-amber-500" />,
};

interface LibraryDetailDrawerProps {
  library: PolicyLibrary | null;
  open: boolean;
  onClose: () => void;
  filterOptions: FilterOptions;
}

const LibraryDetailDrawer: React.FC<LibraryDetailDrawerProps> = ({
  library,
  open,
  onClose,
}) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  useEffect(() => {
    if (!open || !library) return;
    setRulesLoading(true);
    fetch(`${API_BASE}?library_id=${encodeURIComponent(library.id)}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setRulesLoading(false));
  }, [open, library]);

  if (!library) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="w-[800px] sm:max-w-[800px] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="max-w-[700px] overflow-hidden">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-mono text-gray-500">
                  {library.id}
                </span>
                <Badge className="text-xs bg-green-500 text-white border-0">
                  {library.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-0.5 border",
                    library.tier === "internal"
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : library.tier === "external"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-gray-100 text-gray-600 border-gray-200",
                  )}
                >
                  {library.tier?.toUpperCase()}
                </Badge>
              </div>
              <SheetTitle className="text-xl break-words flex items-center gap-2">
                <Library className="h-5 w-5 shrink-0" />
                {library.name}
              </SheetTitle>
              {library.description && (
                <p className="text-sm text-gray-500 mt-1 break-words">
                  {library.description}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs
          defaultValue="properties"
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="px-6 py-2 border-b justify-start rounded-none bg-transparent h-auto flex-shrink-0">
            <TabsTrigger
              value="properties"
              className="data-[state=active]:bg-gray-100 data-[state=active]:text-foreground data-[state=active]:font-bold"
            >
              Properties
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="data-[state=active]:bg-gray-100 data-[state=active]:text-foreground data-[state=active]:font-bold"
            >
              Rules
              {rules.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs px-1.5 py-0"
                >
                  {rules.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="source"
              className="data-[state=active]:bg-gray-100 data-[state=active]:text-foreground data-[state=active]:font-bold"
            >
              Source
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              {/* Properties Tab */}
              <TabsContent
                value="properties"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  {/* Library Info */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Library Info
                    </p>
                    <div className="space-y-3 pl-2">
                      <Row label="Tier">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            library.tier === "internal"
                              ? "bg-purple-100 text-purple-700 border-purple-200"
                              : library.tier === "external"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {library.tier}
                        </Badge>
                      </Row>
                      <Row label="Status">
                        <Badge className="text-xs bg-green-500 text-white border-0">
                          {library.status}
                        </Badge>
                      </Row>
                      <Row label="Rule Count">
                        <span className="flex items-center gap-1 text-sm text-gray-700">
                          <Shield className="h-3.5 w-3.5 text-gray-400" />
                          {library.ruleCount} rule
                          {library.ruleCount !== 1 ? "s" : ""}
                        </span>
                      </Row>
                      <Row label="Created">
                        <span className="flex items-center gap-1 text-sm text-gray-700">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(library.createdAt)}
                        </span>
                      </Row>
                    </div>
                  </div>

                  {/* Inference Model */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Inference Model
                    </p>
                    <div className="space-y-3 pl-2">
                      <Row label="Model">
                        <Badge variant="secondary" className="gap-1.5">
                          {MODEL_ICON[library.inferenceModel] ?? (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {MODEL_LABEL[library.inferenceModel] ??
                            library.inferenceModel?.replace(/_/g, " ")}
                        </Badge>
                      </Row>
                    </div>
                  </div>

                  {/* Component Association */}
                  {(library.componentId || library.componentName) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Component Association
                      </p>
                      <div className="space-y-3 pl-2">
                        {library.componentName && (
                          <Row label="Component">
                            <span className="flex items-center gap-1 text-sm text-gray-700">
                              <Link className="h-3.5 w-3.5 text-gray-400" />
                              {library.componentName}
                            </span>
                          </Row>
                        )}
                        {library.componentId && (
                          <Row label="Component ID">
                            <span className="text-sm font-mono text-gray-500">
                              {library.componentId}
                            </span>
                          </Row>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Rules Tab */}
              <TabsContent
                value="rules"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                {rulesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      No rules in this library
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {rules.map((rule, idx) => (
                      <div
                        key={rule.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors",
                          selectedRule?.id === rule.id && "bg-blue-50",
                        )}
                        onClick={() =>
                          setSelectedRule((prev) =>
                            prev?.id === rule.id ? null : rule,
                          )
                        }
                      >
                        <span className="text-xs text-gray-400 tabular-nums mt-0.5 w-5 shrink-0 text-right">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">
                            {rule.title}
                          </p>
                          {rule.summary && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {rule.summary}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {rule.riskLevel && (
                            <span
                              className={cn(
                                "text-xs font-medium px-1.5 py-0.5 rounded border",
                                rule.riskLevel === "critical"
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : rule.riskLevel === "high"
                                    ? "bg-orange-50 border-orange-200 text-orange-700"
                                    : rule.riskLevel === "medium"
                                      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                      : "bg-green-50 border-green-200 text-green-700",
                              )}
                            >
                              {rule.riskLevel}
                            </span>
                          )}
                          {rule.action && (
                            <span className="text-xs text-gray-400">
                              {rule.action.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Source Tab */}
              <TabsContent
                value="source"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">
                    Source Document
                  </h4>
                  {library.sourceFile ? (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                      <Badge variant="outline" className="text-xs">
                        {library.tier === "internal"
                          ? "internal"
                          : "regulation"}
                      </Badge>
                      <span className="text-gray-700 break-all flex-1">
                        {library.sourceFile}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        No source file recorded
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

// Small helper for consistent label/value rows
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
    <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
      {label}:
    </span>
    <div className="flex flex-wrap gap-1 w-full">{children}</div>
  </div>
);

export default LibraryDetailDrawer;
