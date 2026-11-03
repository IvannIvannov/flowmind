import { supabase } from "../lib/supabase";

import type { FocusHistoryEntry } from "../utils/focusHistory";
import type { Project, Task } from "../types";

import { previewLocalMigration } from "./localMigrationPreview";
import { loadCloudFocusHistory } from "./cloudFocusHistory";
import { loadWorkspace } from "./workspace";

export interface FocusImportRequest {
  userId: string;
  localAtReview: FocusHistoryEntry[];
  cloudAtReview: FocusHistoryEntry[];
  selectedEntryId: string;
  targetTaskId: string;
  cloudTasksAtReview: Task[];
  cloudProjectsAtReview: Project[];
}

export interface FocusImportResult {
  created: number;
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validEntry(entry: FocusHistoryEntry): boolean {
  return (
    !!entry.id.trim() &&
    !!entry.taskId.trim() &&
    !!entry.taskTitle.trim() &&
    Number.isFinite(entry.durationMinutes) &&
    entry.durationMinutes > 0 &&
    validDate(entry.completedAt)
  );
}

function sameSession(
  left: FocusHistoryEntry,
  right: FocusHistoryEntry,
): boolean {
  return (
    normalized(left.taskTitle) === normalized(right.taskTitle) &&
    left.durationMinutes === right.durationMinutes &&
    Date.parse(left.completedAt) === Date.parse(right.completedAt)
  );
}

function sessionSnapshot(items: FocusHistoryEntry[]): string {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        durationMinutes: item.durationMinutes,
        completedAt: item.completedAt,
        projectId: item.projectId ?? "",
        projectName: item.projectName ?? "",
      })),
  );
}

function workspaceSnapshot(tasks: Task[], projects: Project[]): string {
  return JSON.stringify({
    tasks: [...tasks]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId ?? "",
      })),
    projects: [...projects]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
      })),
  });
}

async function verifyAccount(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  if (!data.user || data.user.id !== userId) {
    throw new Error("Your account has changed. Sign in again.");
  }
}

/**
 * Imports one confirmed legacy Focus session.
 *
 * Never updates or deletes existing sessions.
 * Always creates a new session ID.
 * Existing cloud tasks are used as destinations.
 */
export async function executeFocusMigration(
  request: FocusImportRequest,
): Promise<FocusImportResult> {
  const {
    userId,
    localAtReview,
    cloudAtReview,
    selectedEntryId,
    targetTaskId,
    cloudTasksAtReview,
    cloudProjectsAtReview,
  } = request;

  await verifyAccount(userId);

  const currentLocal = previewLocalMigration();

  if (
    currentLocal.hasReadErrors ||
    currentLocal.focusHistory.invalid > 0 ||
    currentLocal.focusHistory.duplicateIds > 0
  ) {
    throw new Error("Some local Focus records are invalid or unreadable.");
  }

  if (
    sessionSnapshot(currentLocal.focusHistory.items) !==
    sessionSnapshot(localAtReview)
  ) {
    throw new Error("Local Focus History changed. Refresh the comparison.");
  }

  const matches = localAtReview.filter((entry) => entry.id === selectedEntryId);

  if (matches.length !== 1) {
    throw new Error("Selected Focus session was not found uniquely.");
  }

  const entry = matches[0];

  if (!validEntry(entry)) {
    throw new Error("Invalid Focus session.");
  }

  const [cloudNow, workspaceNow] = await Promise.all([
    loadCloudFocusHistory(userId),
    loadWorkspace(userId),
  ]);

  if (sessionSnapshot(cloudNow) !== sessionSnapshot(cloudAtReview)) {
    throw new Error("Cloud Focus History changed. Refresh the comparison.");
  }

  if (
    workspaceSnapshot(workspaceNow.tasks, workspaceNow.projects) !==
    workspaceSnapshot(cloudTasksAtReview, cloudProjectsAtReview)
  ) {
    throw new Error(
      "Cloud tasks or projects changed. Refresh before importing.",
    );
  }

  if (
    cloudNow.some(
      (existing) => existing.id === entry.id || sameSession(existing, entry),
    )
  ) {
    throw new Error("This session may already exist in cloud.");
  }

  // Prevent importing repeated local sessions
  // that appear identical in the legacy data.
  if (
    localAtReview.filter((candidate) => sameSession(candidate, entry)).length >
    1
  ) {
    throw new Error(
      "Multiple identical local sessions were found. Review them manually.",
    );
  }

  const targetTask = workspaceNow.tasks.find(
    (task) => task.id === targetTaskId,
  );

  if (!targetTask) {
    throw new Error("The selected destination task no longer exists.");
  }

  const targetProject = targetTask.projectId
    ? workspaceNow.projects.find(
        (project) => project.id === targetTask.projectId,
      )
    : undefined;

  if (targetTask.projectId && !targetProject) {
    throw new Error("The destination task has an unresolved project.");
  }

  // Fresh UUID prevents overwriting another Focus
  // session, including one with a legacy ID.
  const newSessionId = crypto.randomUUID();

  const { error } = await supabase.from("fm_focus_history").insert({
    id: newSessionId,
    user_id: userId,
    task_id: targetTask.id,
    task_title: entry.taskTitle,
    duration_minutes: entry.durationMinutes,
    completed_at: new Date(entry.completedAt).toISOString(),
    project_id: targetProject?.id ?? null,
    project_name: targetProject?.name ?? null,
  });

  if (error) {
    throw new Error(
      `Import failed: ${error.message}. ` +
        "The request may have reached the server. " +
        "Refresh the cloud history before trying again.",
    );
  }

  return { created: 1 };
}
