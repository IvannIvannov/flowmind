export type Priority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "in-progress" | "completed";

export type TaskSort = "newest" | "oldest" | "priority" | "due-date";

export type Page = "dashboard" | "tasks" | "projects" | "calendar" | "ai";

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  dueDate?: string;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface TaskFormState {
  title: string;
  priority: Priority;
  dueDate: string;
  projectId: string;
  editingId: string | null;
}

export interface TaskFilters {
  search: string;
  status: string;
  project: string;
  sort: TaskSort;
}

export interface ProjectFormState {
  name: string;
  description: string;
  color: string;
  editingId: string | null;
}

export interface DashboardStats {
  total: number;
  inProgress: number;
  completed: number;
  dueToday: number;
  overdue: number;
  projects: number;
}
