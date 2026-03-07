import { create } from 'zustand';
import { Task, TaskStatus, TaskProgress } from '@/lib/api';

interface TasksState {
  // State
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  setTasks: (tasks: Task[]) => void;
  setCurrentTask: (task: Task | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  addProgress: (taskId: string, progress: TaskProgress) => void;
  removeTask: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: TasksState['pagination']) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

export const useTasksStore = create<TasksState>((set) => ({
  ...initialState,

  setTasks: (tasks) => set({ tasks }),

  setCurrentTask: (task) => set({ currentTask: task }),

  addTask: (task) => set((state) => ({
    tasks: [task, ...state.tasks],
  })),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    ),
    currentTask: state.currentTask?.id === id
      ? { ...state.currentTask, ...updates }
      : state.currentTask,
  })),

  updateTaskStatus: (id, status) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, status } : t
    ),
    currentTask: state.currentTask?.id === id
      ? { ...state.currentTask, status }
      : state.currentTask,
  })),

  addProgress: (taskId, progress) => set((state) => {
    const updatedProgress = [...(state.currentTask?.progress || []), progress];
    return {
      currentTask: state.currentTask?.id === taskId
        ? { ...state.currentTask, progress: updatedProgress }
        : state.currentTask,
    };
  }),

  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
    currentTask: state.currentTask?.id === id ? null : state.currentTask,
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  setPagination: (pagination) => set({ pagination }),

  reset: () => set(initialState),
}));
