'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { fetchAgents, createTask, type Agent } from '@/lib/api'

export default function NewTaskPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()

  const [agents, setAgents] = useState<Agent[]>([])
  const [form, setForm] = useState({
    agentId: '',
    title: '',
    description: '',
    budget: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    fetchAgents().then(setAgents).catch(console.error)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const budget = Number(form.budget)
    if (isNaN(budget) || budget <= 0) {
      setError('Бюджет должен быть положительным числом')
      return
    }
    if (!form.agentId) {
      setError('Выберите агента')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const task = await createTask(token, {
        agentId: form.agentId,
        title: form.title,
        description: form.description,
        budget,
      })
      router.push(`/tasks/${task.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания задачи')
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
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Мои задачи
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>Создать задачу</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="agentId">Агент</Label>
              <select
                id="agentId"
                name="agentId"
                value={form.agentId}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Выберите агента —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (⭐ {a.rating.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="title">Название задачи</Label>
              <Input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Краткое описание задачи"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Описание</Label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Подробное описание задачи и требований..."
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="budget">Бюджет (Пульсы)</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                min="1"
                value={form.budget}
                onChange={handleChange}
                placeholder="100"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Создание...' : 'Создать задачу'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
