import type { Project, Task } from "../types";

import type { FocusHistoryEntry } from "../utils/focusHistory";

export type FocusMigrationStatus =
  | "already-imported"
  | "possible-duplicate"
  | "ready"
  | "needs-review"
  | "blocked";

export interface FocusMigrationAuditItem {
  id: string;
  title: string;
  durationMinutes: number;
  completedAt: string;
  status: FocusMigrationStatus;
  reason: string;

  originalTaskId: string;
  originalProjectId?: string;

  suggestedTaskId?: string;
  suggestedProjectId?: string;
}

export interface FocusMigrationAudit {
  items: FocusMigrationAuditItem[];
  total: number;
  ready: number;
  alreadyImported: number;
  possibleDuplicates: number;
  needsReview: number;
  blocked: number;
}

export interface FocusMigrationAuditInput {
  localEntries: FocusHistoryEntry[];
  cloudEntries: FocusHistoryEntry[];

  localTasks: Task[];
  cloudTasks: Task[];

  localProjects: Project[];
  cloudProjects: Project[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function sameSession(
  first: FocusHistoryEntry,
  second: FocusHistoryEntry,
): boolean {
  return (
    normalize(first.taskTitle) === normalize(second.taskTitle) &&
    first.durationMinutes === second.durationMinutes &&
    Date.parse(first.completedAt) === Date.parse(second.completedAt)
  );
}

function findTaskCandidates(
  entry: FocusHistoryEntry,
  cloudTasks: Task[],
): Task[] {
  return cloudTasks.filter(
    (task) => normalize(task.title) === normalize(entry.taskTitle),
  );
}

function findProjectCandidates(
  localProject: Project,
  cloudProjects: Project[],
): Project[] {
  const localNames = [localProject.name, ...(localProject.aliases ?? [])].map(
    normalize,
  );

  return cloudProjects.filter((project) => {
    const cloudNames = [project.name, ...(project.aliases ?? [])].map(
      normalize,
    );

    return localNames.some((name) => cloudNames.includes(name));
  });
}

function auditEntry(
  entry: FocusHistoryEntry,
  input: FocusMigrationAuditInput,
): FocusMigrationAuditItem {
  const base: FocusMigrationAuditItem = {
    id: entry.id,
    title: entry.taskTitle,
    durationMinutes: entry.durationMinutes,
    completedAt: entry.completedAt,
    status: "needs-review",
    reason: "",
    originalTaskId: entry.taskId,
    originalProjectId: entry.projectId,
  };

  if (
    !entry.id.trim() ||
    !entry.taskId.trim() ||
    !entry.taskTitle.trim() ||
    !Number.isFinite(entry.durationMinutes) ||
    entry.durationMinutes <= 0 ||
    !Number.isFinite(Date.parse(entry.completedAt))
  ) {
    return {
      ...base,
      status: "blocked",
      reason: "The session contains invalid or missing data.",
    };
  }

  const existingId = input.cloudEntries.find((cloud) => cloud.id === entry.id);

  if (existingId) {
    return {
      ...base,
      status: "already-imported",
      reason:
        "A cloud session with the same ID already exists. It must not be inserted again.",
    };
  }

  const duplicate = input.cloudEntries.find((cloud) =>
    sameSession(entry, cloud),
  );

  if (duplicate) {
    return {
      ...base,
      status: "possible-duplicate",
      reason:
        "A cloud session with matching title, duration and completion time already exists.",
    };
  }

  if (!isUuid(entry.id)) {
    return {
      ...base,
      status: "needs-review",
      reason:
        "The original session ID is not a UUID. A new ID will be needed if the session is imported.",
    };
  }

  const exactCloudTask = input.cloudTasks.find(
    (task) => task.id === entry.taskId,
  );

  let suggestedTaskId: string | undefined;

  if (exactCloudTask) {
    suggestedTaskId = exactCloudTask.id;
  } else {
    const localTask = input.localTasks.find((task) => task.id === entry.taskId);

    if (localTask) {
      const candidates = input.cloudTasks.filter(
        (task) => normalize(task.title) === normalize(localTask.title),
      );

      if (candidates.length === 1) {
        suggestedTaskId = candidates[0].id;
      }
    }

    if (!suggestedTaskId) {
      const candidates = findTaskCandidates(entry, input.cloudTasks);

      if (candidates.length === 1) {
        suggestedTaskId = candidates[0].id;
      }
    }
  }

  if (!suggestedTaskId) {
    return {
      ...base,
      status: "needs-review",
      reason:
        "The original task could not be linked unambiguously to a cloud task. A manual task mapping is required.",
    };
  }

  let suggestedProjectId: string | undefined;

  if (entry.projectId) {
    const exactCloudProject = input.cloudProjects.find(
      (project) => project.id === entry.projectId,
    );

    if (exactCloudProject) {
      suggestedProjectId = exactCloudProject.id;
    } else {
      const localProject = input.localProjects.find(
        (project) => project.id === entry.projectId,
      );

      if (localProject) {
        const candidates = findProjectCandidates(
          localProject,
          input.cloudProjects,
        );

        if (candidates.length === 1) {
          suggestedProjectId = candidates[0].id;
        }
      }
    }

    if (!suggestedProjectId) {
      return {
        ...base,
        status: "needs-review",
        reason:
          "The session's project could not be mapped unambiguously to a cloud project.",
        suggestedTaskId,
      };
    }
  }

  return {
    ...base,
    status: "ready",
    reason:
      "The session has no detected duplicate and its task and project relationships have candidate mappings. Confirm them before import.",
    suggestedTaskId,
    suggestedProjectId,
  };
}

/**
 * Pure read-only audit.
 *
 * Does not access Supabase or localStorage.
 * Does not insert, update or delete data.
 */
export function buildFocusMigrationAudit(
  input: FocusMigrationAuditInput,
): FocusMigrationAudit {
  const items = input.localEntries.map((entry) => auditEntry(entry, input));

  const count = (status: FocusMigrationStatus): number =>
    items.filter((item) => item.status === status).length;

  return {
    items,
    total: items.length,
    ready: count("ready"),
    alreadyImported: count("already-imported"),
    possibleDuplicates: count("possible-duplicate"),
    needsReview: count("needs-review"),
    blocked: count("blocked"),
  };
}
