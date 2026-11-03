import type { Project, Task } from "../types";

import type { LocalMigrationPreview } from "./localMigrationPreview";

import type { MigrationCloudData, MigrationPlanItem } from "./migrationPlan";

import { buildMigrationPlan } from "./migrationPlan";

import {
  createCloudProject,
  createCloudTask,
  loadWorkspace,
} from "./workspace";

export interface ImportRequest {
  userId: string;
  local: LocalMigrationPreview;
  cloudAtReview: MigrationCloudData;
  selectedKeys: string[];
  projectDecisions: Record<string, string>;
}

export interface ImportResult {
  projectsCreated: number;
  tasksCreated: number;
}

interface PreparedProject {
  source: Project;
}

interface PreparedTask {
  source: Task;
  targetProjectId: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function comparableTitle(value: string): string {
  return normalize(value)
    .replace(/[.!?]+$/g, "")
    .replace(/\s+\d+$/g, "")
    .replace(/([а-яa-z])\d$/i, "$1");
}

function possibleTaskDuplicate(a: Task, b: Task): boolean {
  const left = normalize(a.title);
  const right = normalize(b.title);

  if (left === right) return true;

  const comparableLeft = comparableTitle(a.title);
  const comparableRight = comparableTitle(b.title);

  return comparableLeft.length >= 8 && comparableLeft === comparableRight;
}

function projectNames(project: Project): string[] {
  return [project.name, ...(project.aliases ?? [])].map(normalize);
}

function projectsOverlap(a: Project, b: Project): boolean {
  const names = new Set(projectNames(a));

  return projectNames(b).some((name) => names.has(name));
}

function snapshot(projects: Project[], tasks: Task[]): string {
  const sortedProjects = [...projects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      aliases: project.aliases ?? [],
      createdAt: project.createdAt,
    }));

  const sortedTasks = [...tasks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ?? "",
      projectId: task.projectId ?? "",
      createdAt: task.createdAt,
    }));

  return JSON.stringify({
    projects: sortedProjects,
    tasks: sortedTasks,
  });
}

function requireUUID(id: string, label: string): void {
  if (!UUID.test(id)) {
    throw new Error(`${label} has an unsupported ID: ${id}`);
  }
}

function requirePlanItem(
  items: MigrationPlanItem[],
  key: string,
): MigrationPlanItem {
  const item = items.find((candidate) => candidate.key === key);

  if (!item) {
    throw new Error(`Selected record is missing from the plan: ${key}`);
  }

  return item;
}

function resolveProject(
  sourceId: string,
  localProjects: Project[],
  cloudProjects: Project[],
  decisions: Record<string, string>,
  selected: Set<string>,
): string {
  const existingById = cloudProjects.find((project) => project.id === sourceId);

  if (existingById) {
    return existingById.id;
  }

  const localProject = localProjects.find((project) => project.id === sourceId);

  if (!localProject) {
    throw new Error(`A task refers to a missing local project: ${sourceId}`);
  }

  const decision = decisions[sourceId] ?? "";

  if (decision === "create") {
    if (!selected.has(`project:${sourceId}`)) {
      throw new Error(
        `Project "${localProject.name}" must be selected with its tasks.`,
      );
    }

    return sourceId;
  }

  if (!decision || decision === "skip") {
    throw new Error(`Project "${localProject.name}" has not been mapped.`);
  }

  const destination = cloudProjects.find((project) => project.id === decision);

  if (!destination) {
    throw new Error(
      `The destination project for "${localProject.name}" no longer exists.`,
    );
  }

  return destination.id;
}

