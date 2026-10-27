
import type { Task } from "../components/Tasks/Tasks";
import type { Project } from "../components/Projects/Projects";

export const STORAGE_KEYS = {
  tasks: "flowmind-tasks",
  projects: "flowmind-projects",
} as const;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    ["low", "medium", "high"].includes(
      String(value.priority)
    ) &&
    ["todo", "in-progress", "completed"].includes(
      String(value.status)
    ) &&
    (
      value.dueDate === undefined ||
      typeof value.dueDate === "string"
    ) &&
    (
      value.projectId === undefined ||
      typeof value.projectId === "string"
    )
  );
}

export function isProject(
  value: unknown
): value is Project {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.color === "string" &&
    typeof value.createdAt === "string"
  );
}

export function loadStoredArray<T>(
  key: string,
  validator: (value: unknown) => value is T
): T[] {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      console.warn(
        `FlowMind: expected an array for ${key}`
      );
      return [];
    }

    return parsed.filter(validator);
  } catch (error) {
    console.error(
      `FlowMind: could not read ${key}`,
      error
    );

    return [];
  }
}

export function saveStoredArray<T>(
  key: string,
  items: T[]
): boolean {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(items)
    );

    return true;
  } catch (error) {
    console.error(
      `FlowMind: could not save ${key}`,
      error
    );

    return false;
  }
}

export function loadTasks(): Task[] {
  return loadStoredArray(
    STORAGE_KEYS.tasks,
    isTask
  );
}

export function loadProjects(): Project[] {
  return loadStoredArray(
    STORAGE_KEYS.projects,
    isProject
  );
}

export function saveTasks(tasks: Task[]): boolean {
  return saveStoredArray(
    STORAGE_KEYS.tasks,
    tasks
  );
}

export function saveProjects(
  projects: Project[]
): boolean {
  return saveStoredArray(
    STORAGE_KEYS.projects,
    projects
  );
}
