import { supabase } from "../lib/supabase";
import type { Priority, Project, Task, TaskStatus } from "../types";

export interface WorkspaceData {
  tasks: Task[];
  projects: Project[];
}

export interface CloudTaskInput {
  id?: string;
  title: string;
  priority: Priority;
  status?: TaskStatus;
  dueDate?: string;
  projectId?: string;
}

export interface CloudProjectInput {
  id?: string;
  name: string;
  description: string;
  color: string;
  aliases: string[];
}

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  project_id: string | null;
  created_at: string;
}

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  aliases: string[];
  created_at: string;
}

function throwOnError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    dueDate: row.due_date ?? undefined,
    projectId: row.project_id ?? undefined,
  };
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    aliases: row.aliases ?? [],
    createdAt: row.created_at,
  };
}

export async function loadWorkspace(userId: string): Promise<WorkspaceData> {
  const [projectsResponse, tasksResponse] = await Promise.all([
    supabase
      .from("fm_projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      }),

    supabase
      .from("fm_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  throwOnError(projectsResponse.error);
  throwOnError(tasksResponse.error);

  return {
    projects: ((projectsResponse.data ?? []) as ProjectRow[]).map(toProject),

    tasks: ((tasksResponse.data ?? []) as TaskRow[]).map(toTask),
  };
}

export async function createCloudTask(
  userId: string,
  input: CloudTaskInput,
): Promise<void> {
  const { error } = await supabase.from("fm_tasks").insert({
    id: input.id ?? crypto.randomUUID(),
    user_id: userId,
    title: input.title.trim(),
    priority: input.priority,
    status: input.status ?? "todo",
    due_date: input.dueDate || null,
    project_id: input.projectId || null,
  });

  throwOnError(error);
}

export async function updateCloudTask(
  userId: string,
  taskId: string,
  changes: Partial<CloudTaskInput>,
): Promise<void> {
  const update: Record<string, unknown> = {};

  if (changes.title !== undefined) {
    update.title = changes.title.trim();
  }

  if (changes.priority !== undefined) {
    update.priority = changes.priority;
  }

  if (changes.status !== undefined) {
    update.status = changes.status;
  }

  if (changes.dueDate !== undefined) {
    update.due_date = changes.dueDate || null;
  }

  if (changes.projectId !== undefined) {
    update.project_id = changes.projectId || null;
  }

  const { error } = await supabase
    .from("fm_tasks")
    .update(update)
    .eq("id", taskId)
    .eq("user_id", userId);

  throwOnError(error);
}

export async function deleteCloudTask(
  userId: string,
  taskId: string,
): Promise<void> {
  const { error } = await supabase
    .from("fm_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  throwOnError(error);
}

export async function createCloudProject(
  userId: string,
  input: CloudProjectInput,
): Promise<void> {
  const { error } = await supabase.from("fm_projects").insert({
    id: input.id ?? crypto.randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    description: input.description,
    color: input.color,
    aliases: input.aliases,
  });

  throwOnError(error);
}

export async function updateCloudProject(
  userId: string,
  projectId: string,
  input: CloudProjectInput,
): Promise<void> {
  const { error } = await supabase
    .from("fm_projects")
    .update({
      name: input.name.trim(),
      description: input.description,
      color: input.color,
      aliases: input.aliases,
    })
    .eq("id", projectId)
    .eq("user_id", userId);

  throwOnError(error);
}

export async function deleteCloudProject(
  userId: string,
  projectId: string,
): Promise<void> {
  // The database relationship intentionally
  // prevents deleting a project that is still
  // referenced by tasks.

  const { error: unlinkError } = await supabase
    .from("fm_tasks")
    .update({ project_id: null })
    .eq("user_id", userId)
    .eq("project_id", projectId);

  throwOnError(unlinkError);

  const { error: deleteError } = await supabase
    .from("fm_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  throwOnError(deleteError);
}
