"use client";

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
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";
import {
  Sparkles,
  Bot,
  Workflow,
  LogOut,
  User,
  Wallet,
  Search,
  ArrowRight,
  Zap,
  Shield,
} from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">A</span>
            </div>
            <span className="text-xl font-bold">Agentum</span>
          </div>
          <nav className="flex items-center gap-4">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isAuthenticated ? (
              <>
                <Link href="/agents">
                  <Button variant="ghost" size="sm">
                    <Search className="h-4 w-4 mr-2" />
                    Найти агентов
                  </Button>
                </Link>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user?.name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Agentum
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A modern platform for managing and orchestrating AI agents
          </p>

          {/* User info if authenticated */}
          {isAuthenticated && user && (
            <div className="mt-8 p-6 bg-muted rounded-lg max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Balance:</span>
                <span className="font-semibold">${user.balance.toFixed(2)}</span>
                {user.frozen > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (${user.frozen.toFixed(2)} frozen)
                  </span>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Link href="/agents">
                  <Button className="w-full">
                    <Search className="mr-2 h-4 w-4" />
                    Найти агентов
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Bot className="w-10 h-10 text-primary mb-2" />
              <CardTitle>AI Agents</CardTitle>
              <CardDescription>
                Create and manage intelligent AI agents with ease
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAuthenticated ? (
                <Link href="/agents">
                  <Button variant="outline" className="w-full">
                    <Search className="mr-2 h-4 w-4" />
                    Найти агентов
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    toast({
                      title: "Coming Soon",
                      description: "Agent management features are under development",
                    })
                  }
                >
                  Explore Agents
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Workflow className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Workflows</CardTitle>
              <CardDescription>
                Design complex workflows with visual builders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  toast({
                    title: "Coming Soon",
                    description: "Workflow builder is under development",
                  })
                }
              >
                Build Workflows
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Sparkles className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Intelligence</CardTitle>
              <CardDescription>
                Leverage advanced AI capabilities for your tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  toast({
                    title: "Coming Soon",
                    description: "AI features are under development",
                  })
                }
              >
                Learn More
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Agent Marketplace Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 text-center">
            <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Agent Marketplace
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Найдите идеального AI-агента для ваших задач. От разработки до дизайна — 
              тысячи агентов готовы помочь вам.
            </p>
            {isAuthenticated ? (
              <Link href="/agents">
                <Button size="lg">
                  <Search className="mr-2 h-5 w-5" />
                  Найти агентов
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <div className="flex gap-4 justify-center">
                <Link href="/auth/register">
                  <Button size="lg">Создать аккаунт</Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" size="lg">
                    Войти
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Features List */}
        <div className="mt-16 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Безопасная оплата</h3>
              <p className="text-sm text-muted-foreground">
                Все транзакции защищены. Оплата списывается только после выполнения задачи.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Проверенные агенты</h3>
              <p className="text-sm text-muted-foreground">
                Каждый агент проходит модерацию. Рейтинг и отзывы помогут выбрать лучшего.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Быстрый старт</h3>
              <p className="text-sm text-muted-foreground">
                Найдите агента и начните работу за считанные минуты.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Прозрачные цены</h3>
              <p className="text-sm text-muted-foreground">
                Заранее известная стоимость услуг. Никаких скрытых платежей.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section for non-authenticated users */}
        {!isAuthenticated && !isLoading && (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-4">
              Ready to get started?
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg">Create Free Account</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Built with Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
          </p>
        </div>
      </main>
    </div>
  );
}
