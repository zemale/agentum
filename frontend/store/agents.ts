import { create } from 'zustand';
import { Agent, CreateAgentInput, UpdateAgentInput, Service, CreateServiceInput, UpdateServiceInput } from '@/lib/types';
import {
  getAgents,
  getAgent,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
  getMyAgents,
  createService as apiCreateService,
  updateService as apiUpdateService,
  deleteService as apiDeleteService,
  rotateApiKey as apiRotateApiKey,
  updateIpWhitelist as apiUpdateIpWhitelist,
  getAgentStatistics,
  AgentFilters,
  AgentWithDetails,
  AgentStatistics,
} from '@/lib/api/agents';

export interface AgentsState {
  // State
  agents: Agent[];
  selectedAgent: AgentWithDetails | null;
  myAgents: Agent[];
  agentStatistics: AgentStatistics | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AgentsActions {
  // Actions
  fetchAgents: (filters?: AgentFilters, page?: number, limit?: number) => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  createAgent: (data: CreateAgentInput) => Promise<Agent>;
  updateAgent: (id: string, data: UpdateAgentInput) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  fetchMyAgents: () => Promise<void>;
  clearSelectedAgent: () => void;
  clearError: () => void;
  
  // Service actions
  createService: (agentId: string, data: CreateServiceInput) => Promise<Service>;
  updateService: (agentId: string, serviceId: string, data: UpdateServiceInput) => Promise<Service>;
  deleteService: (agentId: string, serviceId: string) => Promise<void>;
  
  // API Key management
  rotateApiKey: (agentId: string) => Promise<string>;
  updateIpWhitelist: (agentId: string, ips: string[]) => Promise<string[]>;
  
  // Statistics
  fetchAgentStatistics: (agentId: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState & AgentsActions>((set, get) => ({
  // Initial state
  agents: [],
  selectedAgent: null,
  myAgents: [],
  agentStatistics: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },

  // Fetch agents with filters and pagination
  fetchAgents: async (filters = {}, page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const response = await getAgents(filters, { page, limit });
      set({
        agents: response.agents,
        pagination: {
          total: response.total,
          page: response.page,
          limit: response.limit,
          totalPages: response.totalPages,
        },
        loading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch agents';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Fetch single agent
  fetchAgent: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const agent = await getAgent(id);
      set({ selectedAgent: agent, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch agent';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Create agent
  createAgent: async (data: CreateAgentInput) => {
    set({ loading: true, error: null });
    try {
      const agent = await apiCreateAgent(data);
      set((state) => ({
        myAgents: [...state.myAgents, agent],
        loading: false,
      }));
      return agent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create agent';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Update agent
  updateAgent: async (id: string, data: UpdateAgentInput) => {
    set({ loading: true, error: null });
    try {
      const agent = await apiUpdateAgent(id, data);
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? agent : a)),
        myAgents: state.myAgents.map((a) => (a.id === id ? agent : a)),
        selectedAgent: state.selectedAgent?.id === id 
          ? { ...state.selectedAgent, ...agent } 
          : state.selectedAgent,
        loading: false,
      }));
      return agent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update agent';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Delete agent
  deleteAgent: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteAgent(id);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        myAgents: state.myAgents.filter((a) => a.id !== id),
        selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete agent';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Fetch my agents
  fetchMyAgents: async () => {
    set({ loading: true, error: null });
    try {
      const agents = await getMyAgents();
      set({ myAgents: agents, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch my agents';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Clear selected agent
  clearSelectedAgent: () => {
    set({ selectedAgent: null, agentStatistics: null });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Create service
  createService: async (agentId: string, data: CreateServiceInput) => {
    set({ loading: true, error: null });
    try {
      const service = await apiCreateService(agentId, data);
      set((state) => ({
        selectedAgent: state.selectedAgent
          ? {
              ...state.selectedAgent,
              services: [...(state.selectedAgent.services || []), service],
            }
          : null,
        loading: false,
      }));
      return service;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create service';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Update service
  updateService: async (agentId: string, serviceId: string, data: UpdateServiceInput) => {
    set({ loading: true, error: null });
    try {
      const service = await apiUpdateService(agentId, serviceId, data);
      set((state) => ({
        selectedAgent: state.selectedAgent
          ? {
              ...state.selectedAgent,
              services: state.selectedAgent.services?.map((s) =>
                s.id === serviceId ? service : s
              ) || [],
            }
          : null,
        loading: false,
      }));
      return service;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update service';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Delete service
  deleteService: async (agentId: string, serviceId: string) => {
    set({ loading: true, error: null });
    try {
      await apiDeleteService(agentId, serviceId);
      set((state) => ({
        selectedAgent: state.selectedAgent
          ? {
              ...state.selectedAgent,
              services: state.selectedAgent.services?.filter((s) => s.id !== serviceId) || [],
            }
          : null,
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete service';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Rotate API key
  rotateApiKey: async (agentId: string) => {
    set({ loading: true, error: null });
    try {
      const apiKey = await apiRotateApiKey(agentId);
      set((state) => ({
        selectedAgent: state.selectedAgent
          ? { ...state.selectedAgent, apiKey }
          : null,
        loading: false,
      }));
      return apiKey;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rotate API key';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Update IP whitelist
  updateIpWhitelist: async (agentId: string, ips: string[]) => {
    set({ loading: true, error: null });
    try {
      const ipWhitelist = await apiUpdateIpWhitelist(agentId, ips);
      set((state) => ({
        selectedAgent: state.selectedAgent
          ? { ...state.selectedAgent, ipWhitelist }
          : null,
        loading: false,
      }));
      return ipWhitelist;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update IP whitelist';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Fetch agent statistics
  fetchAgentStatistics: async (agentId: string) => {
    try {
      const statistics = await getAgentStatistics(agentId);
      set({ agentStatistics: statistics });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch statistics';
      set({ error: message });
      throw error;
    }
  },
}));

export default useAgentsStore;
