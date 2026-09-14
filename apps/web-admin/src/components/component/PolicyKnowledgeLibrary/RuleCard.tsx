"use client";

import React from "react";
import { Clock, Library, Link } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Rule, FilterOptions } from "./types";
import {
  getIconComponent,
  getRiskColor,
  getActionColor,
  formatDate,
} from "./constants";

// ============ Rule Card Component ============
interface RuleCardProps {
  rule: Rule;
  isSelected: boolean;
  onClick: () => void;
  filterOptions: FilterOptions;
}

const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  isSelected,
  onClick,
  filterOptions,
}) => {
  const intentOption = filterOptions.intentTypes.find(
    (i) => i.value === rule.intentType,
  );
  const IntentIcon = getIconComponent(intentOption?.icon);
  const strengthOption = filterOptions.strengths.find(
    (s) => s.value === rule.strength,
  );
  const statusOption = filterOptions.statuses.find(
    (s) => s.value === rule.status,
  );
  const scopeOption = filterOptions.scopes.find((s) => s.value === rule.scope);

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 border rounded-lg cursor-pointer transition-all",
        isSelected
          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500">{rule.id}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-1.5",
                statusOption?.color || "bg-gray-500",
                "text-white",
              )}
            >
              {statusOption?.label || rule.status}
            </Badge>
          </div>
          <h4 className="font-medium text-gray-900 truncate">{rule.title}</h4>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {rule.summary}
          </p>
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-medium border",
            getRiskColor(rule.riskLevel),
          )}
        >
          {rule.riskLevel.toUpperCase()}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="gap-1">
                <IntentIcon className="h-3 w-3" />
                {intentOption?.label || rule.intentType}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Policy Intent</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            strengthOption?.color || "bg-gray-500",
            "text-white",
          )}
        >
          {strengthOption?.label || rule.strength}
        </Badge>

        <Badge variant="outline" className="text-xs">
          {scopeOption?.label || rule.scope}
        </Badge>

        <Badge
          variant="outline"
          className={cn("text-xs", getActionColor(rule.action))}
        >
          {rule.action.replace("_", " ")}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {rule.domain.slice(0, 3).map((d) => (
          <Badge key={d} variant="outline" className="text-xs bg-gray-50">
            {filterOptions.domains.find((dom) => dom.value === d)?.label || d}
          </Badge>
        ))}
        {rule.domain.length > 3 && (
          <Badge variant="outline" className="text-xs bg-gray-50">
            +{rule.domain.length - 3}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(rule.lastModified)}
        </span>
        {rule.tier && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full font-medium",
              rule.tier === "external" ? "bg-blue-100 text-blue-700" :
              rule.tier === "internal" ? "bg-purple-100 text-purple-700" :
              "bg-gray-100 text-gray-600",
            )}
          >
            {rule.tier}
          </span>
        )}
        {rule.libraryName && (
          <span className="flex items-center gap-1 text-gray-400">
            <Library className="h-3 w-3" />
            {rule.libraryName}
          </span>
        )}
        {rule.componentName && (
          <span className="flex items-center gap-1 text-gray-400">
            <Link className="h-3 w-3" />
            {rule.componentName}
          </span>
        )}
      </div>
    </div>
  );
};

export default RuleCard;
