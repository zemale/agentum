"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  Bot,
  Star,
  Clock,
  CheckCircle,
  Wallet,
  ArrowLeft,
  Loader2,
  Calendar,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAgent } from "@/lib/api/agents";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// SWR fetcher
const agentFetcher = async (id: string) => {
  return getAgent(id);
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const agentId = params.id as string;

  const { data: agent, error, isLoading, mutate } = useSWR(
    agentId ? `agent-${agentId}` : null,
    () => agentFetcher(agentId),
    {
      revalidateOnFocus: false,
    }
  );

  const handleHire = useCallback(() => {
    router.push(`/tasks/new?agentId=${agentId}`);
  }, [router, agentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Агент не найден или произошла ошибка</p>
        <Button variant="outline" onClick={() => router.push("/agents")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/agents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к агентам
        </Link>
      </Button>

      <div className="grid lg:grid-cols-[1fr_350px] gap-6">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center">
                      <Bot className="w-10 h-10 text-primary-foreground" />
                    </div>
                    {/* Online indicator */}
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-background",
                        agent.isOnline ? "bg-green-500" : "bg-gray-400"
                      )}
                      title={agent.isOnline ? "Online" : "Offline"}
                    />
                  </div>

                  {/* Title and Rating */}
                  <div>
                    <h1 className="text-2xl font-bold">{agent.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{(agent as any).rating?.toFixed(1) || "0.0"}</span>
                      </div>
                      <span className="text-muted-foreground">
                        ({(agent as any).totalTasks || 0} задач)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {agent.skills?.slice(0, 8).map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1 text-2xl font-bold">
                    <Wallet className="h-5 w-5" />
                    <span>${agent.hourlyRate}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">/час</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold mb-2">Описание</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {agent.description}
                </p>
              </div>

              <Separator />

              {/* Statistics */}
              <div>
                <h3 className="font-semibold mb-4">Статистика</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    icon={Star}
                    label="Рейтинг"
                    value={`${(agent as any).rating?.toFixed(1) || "0.0"}`}
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Выполнено"
                    value={`${(agent as any).totalTasks || 0}`}
                  />
                  <StatCard
                    icon={Briefcase}
                    label="Успешность"
                    value={`${(agent as any).successRate?.toFixed(0) || 0}%`}
                  />
                  <StatCard
                    icon={Clock}
                    label="Статус"
                    value={agent.isOnline ? "Онлайн" : "Офлайн"}
                    valueClassName={agent.isOnline ? "text-green-600" : "text-gray-500"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Card */}
          <Card>
            <CardHeader>
              <CardTitle>Услуги</CardTitle>
              <CardDescription>
                Доступные услуги этого агента
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(agent as any).services?.length > 0 ? (
                <div className="space-y-4">
                  {(agent as any).services.map((service: any) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{service.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${service.price}</p>
                        {service.isActive ? (
                          <Badge variant="default" className="text-xs">Активна</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Неактивна</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  У этого агента пока нет услуг
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Hire Card */}
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Нанять агента</CardTitle>
              <CardDescription>
                Создайте задачу для этого агента
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Почасовая ставка:</span>
                <span className="font-semibold">${agent.hourlyRate}/час</span>
              </div>

              {agent.isOnline ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Агент сейчас онлайн
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Агент сейчас офлайн
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleHire}>
                <Briefcase className="mr-2 h-4 w-4" />
                Нанять агента
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Оплата будет списана с вашего баланса
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
      <Icon className="h-5 w-5 text-muted-foreground mb-2" />
      <span className={cn("text-lg font-semibold", valueClassName)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
