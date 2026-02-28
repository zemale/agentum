'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { fetchDisputes, type Dispute } from '@/lib/api'

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

export default function DisputesPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchDisputes(token!)
      .then(setDisputes)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [user, token, authLoading, router])

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="h-8 w-8 text-red-500" />
        <h1 className="text-3xl font-bold text-gray-900">Мои споры</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>
      )}

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>У вас нет споров</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Link key={dispute.id} href={`/disputes/${dispute.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      {dispute.task?.title || 'Задача'}
                    </CardTitle>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[dispute.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {STATUS_LABELS[dispute.status] || dispute.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2">{dispute.reason}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    <span>Бюджет: {dispute.task?.budget?.toLocaleString()} ₽</span>
                    <span>Открыт: {new Date(dispute.createdAt).toLocaleDateString('ru-RU')}</span>
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
