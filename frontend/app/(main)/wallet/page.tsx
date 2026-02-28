'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock, CreditCard, TrendingUp, Gift, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Transaction {
  id: string
  type: string
  amount: number
  comment?: string
  taskId?: string
  createdAt: string
}

interface WalletBalance {
  balance: number
  frozen: number
}

const TRANSACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  DEPOSIT: { label: 'Пополнение', icon: ArrowDownCircle, color: 'text-green-500' },
  WITHDRAW: { label: 'Вывод', icon: ArrowUpCircle, color: 'text-red-500' },
  ESCROW_LOCK: { label: 'Заморозка', icon: Lock, color: 'text-yellow-500' },
  ESCROW_RELEASE: { label: 'Разморозка', icon: Unlock, color: 'text-blue-500' },
  PAYMENT: { label: 'Оплата', icon: CreditCard, color: 'text-red-500' },
  EARNING: { label: 'Заработок', icon: TrendingUp, color: 'text-green-500' },
  COMMISSION: { label: 'Комиссия', icon: CreditCard, color: 'text-orange-500' },
  BONUS: { label: 'Бонус', icon: Gift, color: 'text-purple-500' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WalletPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuthStore()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const balanceFetcher = (url: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()) as Promise<WalletBalance>

  const txFetcher = (url: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

  const { data: balance, isLoading: balanceLoading } = useSWR<WalletBalance>(
    token ? `${API_URL}/wallet/balance` : null,
    balanceFetcher,
    { refreshInterval: 10000 },
  )

  const { data: txData, isLoading: txLoading } = useSWR(
    token ? `${API_URL}/wallet/transactions?page=1&limit=20` : null,
    txFetcher,
    { refreshInterval: 10000 },
  )

  const transactions: Transaction[] = txData?.data ?? []

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Кошелёк</h1>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Доступный баланс</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-primary">{balance?.balance ?? 0} Пульсов</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Заморожено</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-yellow-500">{balance?.frozen ?? 0} Пульсов</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deposit Button */}
      <Button className="w-full" size="lg" disabled onClick={() => alert('Пополнение пока недоступно')}>
        Пополнить (скоро)
      </Button>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            История транзакций
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Транзакций пока нет</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const config = TRANSACTION_CONFIG[tx.type] ?? {
                  label: tx.type,
                  icon: CreditCard,
                  color: 'text-gray-500',
                }
                const Icon = config.icon
                const isPositive = tx.amount > 0

                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{config.label}</p>
                      {tx.comment && <p className="text-xs text-muted-foreground truncate">{tx.comment}</p>}
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className={`font-semibold shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{tx.amount} П
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
