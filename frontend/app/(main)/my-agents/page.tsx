"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Bot,
  Plus,
  Loader2,
  Settings,
  Trash2,
  Power,
  PowerOff,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getMyAgents, deleteAgent } from "@/lib/api/agents";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// SWR fetcher
const myAgentsFetcher = async () => {
  return getMyAgents();
};

export default function MyAgentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: agents, error, isLoading, mutate } = useSWR(
    "my-agents",
    myAgentsFetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const handleDeleteClick = useCallback((agentId: string) => {
    setAgentToDelete(agentId);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!agentToDelete) return;

    setIsDeleting(true);
    try {
      await deleteAgent(agentToDelete);
      toast({
        title: "Агент удален",
        description: "Агент был успешно удален",
      });
      mutate();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить агента",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  }, [agentToDelete, mutate, toast]);

  const handleManageClick = useCallback((agentId: string) => {
    router.push(`/my-agents/${agentId}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Мои агенты</h1>
          <p className="text-muted-foreground mt-1">
            Управляйте вашими AI-агентами
          </p>
        </div>
        <Button onClick={() => router.push("/my-agents/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Создать агента
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ошибка загрузки</h3>
          <p className="text-muted-foreground mb-4">
            Не удалось загрузить ваших агентов
          </p>
          <Button onClick={() => mutate()}>Попробовать снова</Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!agents || agents.length === 0) && (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">У вас пока нет агентов</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Создайте своего первого AI-агента и начните предлагать услуги на маркетплейсе
          </p>
          <Button onClick={() => router.push("/my-agents/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Создать агента
          </Button>
        </div>
      )}

      {/* Agents Grid */}
      {!isLoading && !error && agents && agents.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar with online indicator */}
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
                        <Bot className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
                          agent.isOnline ? "bg-green-500" : "bg-gray-400"
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>${agent.hourlyRate}/час</span>
                        <span>•</span>
                        <span>{(agent as any).tasksCount || 0} задач</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant={agent.isOnline ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {agent.isOnline ? (
                      <span className="flex items-center gap-1">
                        <Power className="w-3 h-3" /> Онлайн
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <PowerOff className="w-3 h-3" /> Офлайн
                      </span>
                    )}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Skills */}
                <div className="flex flex-wrap gap-1">
                  {agent.skills.slice(0, 4).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {agent.skills.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{agent.skills.length - 4}
                    </Badge>
                  )}
                </div>

                {/* Services Count */}
                <p className="text-sm text-muted-foreground">
                  Услуг: {(agent as any).services?.length || 0}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="sm"
                    onClick={() => handleManageClick(agent.id)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Управление
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(agent.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Подтверждение удаления
            </DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить этого агента? Это действие нельзя отменить.
              Все данные агента, включая историю задач, будут удалены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                "Удалить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
