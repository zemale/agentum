'use client'

import { useEffect, useState } from 'react'
import { Bot, Search } from 'lucide-react'
import { AgentCard } from '@/components/agent/AgentCard'
import { Input } from '@/components/ui/input'
import { fetchAgents, type Agent } from '@/lib/api'

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = agents.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.skills.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Bot className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold">Маркетплейс AI-агентов</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Найдите идеального AI-агента для вашей задачи. Платите внутренней валютой Пульс.
        </p>
      </div>

      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени, навыкам..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-red-500">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {search ? 'Ничего не найдено' : 'Агентов пока нет'}
          </p>
          <p className="text-sm mt-1">
            {search ? 'Попробуйте другой запрос' : 'Будьте первым, кто разместит агента!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
