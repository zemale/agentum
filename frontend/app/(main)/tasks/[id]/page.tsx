'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { approveTask as approveTaskApi, type Task } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()
  const [isApproving, setIsApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const fetcher = (url: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

  const { data: task, error, mutate } = useSWR<Task>(
    token ? `${API_URL}/tasks/${id}` : null,
    fetcher,
    { refreshInterval: 10000 }, // poll every 10s
  )

  const handleApprove = async () => {
    if (!token) return
    if (!confirm('Подтвердить выполнение задачи? Оплата будет перечислена агенту.')) return
    setIsApproving(true)
    setActionError(null)
    try {
      await approveTaskApi(token, id)
      mutate()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setIsApproving(false)
    }
  }

  if (authLoading || !task) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-destructive">Не удалось загрузить задачу</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/tasks')}>
          К списку задач
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Мои задачи
        </Link>
      </Button>

      {/* Task info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-xl">{task.title}</CardTitle>
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}
            >
              {STATUS_LABELS[task.status] || task.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{task.description}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Агент</p>
              <p className="font-medium">{task.agent?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Бюджет</p>
              <p className="font-medium">{task.budget} Пульсов</p>
            </div>
            <div>
              <p className="text-muted-foreground">Создана</p>
              <p className="font-medium">{new Date(task.createdAt).toLocaleString('ru')}</p>
            </div>
            {task.completedAt && (
              <div>
                <p className="text-muted-foreground">Завершена</p>
                <p className="font-medium">{new Date(task.completedAt).toLocaleString('ru')}</p>
              </div>
            )}
          </div>

          {/* Result */}
          {task.result && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-1 flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Результат работы
              </p>
              <p className="text-sm">{task.result}</p>
            </div>
          )}

          {/* Actions for REVIEW status */}
          {task.status === 'REVIEW' && task.customerId === user?.id && (
            <div className="flex gap-3 pt-2">
              <Button onClick={handleApprove} disabled={isApproving} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                {isApproving ? 'Подтверждение...' : 'Подтвердить результат'}
              </Button>
              <Button variant="destructive" className="flex-1" disabled>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Открыть спор
              </Button>
            </div>
          )}

          {actionError && <p className="text-sm text-destructive">{actionError}</p>}

          {/* Auto-close notice */}
          {task.status === 'REVIEW' && task.autoCloseAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Автоматическое подтверждение: {new Date(task.autoCloseAt).toLocaleString('ru')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress log */}
      {task.progress && task.progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Лог выполнения</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {task.progress.map((p) => (
                <div key={p.id} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-sm">{p.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(p.createdAt).toLocaleString('ru')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {task.progress?.length === 0 && task.status !== 'COMPLETED' && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Агент ещё не добавил обновлений по задаче
        </p>
      )}
    </div>
  )
}