export async function executeWorkspaceMigration(
  request: ImportRequest,
): Promise<ImportResult> {
  const { userId, local, cloudAtReview, selectedKeys, projectDecisions } =
    request;

  if (local.hasReadErrors) {
    throw new Error("Local data contains unreadable categories.");
  }

  const selected = new Set(selectedKeys);

  if (selected.size !== selectedKeys.length) {
    throw new Error("Duplicate selection keys detected.");
  }

  if (selected.size === 0) {
    throw new Error("No records have been selected.");
  }

  for (const key of selected) {
    if (!key.startsWith("project:") && !key.startsWith("task:")) {
      throw new Error("Only projects and tasks are supported in this import.");
    }
  }

  // Read the cloud again immediately before
  // preparing any writes.
  const current = await loadWorkspace(userId);

  if (
    snapshot(current.projects, current.tasks) !==
    snapshot(cloudAtReview.projects, cloudAtReview.tasks)
  ) {
    throw new Error(
      "Cloud projects or tasks changed since the review. Refresh the comparison before importing.",
    );
  }

  const plan = buildMigrationPlan(local, {
    ...cloudAtReview,
    projects: current.projects,
    tasks: current.tasks,
  });

  const projectsToCreate: PreparedProject[] = [];
  const tasksToCreate: PreparedTask[] = [];

  for (const key of selected) {
    if (!key.startsWith("project:")) continue;

    const item = requirePlanItem(plan.projects, key);

    if (item.status !== "ready") {
      throw new Error(
        `Project "${item.title}" needs review and cannot be created automatically.`,
      );
    }

    if (projectDecisions[item.sourceId] !== "create") {
      throw new Error(`Project "${item.title}" is not mapped to Create.`);
    }

    const source = local.projects.items.find(
      (project) => project.id === item.sourceId,
    );

    if (!source) {
      throw new Error(`Missing project: ${item.title}`);
    }

    requireUUID(source.id, "Project");

    if (
      current.projects.some(
        (project) =>
          project.id === source.id || projectsOverlap(project, source),
      ) ||
      projectsToCreate.some((entry) => projectsOverlap(entry.source, source))
    ) {
      throw new Error(
        `Project "${source.name}" conflicts with another project.`,
      );
    }

    projectsToCreate.push({ source });
  }

  for (const key of selected) {
    if (!key.startsWith("task:")) continue;

    const item = requirePlanItem(plan.tasks, key);

    const mappingOnlyReview =
      item.status === "review" &&
      item.reason === "The task's project mapping requires confirmation.";

    if (item.status !== "ready" && !mappingOnlyReview) {
      throw new Error(`Task "${item.title}" requires review.`);
    }

    const source = local.tasks.items.find((task) => task.id === item.sourceId);

    if (!source) {
      throw new Error(`Missing task: ${item.title}`);
    }

    requireUUID(source.id, "Task");

    const targetProjectId = source.projectId
      ? resolveProject(
          source.projectId,
          local.projects.items,
          current.projects,
          projectDecisions,
          selected,
        )
      : "";

    if (
      current.tasks.some(
        (task) => task.id === source.id || possibleTaskDuplicate(task, source),
      ) ||
      tasksToCreate.some(
        (entry) =>
          entry.source.id === source.id ||
          possibleTaskDuplicate(entry.source, source),
      )
    ) {
      throw new Error(
        `Task "${source.title}" could duplicate another task. Review it manually.`,
      );
    }

    tasksToCreate.push({
      source,
      targetProjectId,
    });
  }

  const result: ImportResult = {
    projectsCreated: 0,
    tasksCreated: 0,
  };

  try {
    // Projects must exist before linked tasks.
    for (const { source } of projectsToCreate) {
      await createCloudProject(userId, {
        id: source.id,
        name: source.name,
        description: source.description,
        color: source.color,
        aliases: source.aliases ?? [],
      });

      result.projectsCreated += 1;
    }

    for (const { source, targetProjectId } of tasksToCreate) {
      await createCloudTask(userId, {
        id: source.id,
        title: source.title,
        priority: source.priority,
        status: source.status,
        dueDate: source.dueDate,
        projectId: targetProjectId,
      });

      result.tasksCreated += 1;
    }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Unknown database error.";

    throw new Error(
      `Import stopped: ${message} ` +
        `Confirmed saves before the error: ` +
        `${result.projectsCreated} projects, ` +
        `${result.tasksCreated} tasks. ` +
        `The last failed request may also have reached the server. ` +
        `Refresh and compare before retrying.`,
    );
  }

  return result;
}
