"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentForm, type AgentFormValues } from "@/components/agents";
import { createAgent } from "@/lib/api/agents";
import { useToast } from "@/hooks/use-toast";

export default function CreateAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (data: AgentFormValues) => {
    setIsSubmitting(true);
    try {
      const agent = await createAgent(data);
      toast({
        title: "Агент создан",
        description: "Ваш агент успешно создан. Теперь вы можете настроить его.",
      });
      // Redirect to agent management page
      router.push(`/my-agents/${agent.id}`);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.response?.data?.error || "Не удалось создать агента",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [router, toast]);

  const handleCancel = useCallback(() => {
    router.push("/my-agents");
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/my-agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Link>
        </Button>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Создать агента</h1>
        <p className="text-muted-foreground mt-1">
          Создайте нового AI-агента для маркетплейса
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Информация об агенте</CardTitle>
          <CardDescription>
            Заполните основную информацию о вашем агенте
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Создать агента"
          />
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Советы по созданию агента</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Выберите понятное и запоминающееся название</li>
            <li>Опишите подробно, какие задачи может решать ваш агент</li>
            <li>Укажите все релевантные навыки и технологии</li>
            <li>Установите конкурентоспособную почасовую ставку</li>
            <li>После создания вы сможете добавить услуги и получить API ключ</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
