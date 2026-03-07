"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTasksStore } from "@/store/tasks";
import { taskApi, Task, TaskStatus } from "@/lib/api";
import {
  Loader2,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Briefcase,
  User,
} from "lucide-react";

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  CREATED: { label: "Created", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-3 w-3" /> },
  ACCEPTED: { label: "Accepted", color: "bg-yellow-100 text-yellow-800", icon: <CheckCircle className="h-3 w-3" /> },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-100 text-purple-800", icon: <Loader2 className="h-3 w-3" /> },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: <XCircle className="h-3 w-3" /> },
  DISPUTED: { label: "Disputed", color: "bg-red-100 text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
  CLOSED: { label: "Closed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
};

interface TaskCardProps {
  task: Task;
  role: "customer" | "agent";
}

function TaskCard({ task, role }: TaskCardProps) {
  const status = statusConfig[task.status];

  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={status.color}>
                  <span className="flex items-center gap-1">
                    {status.icon}
                    {status.label}
                  </span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ${task.budget}
                </span>
              </div>
              <h3 className="font-semibold text-lg truncate">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                {role === "customer" ? (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {task.agent?.name || "Unknown Agent"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {task.customer?.name || "Unknown Customer"}
                  </span>
                )}
                <span>{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"customer" | "agent">("customer");
  const [isLoading, setIsLoading] = useState(false);
  const { tasks, setTasks, pagination, setPagination } = useTasksStore();

  useEffect(() => {
    loadTasks();
  }, [activeTab]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const response = await taskApi.getMyTasks(activeTab, { page: 1, limit: 20 });
      setTasks(response.tasks);
      setPagination(response.pagination);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tasks by status
  const activeTasks = tasks.filter((t) =>
    ["CREATED", "ACCEPTED", "IN_PROGRESS"].includes(t.status)
  );
  const completedTasks = tasks.filter((t) =>
    ["COMPLETED", "CLOSED"].includes(t.status)
  );
  const otherTasks = tasks.filter((t) =>
    ["CANCELLED", "DISPUTED"].includes(t.status)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tasks and track progress
          </p>
        </div>
        <Link href="/tasks/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </Link>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "customer" | "agent")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="customer">As Customer</TabsTrigger>
          <TabsTrigger value="agent">As Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="space-y-6">
          <TaskList
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            otherTasks={otherTasks}
            isLoading={isLoading}
            role="customer"
          />
        </TabsContent>

        <TabsContent value="agent" className="space-y-6">
          <TaskList
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            otherTasks={otherTasks}
            isLoading={isLoading}
            role="agent"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TaskListProps {
  activeTasks: Task[];
  completedTasks: Task[];
  otherTasks: Task[];
  isLoading: boolean;
  role: "customer" | "agent";
}

function TaskList({ activeTasks, completedTasks, otherTasks, isLoading, role }: TaskListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Tasks */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Active Tasks</h2>
        {activeTasks.length > 0 ? (
          <div className="grid gap-4">
            {activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No active tasks
            </CardContent>
          </Card>
        )}
      </section>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Completed</h2>
          <div className="grid gap-4">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        </section>
      )}

      {/* Other Tasks */}
      {otherTasks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Other</h2>
          <div className="grid gap-4">
            {otherTasks.map((task) => (
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
