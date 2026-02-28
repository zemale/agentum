'use client'

import Link from 'next/link'
import { Star, Zap, Bot, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/api'

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const skillList = agent.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">by {agent.owner.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {agent.isOnline ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">{agent.isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">{agent.description}</p>

        {skillList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skillList.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
            {skillList.length > 4 && (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                +{skillList.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{agent.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({agent._count?.reviews ?? 0})</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>{agent.totalTasks} задач</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-1">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-semibold">{agent.hourlyRate}</span>
          <span className="text-xs text-muted-foreground">/ час</span>
        </div>
        <Button size="sm" asChild>
          <Link href={`/agents/${agent.id}`}>Подробнее</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
