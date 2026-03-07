"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Loader2,
  Bot,
  Settings,
  Shield,
  Briefcase,
  Plus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AgentForm, ApiKeyManager, ServiceForm, type AgentFormValues, type ServiceFormValues } from "@/components/agents";
import {
  getAgent,
  updateAgent,
  rotateApiKey,
  updateIpWhitelist,
  createService,
  updateService,
  deleteService,
} from "@/lib/api/agents";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// SWR fetcher
const agentFetcher = async (id: string) => {
  return getAgent(id);
};

export default function ManageAgentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const agentId = params.id as string;

  const [activeTab, setActiveTab] = useState("profile");
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  const {
    data: agent,
    error,
    isLoading,
    mutate,
  } = useSWR(agentId ? `agent-manage-${agentId}` : null, () =>
    agentFetcher(agentId)
  );

  // Profile update
  const handleUpdateProfile = useCallback(
    async (data: AgentFormValues) => {
      try {
        await updateAgent(agentId, data);
        toast({
          title: "Профиль обновлен",
          description: "Информация об агенте успешно обновлена",
        });
        mutate();
      } catch (error: any) {
        toast({
          title: "Ошибка",
          description: error.response?.data?.error || "Не удалось обновить профиль",
          variant: "destructive",
        });
        throw error;
      }
    },
    [agentId, mutate, toast]
  );

  // API Key rotation
  const handleRotateKey = useCallback(async () => {
    const newKey = await rotateApiKey(agentId);
    toast({
      title: "API ключ обновлен",
      description: "Новый ключ сгенерирован",
    });
    mutate();
    return newKey;
  }, [agentId, mutate, toast]);

  // IP Whitelist update
  const handleUpdateIpWhitelist = useCallback(
    async (ips: string[]) => {
      const result = await updateIpWhitelist(agentId, ips);
      toast({
        title: "IP Whitelist обновлен",
        description: "Список разрешенных IP адресов обновлен",
      });
      mutate();
      return result;
    },
    [agentId, mutate, toast]
  );

  // Create service
  const handleCreateService = useCallback(
    async (data: ServiceFormValues) => {
      try {
        await createService(agentId, data);
        toast({
          title: "Услуга создана",
          description: "Новая услуга добавлена",
        });
        setIsServiceDialogOpen(false);
        mutate();
      } catch (error: any) {
        toast({
          title: "Ошибка",
          description: error.response?.data?.error || "Не удалось создать услугу",
          variant: "destructive",
        });
        throw error;
      }
    },
    [agentId, mutate, toast]
  );

  // Update service
  const handleUpdateService = useCallback(
    async (data: ServiceFormValues) => {
      if (!editingService) return;
      try {
        await updateService(agentId, editingService.id, data);
        toast({
          title: "Услуга обновлена",
          description: "Информация об услуге обновлена",
        });
        setEditingService(null);
        mutate();
      } catch (error: any) {
        toast({
          title: "Ошибка",
          description: error.response?.data?.error || "Не удалось обновить услугу",
          variant: "destructive",
        });
        throw error;
      }
    },
    [agentId, editingService, mutate, toast]
  );

  // Delete service
  const handleDeleteService = useCallback(
    async (serviceId: string) => {
      setServiceToDelete(serviceId);
    },
    []
  );

  const handleConfirmDeleteService = useCallback(async () => {
    if (!serviceToDelete) return;
    setIsDeletingService(true);
    try {
      await deleteService(agentId, serviceToDelete);
      toast({
        title: "Услуга удалена",
        description: "Услуга была успешно удалена",
      });
      mutate();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.response?.data?.error || "Не удалось удалить услугу",
        variant: "destructive",
      });
    } finally {
      setIsDeletingService(false);
      setServiceToDelete(null);
    }
  }, [agentId, serviceToDelete, mutate, toast]);

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
        <p className="text-destructive">Агент не найден</p>
        <Button
          variant="outline"
          onClick={() => router.push("/my-agents")}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/my-agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Управление агентом</h1>
          <p className="text-muted-foreground">{agent.name}</p>
        </div>
        <Badge
          variant={agent.isOnline ? "default" : "secondary"}
          className="w-fit"
        >
          {agent.isOnline ? "Онлайн" : "Офлайн"}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="profile">
            <Settings className="mr-2 h-4 w-4 hidden sm:inline" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4 hidden sm:inline" />
            Безопасность
          </TabsTrigger>
          <TabsTrigger value="services">
            <Briefcase className="mr-2 h-4 w-4 hidden sm:inline" />
            Услуги
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация об агенте</CardTitle>
              <CardDescription>
                Редактируйте профиль вашего агента
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentForm
                agent={agent}
                onSubmit={handleUpdateProfile}
                submitLabel="Сохранить изменения"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <ApiKeyManager
            apiKey={(agent as any).apiKey || ""}
            ipWhitelist={(agent as any).ipWhitelist || []}
            onRotateKey={handleRotateKey}
            onUpdateIpWhitelist={handleUpdateIpWhitelist}
          />
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Услуги агента</h3>
              <p className="text-sm text-muted-foreground">
                Управляйте услугами, которые предлагает ваш агент
              </p>
            </div>
            <Button onClick={() => setIsServiceDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить услугу
            </Button>
          </div>

          {/* Services List */}
          <div className="space-y-4">
            {(agent as any).services?.length > 0 ? (
              (agent as any).services.map((service: any) => (
                <Card key={service.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{service.title}</h4>
                          {service.isActive ? (
                            <Badge>Активна</Badge>
                          ) : (
                            <Badge variant="secondary">Неактивна</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {service.description}
                        </p>
                        <p className="font-medium">${service.price}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingService(service)}
                        >
                          Редактировать
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteService(service.id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-muted/50">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Нет услуг</h3>
                  <p className="text-muted-foreground mb-4">
                    Добавьте первую услугу для вашего агента
                  </p>
                  <Button onClick={() => setIsServiceDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить услугу
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить услугу</DialogTitle>
            <DialogDescription>
              Создайте новую услугу для вашего агента
            </DialogDescription>
          </DialogHeader>
          <ServiceForm
            onSubmit={handleCreateService}
            onCancel={() => setIsServiceDialogOpen(false)}
            submitLabel="Создать услугу"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog
        open={!!editingService}
        onOpenChange={() => setEditingService(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать услугу</DialogTitle>
            <DialogDescription>
              Измените информацию об услуге
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <ServiceForm
              service={editingService}
              onSubmit={handleUpdateService}
              onCancel={() => setEditingService(null)}
              submitLabel="Сохранить изменения"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Service Dialog */}
      <Dialog
        open={!!serviceToDelete}
        onOpenChange={() => setServiceToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Подтверждение удаления
            </DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить эту услугу? Это действие нельзя
              отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setServiceToDelete(null)}
              disabled={isDeletingService}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteService}
              disabled={isDeletingService}
            >
              {isDeletingService ? (
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
