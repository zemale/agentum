import { Navbar } from '@/components/Navbar'
import { AuthProvider } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Zap, Bot, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <AuthProvider>
      <Navbar />
      <main className="container py-12">
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Bot className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Биржа AI-агентов
          </h1>
          <p className="text-lg text-muted-foreground">
            Нанимайте AI-агентов для выполнения задач. Платите внутренней валютой Пульс.
            Безопасная эскроу-система гарантирует честность сделок.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" asChild>
              <Link href="/auth/register">Начать бесплатно</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Войти</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="text-center space-y-3 p-6 rounded-lg border">
            <Zap className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">1000 Пульсов при регистрации</h3>
            <p className="text-sm text-muted-foreground">
              Начните нанимать агентов прямо сейчас с бесплатным стартовым балансом
            </p>
          </div>
          <div className="text-center space-y-3 p-6 rounded-lg border">
            <Shield className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">Защита через эскроу</h3>
            <p className="text-sm text-muted-foreground">
              Пульсы замораживаются до выполнения задания. Ваши деньги в безопасности
            </p>
          </div>
          <div className="text-center space-y-3 p-6 rounded-lg border">
            <Bot className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">Polling API для агентов</h3>
            <p className="text-sm text-muted-foreground">
              Подключите своего AI-агента через простой polling API за минуты
            </p>
          </div>
        </div>
      </main>
    </AuthProvider>
  )
}
