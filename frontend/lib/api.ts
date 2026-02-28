const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Agent {
  id: string
  ownerId: string
  name: string
  description: string
  skills: string
  hourlyRate: number
  apiKey?: string
  isOnline: boolean
  lastPoll?: string
  rating: number
  totalTasks: number
  successRate: number
  owner: { id: string; name: string }
  services: Service[]
  _count?: { reviews: number; tasks?: number }
}

export interface Service {
  id: string
  agentId: string
  title: string
  description: string
  price: number
  isActive: boolean
}

export interface Review {
  id: string
  taskId: string
  agentId: string
  rating: number
  comment?: string
  createdAt: string
  task?: { title: string; customer: { name: string } }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 204) return null
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'API error')
  return json
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// Agents
export async function fetchAgents(): Promise<Agent[]> {
  return apiFetch('/agents')
}

export async function fetchAgent(id: string): Promise<Agent & { reviews: Review[] }> {
  return apiFetch(`/agents/${id}`)
}

export async function createAgent(
  token: string,
  data: { name: string; description: string; skills: string; hourlyRate: number },
): Promise<Agent> {
  return apiFetch('/agents', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export async function updateAgent(token: string, id: string, data: Partial<Agent>): Promise<Agent> {
  return apiFetch(`/agents/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export async function deleteAgent(token: string, id: string): Promise<void> {
  return apiFetch(`/agents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// Services
export async function fetchServices(agentId: string): Promise<Service[]> {
  return apiFetch(`/agents/${agentId}/services`)
}

export async function createService(
  token: string,
  agentId: string,
  data: { title: string; description: string; price: number },
): Promise<Service> {
  return apiFetch(`/agents/${agentId}/services`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export async function updateService(
  token: string,
  agentId: string,
  serviceId: string,
  data: Partial<Service>,
): Promise<Service> {
  return apiFetch(`/agents/${agentId}/services/${serviceId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export async function deleteService(token: string, agentId: string, serviceId: string): Promise<void> {
  return apiFetch(`/agents/${agentId}/services/${serviceId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// Tasks
export interface Progress {
  id: string
  taskId: string
  message: string
  createdAt: string
}

export interface Task {
  id: string
  customerId: string
  agentId: string
  serviceId?: string
  title: string
  description: string
  budget: number
  status: string
  result?: string
  createdAt: string
  acceptedAt?: string
  completedAt?: string
  autoCloseAt?: string
  agent?: { id: string; name: string }
  progress?: Progress[]
}

export async function fetchTasks(token: string): Promise<Task[]> {
  return apiFetch('/tasks', { headers: authHeaders(token) })
}

export async function fetchTask(token: string, id: string): Promise<Task> {
  return apiFetch(`/tasks/${id}`, { headers: authHeaders(token) })
}

export async function createTask(
  token: string,
  data: { agentId: string; title: string; description: string; budget: number; serviceId?: string },
): Promise<Task> {
  return apiFetch('/tasks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })
}

export async function approveTask(token: string, taskId: string): Promise<Task> {
  return apiFetch(`/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}
