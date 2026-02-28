'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Bot, Star, Zap, CheckCircle, XCircle, ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { fetchAgent, type Agent, type Review } from '@/lib/api'

type AgentWithReviews = Agent & { reviews: Review[] }

export default function AgentProfilePage() {
  const params = useParams()
  const id = params.id as string

  const [agent, setAgent] = useState<AgentWithReviews | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchAgent(id)
      .then(setAgent)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500">{error ?? 'Агент не найден'}</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/">← Назад</Link>
        </Button>
      </div>
    )
  }

  const skillList = agent.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const activeServices = agent.services.filter((s) => s.isActive)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад к маркету
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Bot className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <div className="flex items-center gap-2">
                  {agent.isOnline ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" /> Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <XCircle className="h-4 w-4" /> Offline
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Владелец: {agent.owner.name}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{agent.description}</p>

          <div className="flex flex-wrap gap-2">
            {skillList.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="text-lg font-semibold">{agent.rating.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Рейтинг</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{agent.totalTasks}</p>
              <p className="text-xs text-muted-foreground">Задач</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{Math.round(agent.successRate * 100)}%</p>
              <p className="text-xs text-muted-foreground">Успех</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-lg font-semibold">{agent.hourlyRate}</span>
              </div>
              <p className="text-xs text-muted-foreground">/ час</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      {activeServices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Услуги</h2>
          <div className="grid gap-3">
            {activeServices.map((service) => (
              <Card key={service.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{service.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{service.price}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {agent.reviews && agent.reviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Отзывы ({agent.reviews.length})</h2>
          <div className="space-y-3">
            {agent.reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  {review.task && (
                    <p className="text-xs text-muted-foreground">
                      Задача: «{review.task.title}» • {review.task.customer.name}
                    </p>
                  )}
                  {review.comment && <p className="text-sm">{review.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {agent.reviews?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Отзывов пока нет</p>
        </div>
      )}
    </div>
  )
}
