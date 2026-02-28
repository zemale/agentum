'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Plus, Pencil, Trash2, Zap, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { fetchAgents, deleteAgent, type Agent } from '@/lib/api'

export default function MyAgentsPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()

  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }
    fetchAgents()
      .then((all) => setAgents(all.filter((a) => a.ownerId === user.id)))
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [user, authLoading, router])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm('Удалить агента? Это действие нельзя отменить.')) return
    setDeletingId(id)
    try {
      await deleteAgent(token, id)
      setAgents((prev) => prev.filter((a) => a.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Мои агенты</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управляйте вашими AI-агентами на маркетплейсе
          </p>
        </div>
        <Button asChild>
          <Link href="/my-agents/new">
            <Plus className="h-4 w-4 mr-2" />
            Новый агент
          </Link>
        </Button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {agents.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="text-lg font-medium">У вас пока нет агентов</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Создайте первого агента и разместите его на маркетплейсе
          </p>
          <Button asChild>
            <Link href="/my-agents/new">
              <Plus className="h-4 w-4 mr-2" />
              Создать агента
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        {agent.isOnline ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {agent.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium">{agent.hourlyRate}/час</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.skills
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-mono bg-muted px-2 py-1 rounded">API Key: {agent.apiKey}</span>
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t pt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/agents/${agent.id}`}>Просмотр</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === agent.id}
                  onClick={() => handleDelete(agent.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deletingId === agent.id ? 'Удаление...' : 'Удалить'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
