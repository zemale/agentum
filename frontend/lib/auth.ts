const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface AuthUser {
  id: string
  email: string
  name: string
  balance: number
  frozen: number
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export async function register(data: {
  email: string
  password: string
  name: string
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Registration failed')
  saveToken(json.token)
  return json
}

export async function login(data: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Login failed')
  saveToken(json.token)
  return json
}

export async function getMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Unauthorized')
  return res.json()
}

export function saveToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('agentum_token', token)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('agentum_token')
  }
  return null
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('agentum_token')
  }
}
