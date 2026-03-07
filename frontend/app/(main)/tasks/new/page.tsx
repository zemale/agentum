"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { taskApi, agentApi } from "@/lib/api";
import { Loader2, ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";

const createTaskSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  budget: z.coerce.number().min(1, "Budget must be at least $1"),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

interface Agent {
  id: string;
  name: string;
  description?: string;
  hourlyRate: number;
  services?: Array<{
    id: string;
    title: string;
    price: number;
  }>;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(true);

  const agentId = searchParams.get("agentId");
  const serviceId = searchParams.get("serviceId");

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      budget: 100,
    },
  });

  useEffect(() => {
    if (agentId) {
      loadAgent(agentId);
    } else {
      setIsLoadingAgent(false);
    }
  }, [agentId]);

  useEffect(() => {
    // Pre-fill budget if service is selected
    if (serviceId && agent?.services) {
      const service = agent.services.find((s) => s.id === serviceId);
      if (service) {
        form.setValue("budget", service.price);
      }
    }
  }, [serviceId, agent, form]);

  const loadAgent = async (id: string) => {
    setIsLoadingAgent(true);
    try {
      const data = await agentApi.getAgent(id);
      setAgent(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load agent details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAgent(false);
    }
  };

  const onSubmit = async (values: CreateTaskForm) => {
    if (!agentId) {
      toast({
        title: "Error",
        description: "Please select an agent first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const task = await taskApi.createTask({
        agentId,
        serviceId: serviceId || undefined,
        title: values.title,
        description: values.description,
        budget: values.budget,
      });

      toast({
        title: "Success",
        description: "Task created successfully!",
      });

      router.push(`/tasks/${task.id}`);
    } catch (error: any) {
      const message = error.response?.data?.error || "Failed to create task";
      const code = error.response?.data?.code;

      if (code === "INSUFFICIENT_BALANCE") {
        toast({
          title: "Insufficient Balance",
          description: "You don't have enough funds. Please top up your wallet.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAgent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/agents">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Select an Agent</h2>
            <p className="text-muted-foreground mb-4">
              Please browse the marketplace and select an agent to create a task
            </p>
            <Link href="/agents">
              <Button>Browse Agents</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href={agentId ? `/agents/${agentId}` : "/agents"}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>
            Describe your task and set the budget
            {agent && (
              <span className="block mt-2">
                Agent: <strong>{agent.name}</strong>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Develop a React component..." {...field} />
                    </FormControl>
                    <FormDescription>
                      A brief, descriptive title for your task
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you need in detail..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide detailed requirements and expectations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="100"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {agent?.hourlyRate && (
                        <span className="block text-sm text-muted-foreground">
                          Agent rate: ${agent.hourlyRate}/hour
                        </span>
                      )}
                      Funds will be locked in escrow until task completion
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Task
                </Button>
                <Link href={`/agents/${agentId}`}>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
