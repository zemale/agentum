import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AuthResponse, AuthUser } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Token storage keys
const ACCESS_TOKEN_KEY = 'agentum_access_token';
const REFRESH_TOKEN_KEY = 'agentum_refresh_token';
const USER_KEY = 'agentum_user';

// Token storage helpers
export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return null;
  },
  setAccessToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
  },
  getRefreshToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  },
  setRefreshToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
  },
  clearTokens: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },
  getUser: (): AuthUser | null => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  },
  setUser: (user: AuthUser): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
};

// Queue for requests that come in while refreshing token
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue the request
    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    // Start refreshing
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = tokenStorage.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post<AuthResponse>(
        `${API_URL}/api/v1/auth/refresh`,
        { refreshToken }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Store new tokens
      tokenStorage.setAccessToken(accessToken);
      tokenStorage.setRefreshToken(newRefreshToken);

      // Notify subscribers
      onTokenRefreshed(accessToken);

      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed, clear tokens and reject
      tokenStorage.clearTokens();
      
      // Redirect to login if in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Auth API functions
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', { email, password, name });
    return response.data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch (error) {
        // Ignore error, clear tokens anyway
      }
    }
    tokenStorage.clearTokens();
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const response = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },
};

// Task types
export interface Task {
  id: string;
  title: string;
  description?: string;
  budget: number;
  status: TaskStatus;
  result?: string;
  customer?: { id: string; name: string };
  agent?: { id: string; name: string };
  service?: { id: string; title: string; price: number };
  progress?: TaskProgress[];
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  autoCloseAt?: string;
}

export type TaskStatus = 
  | 'CREATED' 
  | 'ACCEPTED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'DISPUTED' 
  | 'CLOSED';

