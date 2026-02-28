'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ShieldAlert, ArrowLeft, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { fetchDispute, type Dispute } from '@/lib/api'

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Открыт',
  IN_REVIEW: 'На рассмотрении',
  RESOLVED_CUSTOMER: 'Решён в пользу клиента',
  RESOLVED_AGENT: 'Решён в пользу агента',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  RESOLVED_CUSTOMER: 'bg-green-100 text-green-800',
  RESOLVED_AGENT: 'bg-blue-100 text-blue-800',
}

function isResolved(status: string) {
  return status === 'RESOLVED_CUSTOMER' || status === 'RESOLVED_AGENT'
}

export default function DisputeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, token, isLoading: authLoading } = useAuthStore()
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchDispute(token!, id)
      .then(setDispute)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [user, token, authLoading, router, id])

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (error || !dispute) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Спор не найден'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/disputes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Назад к спорам
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="h-7 w-7 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Спор</h1>
        <span
          className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
            STATUS_COLORS[dispute.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {STATUS_LABELS[dispute.status] || dispute.status}
        </span>
      </div>

      {/* Task info */}
      {dispute.task && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700">Задача</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/tasks/${dispute.task.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {dispute.task.title}
            </Link>
            {dispute.task.description && (
              <p className="mt-1 text-sm text-gray-600">{dispute.task.description}</p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Бюджет: <span className="font-medium">{dispute.task.budget?.toLocaleString()} ₽</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dispute reason */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-700">Причина спора</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-800">{dispute.reason}</p>
          <p className="mt-2 text-xs text-gray-400">
            Открыт: {new Date(dispute.createdAt).toLocaleString('ru-RU')}
          </p>
        </CardContent>
      </Card>

      {/* Status message */}
      {dispute.status === 'OPEN' && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800 text-sm font-medium">Ожидает рассмотрения</p>
          </CardContent>
        </Card>
      )}

      {dispute.status === 'IN_REVIEW' && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-blue-800 text-sm font-medium">Спор рассматривается администратором</p>
          </CardContent>
        </Card>
      )}

      {/* Resolution */}
      {isResolved(dispute.status) && dispute.resolution && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Решение
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-800">{dispute.resolution}</p>
            {dispute.resolvedAt && (
              <p className="mt-2 text-xs text-gray-400">
                Решено: {new Date(dispute.resolvedAt).toLocaleString('ru-RU')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
