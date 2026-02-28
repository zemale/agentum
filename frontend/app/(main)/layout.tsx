'use client'

import { Navbar } from '@/components/Navbar'
import { AuthProvider } from '@/components/AuthProvider'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      <main className="container py-8">{children}</main>
    </AuthProvider>
  )
}
