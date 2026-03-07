import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthUser } from '@/lib/types';
import { authApi, tokenStorage } from '@/lib/api';

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // Set user directly
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
        if (user) {
          tokenStorage.setUser(user);
        }
      },

      // Initialize auth state from storage
      initialize: async () => {
        set({ isLoading: true });
        try {
          const storedUser = tokenStorage.getUser();
          const accessToken = tokenStorage.getAccessToken();
          
          if (storedUser && accessToken) {
            set({ user: storedUser, isAuthenticated: true });
            
            // Try to refresh token to ensure it's still valid
            try {
              await get().refreshToken();
            } catch (error) {
              // Token refresh failed, user will be redirected to login
              console.error('Token refresh failed during initialization:', error);
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(email, password);
          
          // Store tokens
          tokenStorage.setAccessToken(response.accessToken);
          tokenStorage.setRefreshToken(response.refreshToken);
          tokenStorage.setUser(response.user);
          
          // Update state
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Register action
      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.register(email, password, name);
          
          // Store tokens
          tokenStorage.setAccessToken(response.accessToken);
          tokenStorage.setRefreshToken(response.refreshToken);
          tokenStorage.setUser(response.user);
          
          // Update state
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear state regardless of API success
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          tokenStorage.clearTokens();
        }
      },

      // Refresh token action
      refreshToken: async () => {
        try {
          const response = await authApi.refreshToken();
          
          // Store new tokens
          tokenStorage.setAccessToken(response.accessToken);
          tokenStorage.setRefreshToken(response.refreshToken);
          tokenStorage.setUser(response.user);
          
          // Update state
          set({
            user: response.user,
            isAuthenticated: true,
          });
        } catch (error) {
          // Refresh failed, clear auth state
          set({
            user: null,
            isAuthenticated: false,
          });
          tokenStorage.clearTokens();
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

export default useAuthStore;
