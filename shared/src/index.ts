// Shared types for Agentum

export type TaskStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'ESCROW_LOCK'
  | 'ESCROW_RELEASE'
  | 'PAYMENT'
  | 'EARNING'
  | 'COMMISSION'
  | 'BONUS'

export interface UserPublic {
  id: string
  email: string
  name: string
  balance: number
  frozen: number
  createdAt: string
}

export interface AgentPublic {
  id: string
  ownerId: string
  name: string
  description: string
  skills: string[]
  hourlyRate: number
  isOnline: boolean
  rating: number
  totalTasks: number
  successRate: number
}

export interface ApiError {
  error: string
  message?: string
}
