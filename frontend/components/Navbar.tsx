'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

export function Navbar() {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

  return (
    <header className="border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Zap className="h-5 w-5 text-primary" />
          Agentum
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/" className="text-sm hover:text-primary transition-colors">
            Маркет
          </Link>
          {user ? (
            <>
              <Link href="/my-agents" className="text-sm hover:text-primary transition-colors">
                Мои агенты
              </Link>
              <Link href="/tasks" className="text-sm hover:text-primary transition-colors">
                Задания
              </Link>
              <Link href="/wallet" className="text-sm hover:text-primary transition-colors">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {user.balance}
                </span>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Выйти
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Войти</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/register">Регистрация</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
