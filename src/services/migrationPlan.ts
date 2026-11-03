import type { Project, Task } from "../types";

import type { InboxItem } from "../utils/inboxStorage";

import type { FocusHistoryEntry } from "../utils/focusHistory";

import type { LocalMigrationPreview } from "./localMigrationPreview";

export interface MigrationCloudData {
  tasks: Task[];
  projects: Project[];
  inbox: InboxItem[];
  focusHistory: FocusHistoryEntry[];
}

export type MigrationStatus =
  | "existing"
  | "conflict"
  | "review"
  | "ready"
  | "blocked";

export type MigrationKind = "project" | "task" | "inbox" | "focus";

export interface MigrationPlanItem {
  key: string;
  kind: MigrationKind;
  sourceId: string;
  title: string;
  status: MigrationStatus;
  reason: string;
  suggestedTargetId?: string;
  originalProjectId?: string;
  suggestedProjectId?: string;
}

export interface MigrationPlan {
  projects: MigrationPlanItem[];
  tasks: MigrationPlanItem[];
  inbox: MigrationPlanItem[];
  focusHistory: MigrationPlanItem[];
  total: number;
  ready: number;
  needsReview: number;
  existing: number;
  conflicts: number;
  blocked: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function comparableTitle(value: string): string {
  return normalize(value)
    .replace(/[.!?]+$/g, "")
    .replace(/\s+\d+$/g, "")
    .replace(/([а-яa-z])\d$/i, "$1");
}

function makeItem(
  kind: MigrationKind,
  id: string,
  title: string,
  status: MigrationStatus,
  reason: string,
  extra: Partial<MigrationPlanItem> = {},
): MigrationPlanItem {
  return {
    key: `${kind}:${id}`,
    kind,
    sourceId: id,
    title,
    status,
    reason,
    ...extra,
  };
}

function planProjects(local: Project[], cloud: Project[]): MigrationPlanItem[] {
  return local.map((project) => {
    const sameId = cloud.find((item) => item.id === project.id);

    if (sameId) {
      return makeItem(
        "project",
        project.id,
        project.name,
        "existing",
        "A project with this ID already exists. It will not be overwritten.",
        {
          suggestedTargetId: sameId.id,
        },
      );
    }

    const matches = cloud.filter((item) => {
      const localNames = [project.name, ...(project.aliases ?? [])].map(
        normalize,
      );

      const cloudNames = [item.name, ...(item.aliases ?? [])].map(normalize);

      return localNames.some((name) => cloudNames.includes(name));
    });

    if (matches.length > 0) {
      return makeItem(
        "project",
        project.id,
        project.name,
        "review",
        "A project with a matching name or alias exists. Confirm whether these projects should be linked.",
        {
          suggestedTargetId: matches.length === 1 ? matches[0].id : undefined,
        },
      );
    }

    if (!isUuid(project.id)) {
      return makeItem(
        "project",
        project.id,
        project.name,
        "blocked",
        "The original project ID is not a valid UUID. A new ID mapping is required.",
      );
    }

    return makeItem(
      "project",
      project.id,
      project.name,
      "ready",
      "No matching cloud project was found.",
    );
  });
}

function planTasks(
  local: Task[],
  cloud: Task[],
  projectPlan: MigrationPlanItem[],
): MigrationPlanItem[] {
  const projectIndex = new Map(
    projectPlan.map((item) => [item.sourceId, item]),
  );

  return local.map((task) => {
    const extra: Partial<MigrationPlanItem> = {
      originalProjectId: task.projectId,
    };

    if (task.projectId) {
      const project = projectIndex.get(task.projectId);

      if (!project) {
        return makeItem(
          "task",
          task.id,
          task.title,
          "blocked",
          "The original project is missing. Its relationship must be resolved before import.",
          extra,
        );
      }

      if (project.status === "existing" || project.status === "review") {
        extra.suggestedProjectId = project.suggestedTargetId;
      } else if (project.status === "ready") {
        extra.suggestedProjectId = project.sourceId;
      }

      if (
        project.status === "blocked" ||
        (project.status === "review" && !project.suggestedTargetId)
      ) {
        return makeItem(
          "task",
          task.id,
          task.title,
          "blocked",
          "The linked project requires resolution before this task can be imported.",
          extra,
        );
      }
    }

    const sameId = cloud.find((item) => item.id === task.id);

    if (sameId) {
      return makeItem(
        "task",
        task.id,
        task.title,
        "existing",
        "A cloud task with the same ID already exists. No overwrite is allowed.",
        {
          ...extra,
          suggestedTargetId: sameId.id,
        },
      );
    }

    const matches = cloud.filter(
      (item) =>
        normalize(item.title) === normalize(task.title) ||
        (comparableTitle(item.title).length >= 8 &&
          comparableTitle(item.title) === comparableTitle(task.title)),
    );

    if (matches.length > 0) {
      return makeItem(
        "task",
        task.id,
        task.title,
        "review",
        "A similarly named task exists in cloud. Check its due date, status and project before deciding.",
        {
          ...extra,
          suggestedTargetId: matches.length === 1 ? matches[0].id : undefined,
        },
      );
    }

    if (!isUuid(task.id)) {
      return makeItem(
        "task",
        task.id,
        task.title,
        "blocked",
        "The task ID is not a valid UUID. A new ID mapping is required.",
        extra,
      );
    }

    if (
      task.projectId &&
      projectIndex.get(task.projectId)?.status === "review"
    ) {
      return makeItem(
        "task",
        task.id,
        task.title,
        "review",
        "The task's project mapping requires confirmation.",
        extra,
      );
    }

    return makeItem(
      "task",
      task.id,
      task.title,
      "ready",
      "No matching cloud task was found.",
      extra,
    );
  });
}

function planInbox(
  local: InboxItem[],
  cloud: InboxItem[],
): MigrationPlanItem[] {
  const textCounts = new Map<string, number>();

  for (const item of local) {
    const key = normalize(item.text);

    textCounts.set(key, (textCounts.get(key) ?? 0) + 1);
  }

  return local.map((item) => {
    if (cloud.some((existing) => existing.id === item.id)) {
      return makeItem(
        "inbox",
        item.id,
        item.text,
        "existing",
        "An Inbox item with this ID already exists.",
      );
    }

    const sameText = cloud.some(
      (existing) => normalize(existing.text) === normalize(item.text),
    );

    if (sameText || (textCounts.get(normalize(item.text)) ?? 0) > 1) {
      return makeItem(
        "inbox",
        item.id,
        item.text,
        "review",
        "Repeated text was found locally or in cloud. Decide which copies should be kept.",
      );
    }

    if (!isUuid(item.id)) {
      return makeItem(
        "inbox",
        item.id,
        item.text,
        "blocked",
        "The Inbox ID is not a valid UUID.",
      );
    }

    return makeItem(
      "inbox",
      item.id,
      item.text,
      "ready",
      "No matching Inbox item was found.",
    );
  });
}

function planFocusHistory(
  local: FocusHistoryEntry[],
  cloud: FocusHistoryEntry[],
  taskPlan: MigrationPlanItem[],
): MigrationPlanItem[] {
  const taskIndex = new Map(taskPlan.map((item) => [item.sourceId, item]));

  return local.map((entry) => {
    const sameId = cloud.find((item) => item.id === entry.id);

    if (sameId) {
      return makeItem(
        "focus",
        entry.id,
        entry.taskTitle,
        "existing",
        "A focus session with this ID already exists.",
      );
    }

    const sameSession = cloud.some(
      (item) =>
        item.taskTitle === entry.taskTitle &&
        item.durationMinutes === entry.durationMinutes &&
        item.completedAt === entry.completedAt,
    );

    if (sameSession) {
      return makeItem(
        "focus",
        entry.id,
        entry.taskTitle,
        "review",
        "A session with matching details exists in cloud.",
      );
    }

    const relatedTask = taskIndex.get(entry.taskId);

    if (!isUuid(entry.id)) {
      return makeItem(
        "focus",
        entry.id,
        entry.taskTitle,
        "blocked",
        "The session ID is not a valid UUID. A new session ID must be assigned.",
      );
    }

    if (
      relatedTask &&
      relatedTask.status !== "ready" &&
      relatedTask.status !== "existing"
    ) {
      return makeItem(
        "focus",
        entry.id,
        entry.taskTitle,
        "review",
        "The original task requires a mapping decision before importing this session.",
      );
    }

    return makeItem(
      "focus",
      entry.id,
      entry.taskTitle,
      "review",
      "The session looks new, but its task and project relationships need verification.",
    );
  });
}

/**
 * Read-only migration planning.
 *
 * This does not insert, update or delete
 * records in either localStorage or Supabase.
 */
export function buildMigrationPlan(
  local: LocalMigrationPreview,
  cloud: MigrationCloudData,
): MigrationPlan {
  const projects = planProjects(local.projects.items, cloud.projects);

  const tasks = planTasks(local.tasks.items, cloud.tasks, projects);

  const inbox = planInbox(local.inbox.items, cloud.inbox);

  const focusHistory = planFocusHistory(
    local.focusHistory.items,
    cloud.focusHistory,
    tasks,
  );

  const all = [...projects, ...tasks, ...inbox, ...focusHistory];

  return {
    projects,
    tasks,
    inbox,
    focusHistory,
    total: all.length,
    ready: all.filter((item) => item.status === "ready").length,
    needsReview: all.filter((item) => item.status === "review").length,
    existing: all.filter((item) => item.status === "existing").length,
    conflicts: all.filter((item) => item.status === "conflict").length,
    blocked: all.filter((item) => item.status === "blocked").length,
  };
}
