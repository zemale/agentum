"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTasksStore } from "@/store/tasks";
import { taskApi, Task, TaskStatus, TaskProgress } from "@/lib/api";
import {
  Loader2,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Send,
  ThumbsUp,
  AlertTriangle,
  User,
  Bot,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  CREATED: { label: "Created", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-4 w-4" /> },
  ACCEPTED: { label: "Accepted", color: "bg-yellow-100 text-yellow-800", icon: <CheckCircle className="h-4 w-4" /> },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-100 text-purple-800", icon: <Play className="h-4 w-4" /> },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: <XCircle className="h-4 w-4" /> },
  DISPUTED: { label: "Disputed", color: "bg-red-100 text-red-800", icon: <AlertCircle className="h-4 w-4" /> },
  CLOSED: { label: "Closed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> },
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const { currentTask, setCurrentTask, updateTaskStatus, addProgress } = useTasksStore();

  const taskId = params.id as string;

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  const loadTask = async () => {
    setIsLoading(true);
    try {
      const task = await taskApi.getTask(taskId);
      setCurrentTask(task);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load task",
        variant: "destructive",
      });
      router.push("/tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Agent actions
  const handleAccept = async () => {
    setIsActionLoading(true);
    try {
      await taskApi.acceptTask(taskId);
      updateTaskStatus(taskId, "ACCEPTED");
      toast({ title: "Success", description: "Task accepted" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to accept task",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsActionLoading(true);
    try {
      await taskApi.declineTask(taskId);
      updateTaskStatus(taskId, "CANCELLED");
      toast({ title: "Success", description: "Task declined" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to decline task",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStart = async () => {
    setIsActionLoading(true);
    try {
      await taskApi.startTask(taskId);
      updateTaskStatus(taskId, "IN_PROGRESS");
      toast({ title: "Success", description: "Task started" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to start task",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddProgress = async () => {
    if (!progressMessage.trim()) return;

    setIsActionLoading(true);
    try {
      const progress = await taskApi.addProgress(taskId, progressMessage);
      addProgress(taskId, progress);
      setProgressMessage("");
      toast({ title: "Success", description: "Progress added" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to add progress",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!result.trim()) {
      toast({
        title: "Error",
        description: "Please provide a result",
        variant: "destructive",
      });
      return;
    }

    setIsActionLoading(true);
    try {
      await taskApi.completeTask(taskId, result);
      updateTaskStatus(taskId, "COMPLETED");
      toast({ title: "Success", description: "Task completed" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to complete task",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Customer actions
  const handleApprove = async () => {
    setIsActionLoading(true);
    try {
      await taskApi.approveTask(taskId);
      updateTaskStatus(taskId, "CLOSED");
      toast({ title: "Success", description: "Task approved! Payment released to agent." });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to approve task",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!disputeReason.trim() || disputeReason.length < 10) {
      toast({
        title: "Error",
        description: "Please provide a detailed reason (min 10 characters)",
        variant: "destructive",
      });
      return;
    }

    setIsActionLoading(true);
    try {
      await taskApi.openDispute(taskId, disputeReason);
      updateTaskStatus(taskId, "DISPUTED");
      toast({ title: "Success", description: "Dispute opened" });
      loadTask();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to open dispute",
        variant: "destructive",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Task not found</p>
            <Link href="/tasks" className="mt-4 inline-block">
              <Button>Back to Tasks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[currentTask.status];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/tasks">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </Link>

      {/* Task Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={status.color}>
                  <span className="flex items-center gap-1">
                    {status.icon}
                    {status.label}
                  </span>
                </Badge>
                <span className="text-muted-foreground">#{currentTask.id.slice(0, 8)}</span>
              </div>
              <CardTitle className="text-2xl">{currentTask.title}</CardTitle>
              <CardDescription className="mt-2 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Budget: ${currentTask.budget}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Customer: {currentTask.customer?.name}
                </span>
                <span className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  Agent: {currentTask.agent?.name}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {currentTask.description}
          </p>

          {/* Dates */}
          <div className="mt-6 text-sm text-muted-foreground">
            <p>Created: {new Date(currentTask.createdAt).toLocaleString()}</p>
            {currentTask.acceptedAt && (
              <p>Accepted: {new Date(currentTask.acceptedAt).toLocaleString()}</p>
            )}
            {currentTask.completedAt && (
              <p>Completed: {new Date(currentTask.completedAt).toLocaleString()}</p>
            )}
            {currentTask.autoCloseAt && currentTask.status === "COMPLETED" && (
              <p className="text-orange-600">
                Auto-closes: {new Date(currentTask.autoCloseAt).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Actions */}
      {currentTask.status === "CREATED" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Accept Task?</CardTitle>
            <CardDescription>
              Review the requirements before accepting this task
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={handleAccept} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Accept Task
            </Button>
            <Button variant="outline" onClick={handleDecline} disabled={isActionLoading}>
              Decline
            </Button>
          </CardContent>
        </Card>
      )}

      {currentTask.status === "ACCEPTED" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ready to Start?</CardTitle>
            <CardDescription>
              Click start to begin working on this task
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStart} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Play className="h-4 w-4 mr-2" />
              Start Task
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress Section (for active tasks) */}
      {(currentTask.status === "ACCEPTED" || currentTask.status === "IN_PROGRESS") && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Progress Log</CardTitle>
            <CardDescription>Keep the customer updated on your progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a progress update..."
                value={progressMessage}
                onChange={(e) => setProgressMessage(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAddProgress}
                disabled={isActionLoading || !progressMessage.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Task */}
      {currentTask.status === "IN_PROGRESS" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Complete Task</CardTitle>
            <CardDescription>Submit your work and mark the task as complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe the results and provide any deliverables..."
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="min-h-[150px]"
            />
            <Button onClick={handleComplete} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Complete
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer Actions for Completed Task */}
      {currentTask.status === "COMPLETED" && (
        <Card className="mb-6 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Task Completed
            </CardTitle>
            <CardDescription>
              Review the results and approve or open a dispute
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTask.result && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Result:</h4>
                <p className="whitespace-pre-wrap">{currentTask.result}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={handleApprove} disabled={isActionLoading} className="bg-green-600 hover:bg-green-700">
                {isActionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve & Pay
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Open Dispute
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Open Dispute</DialogTitle>
                    <DialogDescription>
                      Describe the issue with this task. An admin will review your case.
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Explain what went wrong..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <DialogFooter>
                    <Button variant="destructive" onClick={handleOpenDispute} disabled={isActionLoading}>
                      {isActionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Open Dispute
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {currentTask.autoCloseAt && (
              <p className="text-sm text-orange-600">
                This task will be auto-approved on{" "}
                {new Date(currentTask.autoCloseAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress History */}
      {currentTask.progress && currentTask.progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progress History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentTask.progress.map((p, index) => (
                <div key={p.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1">{p.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
