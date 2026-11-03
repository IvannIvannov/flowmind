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
  title: string;
  priority: Priority;
  status: TaskStatus;
  created_at: string;
  due_date: string | null;
  project_id: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  color: string;
  aliases: string[];
  created_at: string;
}

function checkError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
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

async function assertUser(expectedUserId: string): Promise<void> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  checkError(error);

  if (!user || user.id !== expectedUserId) {
    throw new Error("Your session has changed. Sign in again.");
  }
}

function taskPayload(userId: string, input: CloudTaskInput) {
  const title = input.title.trim();

  if (!title) {
    throw new Error("Task title is required.");
  }

  return {
    id: input.id ?? crypto.randomUUID(),
    user_id: userId,
    title,
    priority: input.priority,
    status: input.status ?? "todo",
    due_date: input.dueDate || null,
    project_id: input.projectId || null,
  };
}

export async function loadWorkspace(userId: string): Promise<WorkspaceData> {
  await assertUser(userId);

  const [projectsResult, tasksResult] = await Promise.all([
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

  checkError(projectsResult.error);
  checkError(tasksResult.error);

  return {
    projects: ((projectsResult.data ?? []) as ProjectRow[]).map(toProject),
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map(toTask),
  };
}

export async function createCloudTasks(
  userId: string,
  inputs: CloudTaskInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  await assertUser(userId);

  const rows = inputs.map((input) => taskPayload(userId, input));

  const { error } = await supabase.from("fm_tasks").insert(rows);

  checkError(error);
}

export async function createCloudTask(
  userId: string,
  input: CloudTaskInput,
): Promise<void> {
  await createCloudTasks(userId, [input]);
}

export async function updateCloudTask(
  userId: string,
  taskId: string,
  changes: Partial<CloudTaskInput>,
): Promise<void> {
  await assertUser(userId);

  const update: Record<string, unknown> = {};

  if (changes.title !== undefined) {
    const title = changes.title.trim();

    if (!title) {
      throw new Error("Task title is required.");
    }

    update.title = title;
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

  if (Object.keys(update).length === 0) return;

  const { data, error } = await supabase
    .from("fm_tasks")
    .update(update)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("id");

  checkError(error);

  if (!data?.length) {
    throw new Error("Task not found or access denied.");
  }
}

export async function deleteCloudTask(
  userId: string,
  taskId: string,
): Promise<void> {
  await assertUser(userId);

  const { data, error } = await supabase
    .from("fm_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("id");

  checkError(error);

  if (!data?.length) {
    throw new Error("Task not found or access denied.");
  }
}

export async function createCloudProject(
  userId: string,
  input: CloudProjectInput,
): Promise<void> {
  await assertUser(userId);

  const { error } = await supabase.from("fm_projects").insert({
    id: input.id ?? crypto.randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color,
    aliases: input.aliases,
  });

  checkError(error);
}

export async function updateCloudProject(
  userId: string,
  projectId: string,
  input: CloudProjectInput,
): Promise<void> {
  await assertUser(userId);

  const { data, error } = await supabase
    .from("fm_projects")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      color: input.color,
      aliases: input.aliases,
    })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id");

  checkError(error);

  if (!data?.length) {
    throw new Error("Project not found or access denied.");
  }
}

export async function deleteCloudProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await assertUser(userId);

  const { error: unlinkError } = await supabase
    .from("fm_tasks")
    .update({ project_id: null })
    .eq("user_id", userId)
    .eq("project_id", projectId);

  checkError(unlinkError);

  const { data, error } = await supabase
    .from("fm_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id");

  checkError(error);

  if (!data?.length) {
    throw new Error("Project not found or access denied.");
  }
}
