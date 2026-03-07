"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bot, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentCard, AgentFilters } from "@/components/agents";
import { getAgents, AgentFilters as AgentFiltersType, AgentWithStats } from "@/lib/api/agents";
import { useToast } from "@/hooks/use-toast";

const AGENTS_PER_PAGE = 12;

// SWR fetcher
const agentsFetcher = async ([filters, page]: [AgentFiltersType, number]) => {
  return getAgents(filters, { page, limit: AGENTS_PER_PAGE });
};

export default function AgentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AgentFiltersType>({});
  const [debouncedFilters, setDebouncedFilters] = useState<AgentFiltersType>({});

  // Debounce filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Fetch agents with SWR
  const { data, error, isLoading, mutate } = useSWR(
    [debouncedFilters, page],
    agentsFetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  const handleFiltersChange = useCallback((newFilters: AgentFiltersType) => {
    setFilters(newFilters);
  }, []);

  const handleApplyFilters = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setDebouncedFilters({});
    setPage(1);
  }, []);

  const handleHireClick = useCallback((agent: AgentWithStats) => {
    router.push(`/tasks/new?agentId=${agent.id}`);
  }, [router]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const agents = data?.agents || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Маркетплейс агентов</h1>
          <p className="text-muted-foreground mt-1">
            Найдите идеального AI-агента для ваших задач
          </p>
        </div>
        <Button onClick={() => router.push("/my-agents/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Стать агентом
        </Button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Filters Sidebar */}
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <AgentFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* Agents Grid */}
        <div className="space-y-6">
          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                "Загрузка..."
              ) : (
                <>Найдено <span className="font-medium text-foreground">{total}</span> агентов</>
              )}
            </p>
          </div>

          {/* Loading State */}
          {isLoading && agents.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-destructive">Ошибка загрузки агентов</p>
              <Button 
                variant="outline" 
                onClick={() => mutate()} 
                className="mt-4"
              >
                Попробовать снова
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && agents.length === 0 && (
            <div className="text-center py-12 border rounded-lg bg-muted/50">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Агенты не найдены</h3>
              <p className="text-muted-foreground mb-4">
                Попробуйте изменить фильтры или сбросить их
              </p>
              <Button variant="outline" onClick={handleResetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          )}

          {/* Agents Grid */}
          {!error && agents.length > 0 && (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    showHireButton={true}
                    onHireClick={handleHireClick}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1 || isLoading}
                  >
                    Назад
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        // Show first, last, current, and neighbors
                        return (
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 1
                        );
                      })
                      .reduce<(number | string)[]>((acc, p, i, arr) => {
                        if (i > 0 && arr[i - 1] !== p - 1) {
                          acc.push("...");
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        typeof p === "string" ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                            {p}
                          </span>
                        ) : (
                          <Button
                            key={p}
                            variant={page === p ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(p)}
                            disabled={isLoading}
                          >
                            {p}
                          </Button>
                        )
                      )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages || isLoading}
                  >
                    Вперед
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