export interface TaskProgress {
  id: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateTaskData {
  agentId: string;
  serviceId?: string;
  title: string;
  description?: string;
  budget: number;
}

export interface TaskListResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Task API functions
export const taskApi = {
  // Get my tasks
  getMyTasks: async (role: 'customer' | 'agent' = 'customer', params?: { status?: string; page?: number; limit?: number }): Promise<TaskListResponse> => {
    const response = await api.get<TaskListResponse>('/tasks/my', { params: { role, ...params } });
    return response.data;
  },

  // Get task by ID
  getTask: async (id: string): Promise<Task> => {
    const response = await api.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  // Create new task
  createTask: async (data: CreateTaskData): Promise<Task> => {
    const response = await api.post<Task>('/tasks', data);
    return response.data;
  },

  // Get task progress
  getTaskProgress: async (id: string): Promise<{ progress: TaskProgress[] }> => {
    const response = await api.get<{ progress: TaskProgress[] }>(`/tasks/${id}/progress`);
    return response.data;
  },

  // Agent actions
  acceptTask: async (id: string): Promise<{ id: string; status: TaskStatus; acceptedAt?: string }> => {
    const response = await api.post(`/tasks/${id}/accept`);
    return response.data;
  },

  declineTask: async (id: string): Promise<{ id: string; status: TaskStatus }> => {
    const response = await api.post(`/tasks/${id}/decline`);
    return response.data;
  },

  startTask: async (id: string): Promise<{ id: string; status: TaskStatus }> => {
    const response = await api.post(`/tasks/${id}/start`);
    return response.data;
  },

  addProgress: async (id: string, message: string, metadata?: Record<string, unknown>): Promise<TaskProgress> => {
    const response = await api.post<TaskProgress>(`/tasks/${id}/progress`, { message, metadata });
    return response.data;
  },

  completeTask: async (id: string, result: string): Promise<{ id: string; status: TaskStatus; result?: string; completedAt?: string; autoCloseAt?: string }> => {
    const response = await api.post(`/tasks/${id}/complete`, { result });
    return response.data;
  },

  // Customer actions
  approveTask: async (id: string): Promise<{ id: string; status: TaskStatus }> => {
    const response = await api.post(`/tasks/${id}/approve`);
    return response.data;
  },

  openDispute: async (id: string, reason: string): Promise<{ id: string; status: TaskStatus }> => {
    const response = await api.post(`/tasks/${id}/dispute`, { reason });
    return response.data;
  },
};

// Agent types
export interface Agent {
  id: string;
  name: string;
  description?: string;
  skills: string[];
  hourlyRate: number;
  rating: number;
  totalTasks: number;
  successRate: number;
  isOnline: boolean;
  createdAt: string;
  services: Service[];
}

export interface Service {
  id: string;
  title: string;
  description?: string;
  price: number;
  isActive: boolean;
}

export interface AgentFilters {
  skills?: string[];
  minRating?: number;
  isOnline?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AgentListResponse {
  agents: Agent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Agent API functions
export const agentApi = {
  // List all agents (marketplace)
  listAgents: async (params?: AgentFilters): Promise<AgentListResponse> => {
    const response = await api.get<AgentListResponse>('/agents', { params });
    return response.data;
  },

  // Get agent by ID
  getAgent: async (id: string): Promise<Agent> => {
    const response = await api.get<Agent>(`/agents/${id}`);
    return response.data;
  },

  // Get my agents
  getMyAgents: async (): Promise<Agent[]> => {
    const response = await api.get<{ agents: Agent[] }>('/agents/my');
    return response.data.agents;
  },

  // Create agent
  createAgent: async (data: {
    name: string;
    description?: string;
    skills: string[];
    hourlyRate: number;
  }): Promise<Agent> => {
    const response = await api.post<Agent>('/agents', data);
    return response.data;
  },

  // Update agent
  updateAgent: async (id: string, data: Partial<{
    name: string;
    description: string;
    skills: string[];
    hourlyRate: number;
  }>): Promise<Agent> => {
    const response = await api.put<Agent>(`/agents/${id}`, data);
    return response.data;
  },

  // Delete agent
  deleteAgent: async (id: string): Promise<void> => {
    await api.delete(`/agents/${id}`);
  },

  // Rotate API key
  rotateApiKey: async (id: string): Promise<{ apiKey: string }> => {
    const response = await api.post<{ apiKey: string }>(`/agents/${id}/rotate-key`);
    return response.data;
  },

  // Update IP whitelist
  updateIpWhitelist: async (id: string, ips: string[]): Promise<{ ipWhitelist: string[] }> => {
    const response = await api.put<{ ipWhitelist: string[] }>(`/agents/${id}/ip-whitelist`, { ips });
    return response.data;
  },

  // Get agent services
  getServices: async (agentId: string): Promise<{ services: Service[] }> => {
    const response = await api.get<{ services: Service[] }>(`/agents/${agentId}/services`);
    return response.data;
  },

  // Create service
  createService: async (agentId: string, data: {
    title: string;
    description?: string;
    price: number;
    isActive?: boolean;
  }): Promise<Service> => {
    const response = await api.post<Service>(`/agents/${agentId}/services`, data);
    return response.data;
  },

  // Update service
  updateService: async (agentId: string, serviceId: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    isActive: boolean;
  }>): Promise<Service> => {
    const response = await api.put<Service>(`/agents/${agentId}/services/${serviceId}`, data);
    return response.data;
  },

  // Delete service
  deleteService: async (agentId: string, serviceId: string): Promise<void> => {
    await api.delete(`/agents/${agentId}/services/${serviceId}`);
  },
};

// Wallet types
export type TransactionType = 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'TASK_PAYMENT' 
  | 'TASK_REFUND' 
  | 'TASK_REWARD' 
  | 'FEE' 
  | 'ADJUSTMENT';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  taskId?: string;
  metadata?: Record<string, unknown>;
  comment?: string;
  createdAt: string;
}

export interface WalletStats {
  balance: number;
  frozen: number;
  total: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  nextCursor: string | null;
}

// Wallet API functions
export const walletApi = {
  // Get wallet stats
  getStats: async (): Promise<WalletStats> => {
    const response = await api.get<WalletStats>('/wallet/stats');
    return response.data;
  },

  // Get transaction history
  getTransactions: async (params?: { 
    type?: TransactionType; 
    limit?: number; 
    cursor?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<TransactionListResponse> => {
    const response = await api.get<TransactionListResponse>('/wallet/transactions', { params });
    return response.data;
  },
};

export default api;
