"use client";

import { useState, useCallback } from "react";
import { Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AgentFilters as AgentFiltersType } from "@/lib/api/agents";

const AVAILABLE_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "React",
  "Node.js",
  "AI/ML",
  "Data Analysis",
  "DevOps",
  "Design",
  "Writing",
  "Translation",
  "Research",
];

interface AgentFiltersProps {
  filters: AgentFiltersType;
  onFiltersChange: (filters: AgentFiltersType) => void;
  onApply: () => void;
  onReset: () => void;
}

export function AgentFilters({
  filters,
  onFiltersChange,
  onApply,
  onReset,
}: AgentFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AgentFiltersType>(filters);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateFilter = useCallback(<K extends keyof AgentFiltersType>(
    key: K,
    value: AgentFiltersType[K]
  ) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setLocalFilters((prev) => {
      const currentSkills = prev.skills || [];
      const newSkills = currentSkills.includes(skill)
        ? currentSkills.filter((s) => s !== skill)
        : [...currentSkills, skill];
      return { ...prev, skills: newSkills };
    });
  }, []);

  const handleApply = useCallback(() => {
    onFiltersChange(localFilters);
    onApply();
  }, [localFilters, onFiltersChange, onApply]);

  const handleReset = useCallback(() => {
    const emptyFilters: AgentFiltersType = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onReset();
  }, [onFiltersChange, onReset]);

  const hasActiveFilters = 
    (localFilters.skills?.length ?? 0) > 0 ||
    localFilters.minRating !== undefined ||
    localFilters.minPrice !== undefined ||
    localFilters.maxPrice !== undefined ||
    localFilters.onlineOnly;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Фильтры
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Свернуть" : "Развернуть"}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Поиск</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Поиск по имени или описанию..."
                className="pl-8"
                value={localFilters.search || ""}
                onChange={(e) => updateFilter("search", e.target.value || undefined)}
              />
            </div>
          </div>

          <Separator />

          {/* Skills */}
          <div className="space-y-3">
            <Label>Навыки</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SKILLS.map((skill) => (
                <Badge
                  key={skill}
                  variant={localFilters.skills?.includes(skill) ? "default" : "outline"}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Min Rating */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Минимальный рейтинг</Label>
              <span className="text-sm font-medium">
                {localFilters.minRating !== undefined ? `${localFilters.minRating}+` : "Любой"}
              </span>
            </div>
            <Slider
              value={[localFilters.minRating ?? 0]}
              onValueChange={([value]) => updateFilter("minRating", value > 0 ? value : undefined)}
              max={5}
              step={0.5}
            />
          </div>

          <Separator />

          {/* Price Range */}
          <div className="space-y-3">
            <Label>Ценовой диапазон ($/час)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="number"
                  placeholder="От"
                  min={0}
                  value={localFilters.minPrice ?? ""}
                  onChange={(e) =>
                    updateFilter(
                      "minPrice",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="До"
                  min={0}
                  value={localFilters.maxPrice ?? ""}
                  onChange={(e) =>
                    updateFilter(
                      "maxPrice",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Online Only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="online"
              checked={localFilters.onlineOnly || false}
              onCheckedChange={(checked) =>
                updateFilter("onlineOnly", checked === true)
              }
            />
            <Label htmlFor="online" className="cursor-pointer">
              Только онлайн
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleApply}>
              Применить
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasActiveFilters}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default AgentFilters;
