import { api } from '../api';
import {
  Agent,
  Service,
  CreateAgentInput,
  UpdateAgentInput,
  CreateServiceInput,
  UpdateServiceInput,
  PaginationInput,
} from '../types';

// Generic API response type
interface ApiResponse<T> {
  data: T;
  success?: boolean;
  error?: string;
}

// Agent filters interface
export interface AgentFilters {
  skills?: string[];
  minRating?: number;
  maxRating?: number;
  minPrice?: number;
  maxPrice?: number;
  onlineOnly?: boolean;
  search?: string;
}

// Agent with marketplace fields
export interface AgentWithStats extends Agent {
  isOnline: boolean;
  rating: number;
  totalTasks: number;
  successRate: number;
  reviewsCount?: number;
  tasksCount?: number;
}

// Agent list response with pagination
export interface AgentsListResponse {
  agents: AgentWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Agent statistics
export interface AgentStatistics {
  tasksCount: number;
  completedTasks: number;
  rating: number;
  earnings: number;
  totalEarnings: number;
}

// Extended agent with services and stats
export interface AgentWithDetails extends Agent {
  services: Service[];
  statistics?: AgentStatistics;
  apiKey?: string;
  ipWhitelist?: string[];
  isOnline: boolean;
  rating: number;
  totalTasks: number;
  successRate: number;
  reviewsCount?: number;
  tasksCount?: number;
}

// Get agents list with filters and pagination
export async function getAgents(
  filters: AgentFilters = {},
  pagination: PaginationInput = { page: 1, limit: 10 }
): Promise<AgentsListResponse> {
  const params = new URLSearchParams();
  
  // Add filters
  if (filters.skills?.length) {
    params.append('skills', filters.skills.join(','));
  }
  if (filters.minRating !== undefined) {
    params.append('minRating', filters.minRating.toString());
  }
  if (filters.maxRating !== undefined) {
    params.append('maxRating', filters.maxRating.toString());
  }
  if (filters.minPrice !== undefined) {
    params.append('minPrice', filters.minPrice.toString());
  }
  if (filters.maxPrice !== undefined) {
    params.append('maxPrice', filters.maxPrice.toString());
  }
  if (filters.onlineOnly) {
    params.append('onlineOnly', 'true');
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  
  // Add pagination
  params.append('page', pagination.page.toString());
  params.append('limit', pagination.limit.toString());
  
  const response = await api.get<AgentsListResponse>(`/agents?${params.toString()}`);
  return response.data;
}

// Get single agent by ID
export async function getAgent(id: string): Promise<AgentWithDetails> {
  const response = await api.get<ApiResponse<AgentWithDetails>>(`/agents/${id}`);
  return response.data.data;
}

// Create new agent
export async function createAgent(data: CreateAgentInput): Promise<Agent> {
  const response = await api.post<ApiResponse<Agent>>('/agents', data);
  return response.data.data;
}

// Update agent
export async function updateAgent(id: string, data: UpdateAgentInput): Promise<Agent> {
  const response = await api.put<ApiResponse<Agent>>(`/agents/${id}`, data);
  return response.data.data;
}

// Delete agent
export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

// Get my agents (for current user)
export async function getMyAgents(): Promise<AgentWithStats[]> {
  const response = await api.get<ApiResponse<AgentWithStats[]>>('/agents/my');
  return response.data.data;
}

// Create service for agent
export async function createService(
  agentId: string,
  data: CreateServiceInput
): Promise<Service> {
  const response = await api.post<ApiResponse<Service>>(
    `/agents/${agentId}/services`,
    data
  );
  return response.data.data;
}

// Update service
export async function updateService(
  agentId: string,
  serviceId: string,
  data: UpdateServiceInput
): Promise<Service> {
  const response = await api.put<ApiResponse<Service>>(
    `/agents/${agentId}/services/${serviceId}`,
    data
  );
  return response.data.data;
}

// Delete service
export async function deleteService(agentId: string, serviceId: string): Promise<void> {
  await api.delete(`/agents/${agentId}/services/${serviceId}`);
}

// Rotate API key
export async function rotateApiKey(agentId: string): Promise<string> {
  const response = await api.post<ApiResponse<{ apiKey: string }>>(
    `/agents/${agentId}/rotate-api-key`
  );
  return response.data.data.apiKey;
}

// Update IP whitelist
export async function updateIpWhitelist(
  agentId: string,
  ips: string[]
): Promise<string[]> {
  const response = await api.put<ApiResponse<{ ipWhitelist: string[] }>>(
    `/agents/${agentId}/ip-whitelist`,
    { ips }
  );
  return response.data.data.ipWhitelist;
}

// Get agent statistics
export async function getAgentStatistics(agentId: string): Promise<AgentStatistics> {
  const response = await api.get<ApiResponse<AgentStatistics>>(
    `/agents/${agentId}/statistics`
  );
  return response.data.data;
}
