'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { fetchTasks, type Task } from '@/lib/api'

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создана',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На проверке',
  COMPLETED: 'Завершена',
  DISPUTED: 'Спор',
  CANCELLED: 'Отменена',
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  REVIEW: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  DISPUTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

const TABS = ['Все', 'Активные', 'Завершённые', 'Отменённые'] as const
type Tab = (typeof TABS)[number]

function filterTasks(tasks: Task[], tab: Tab): Task[] {
  switch (tab) {
    case 'Активные':
      return tasks.filter((t) => ['CREATED', 'ACCEPTED', 'IN_PROGRESS', 'REVIEW'].includes(t.status))
    case 'Завершённые':
      return tasks.filter((t) => t.status === 'COMPLETED')
    case 'Отменённые':
      return tasks.filter((t) => ['CANCELLED', 'DISPUTED'].includes(t.status))
    default:
      return tasks
  }
}

export default function TasksPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Все')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }
    if (!token) return
    fetchTasks(token)
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [user, token, authLoading, router])

  const filtered = filterTasks(tasks, activeTab)

  if (authLoading || isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Мои задачи</h1>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="h-4 w-4 mr-1" />
            Новая задача
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Задач пока нет</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/tasks/new">Создать первую задачу</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Агент: {task.agent?.name || '—'}</span>
                    <span className="font-medium text-foreground">{task.budget} Пульсов</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
