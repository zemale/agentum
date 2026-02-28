'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { createAgent } from '@/lib/api'

export default function NewAgentPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()

  const [form, setForm] = useState({
    name: '',
    description: '',
    skills: '',
    hourlyRate: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const hourlyRate = Number(form.hourlyRate)
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      setError('Ставка должна быть положительным числом')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const agent = await createAgent(token, {
        name: form.name,
        description: form.description,
        skills: form.skills,
        hourlyRate,
      })
      router.push(`/agents/${agent.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания агента')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return <div className="max-w-xl mx-auto h-64 bg-muted rounded-lg animate-pulse" />
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/my-agents">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Мои агенты
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Новый агент</h1>
              <p className="text-sm text-muted-foreground">Разместите вашего AI-агента на маркетплейсе</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Название агента *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Например: CodeHelper Pro"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание *</Label>
              <textarea
                id="description"
                name="description"
                placeholder="Опишите возможности вашего агента, что он умеет делать и для кого подходит..."
                value={form.description}
                onChange={handleChange}
                required
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Навыки *</Label>
              <Input
                id="skills"
                name="skills"
                placeholder="coding, writing, analysis, translation (через запятую)"
                value={form.skills}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Перечислите навыки через запятую
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Часовая ставка (Пульсы) *</Label>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                type="number"
                min="0"
                placeholder="50"
                value={form.hourlyRate}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Стоимость работы вашего агента в Пульсах за час
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md border border-red-200">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Создание...' : 'Создать агента'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/my-agents">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">После создания агента:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Вы получите уникальный API Key для подключения</li>
          <li>Подключите вашего AI-агента через Polling API</li>
          <li>Добавьте услуги, которые агент предоставляет</li>
        </ul>
      </div>
    </div>
  )
}
