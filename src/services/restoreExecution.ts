import { supabase } from "../lib/supabase";

import { createCloudBackup } from "./cloudBackup";

import type { FlowMindBackup } from "./cloudBackup";

import { validateBackupJson } from "./backupValidation";

import { buildRestorePlan, expandRestoreSelection } from "./restorePlan";

import type { RestorePlanItem } from "./restorePlan";

export interface RestoreExecutionRequest {
  archive: FlowMindBackup;
  cloudAtReview: FlowMindBackup;
  selectedKeys: string[];
}

export interface RestoreExecutionResult {
  projects: number;
  tasks: number;
  inbox: number;
  focusHistory: number;
  dayPriorities: number;
  total: number;
}

type BackupRow = Record<string, unknown>;

type RestoreCategory = keyof FlowMindBackup["records"];

const RESTORE_ORDER: RestoreCategory[] = [
  "projects",
  "tasks",
  "inbox",
  "focusHistory",
  "dayPriorities",
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("bg-BG");
}

function snapshot(backup: FlowMindBackup): string {
  return JSON.stringify(backup.records);
}

function makeKey(category: RestoreCategory, row: BackupRow): string {
  const id =
    category === "dayPriorities"
      ? String(row.day_key)
      : String(row.id).toLowerCase();

  return `${category}:${id}`;
}

function sameContent(
  category: RestoreCategory,
  first: BackupRow,
  second: BackupRow,
): boolean {
  switch (category) {
    case "projects":
      return normalize(first.name) === normalize(second.name);

    case "tasks":
      return normalize(first.title) === normalize(second.title);

    case "inbox":
      return normalize(first.text) === normalize(second.text);

    case "focusHistory":
      return (
        normalize(first.task_title) === normalize(second.task_title) &&
        first.duration_minutes === second.duration_minutes &&
        Date.parse(String(first.completed_at)) ===
          Date.parse(String(second.completed_at))
      );

    case "dayPriorities":
      return first.day_key === second.day_key;
  }
}

async function verifyUser(expectedUserId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user || data.user.id !== expectedUserId) {
    throw new Error("Your account changed. Sign in again.");
  }
}

function newResult(): RestoreExecutionResult {
  return {
    projects: 0,
    tasks: 0,
    inbox: 0,
    focusHistory: 0,
    dayPriorities: 0,
    total: 0,
  };
}

/**
 * Validates selection and dependencies again
 * using a freshly loaded cloud snapshot.
 *
 * No database writes happen here.
 */
function validateSelection(
  archive: FlowMindBackup,
  cloud: FlowMindBackup,
  selectedKeys: string[],
): void {
  if (
    selectedKeys.length === 0 ||
    new Set(selectedKeys).size !== selectedKeys.length
  ) {
    throw new Error("Select at least one unique record.");
  }

  const plan = buildRestorePlan(archive, cloud);

  const index = new Map<string, RestorePlanItem>(
    plan.items.map((item) => [item.key, item]),
  );

  const selected = new Set(selectedKeys);

  for (const key of selectedKeys) {
    const item = index.get(key);

    if (!item) {
      throw new Error(`Unknown archive record: ${key}`);
    }

    if (item.status !== "available") {
      throw new Error(`"${item.title}" is no longer available for restore.`);
    }
  }

  const expanded = expandRestoreSelection(plan, selectedKeys);

  if (
    expanded.length !== selectedKeys.length ||
    expanded.some((key) => !selected.has(key))
  ) {
    throw new Error(
      "Required dependencies were not selected. " +
        "Refresh and review the selection.",
    );
  }

  const cloudKeys = new Set<string>();

  for (const category of RESTORE_ORDER) {
    for (const row of cloud.records[category]) {
      cloudKeys.add(makeKey(category, row));
    }
  }

  for (const key of selectedKeys) {
    const item = index.get(key);

    if (!item) {
      throw new Error("Invalid restore selection.");
    }

    for (const dependency of item.dependencies) {
      const archivedDependency = index.get(dependency);

      // Never silently connect archived records
      // to a conflicting cloud object.
      if (
        archivedDependency &&
        (archivedDependency.status === "conflict" ||
          archivedDependency.status === "possible-duplicate" ||
          archivedDependency.status === "missing-dependency")
      ) {
        throw new Error(`"${item.title}" has an unresolved dependency.`);
      }

      if (!cloudKeys.has(dependency) && !selected.has(dependency)) {
        throw new Error(`"${item.title}" requires a missing project or task.`);
      }
    }
  }

  // Prevent multiple selected records with
  // different IDs but effectively identical content.
  for (const category of RESTORE_ORDER) {
    const rows = archive.records[category].filter((row) =>
      selected.has(makeKey(category, row)),
    );

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (sameContent(category, rows[i], rows[j])) {
          throw new Error(
            "Two selected archive records in " +
              `${category} appear to be duplicates.`,
          );
        }
      }
    }
  }
}

async function insertRecord(
  userId: string,
  category: RestoreCategory,
  row: BackupRow,
): Promise<void> {
  let errorMessage: string | null = null;

  switch (category) {
    case "projects": {
      const { error } = await supabase.from("fm_projects").insert({
        id: row.id,
        user_id: userId,
        name: row.name,
        description: row.description,
        color: row.color,
        aliases: row.aliases,
        created_at: row.created_at,
      });

      errorMessage = error?.message ?? null;
      break;
    }

    case "tasks": {
      const { error } = await supabase.from("fm_tasks").insert({
        id: row.id,
        user_id: userId,
        title: row.title,
        priority: row.priority,
        status: row.status,
        created_at: row.created_at,
        due_date: row.due_date,
        project_id: row.project_id,
      });

      errorMessage = error?.message ?? null;
      break;
    }

    case "inbox": {
      const { error } = await supabase.from("fm_inbox").insert({
        id: row.id,
        user_id: userId,
        text: row.text,
        created_at: row.created_at,
      });

      errorMessage = error?.message ?? null;
      break;
    }

    case "focusHistory": {
      const { error } = await supabase.from("fm_focus_history").insert({
        id: row.id,
        user_id: userId,
        task_id: row.task_id,
        task_title: row.task_title,
        duration_minutes: row.duration_minutes,
        completed_at: row.completed_at,
        project_id: row.project_id,
        project_name: row.project_name,
      });

      errorMessage = error?.message ?? null;
      break;
    }

    case "dayPriorities": {
      const { error } = await supabase.from("fm_day_priorities").insert({
        user_id: userId,
        day_key: row.day_key,
        task_ids: row.task_ids,
        updated_at: row.updated_at,
      });

      errorMessage = error?.message ?? null;
      break;
    }
  }

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

/**
 * Confirmed restore:
 *
 * 1. Verify the authenticated account.
 * 2. Validate the archive again.
 * 3. Read a fresh cloud snapshot.
 * 4. Reject any changed cloud snapshot.
 * 5. Revalidate every selected record.
 * 6. Insert projects before dependent records.
 * 7. Read back the result.
 *
 * No updates, upserts or deletes.
 *
 * IMPORTANT: Multiple inserts are not atomic.
 * Partial completion is possible if a later
 * request fails. Never retry without a fresh
 * comparison.
 */
export async function executeSafeRestore(
  request: RestoreExecutionRequest,
): Promise<RestoreExecutionResult> {
  const { archive, cloudAtReview, selectedKeys } = request;

  const userId = archive.ownerUserId;

  await verifyUser(userId);

  if (cloudAtReview.ownerUserId !== userId) {
    throw new Error("The archive and cloud account do not match.");
  }

  const validation = validateBackupJson(JSON.stringify(archive), userId);

  if (!validation.valid || !validation.backup) {
    throw new Error(
      "The archive failed final validation: " + validation.errors.join("; "),
    );
  }

  const freshCloud = await createCloudBackup(userId);

  if (snapshot(freshCloud) !== snapshot(cloudAtReview)) {
    throw new Error(
      "Cloud data changed since the preview. " +
        "Clear the preview and load the backup again.",
    );
  }

  validateSelection(validation.backup, freshCloud, selectedKeys);

  const selected = new Set(selectedKeys);
  const result = newResult();

  for (const category of RESTORE_ORDER) {
    const rows = validation.backup.records[category].filter((row) =>
      selected.has(makeKey(category, row)),
    );

    for (const row of rows) {
      try {
        await verifyUser(userId);
        await insertRecord(userId, category, row);
      } catch (cause) {
        const detail =
          cause instanceof Error ? cause.message : "Unknown database error.";

        throw new Error(
          `Restore stopped while processing ${category}. ` +
            `${result.total} insert requests were confirmed ` +
            "before the error. The last request may " +
            "also have reached the server. " +
            `Details: ${detail}. ` +
            "Do not retry without refreshing the preview.",
        );
      }

      result[category] += 1;
      result.total += 1;
    }
  }

  // Verify the selected IDs are now present.
  // An error here must not trigger another import.
  try {
    const after = await createCloudBackup(userId);

    const keys = new Set<string>();

    for (const category of RESTORE_ORDER) {
      for (const row of after.records[category]) {
        keys.add(makeKey(category, row));
      }
    }

    for (const key of selectedKeys) {
      if (!keys.has(key)) {
        throw new Error(`Restored record not visible: ${key}`);
      }
    }
  } catch (cause) {
    const detail =
      cause instanceof Error ? cause.message : "Read-back verification failed.";

    throw new Error(
      "The restore requests completed, but " +
        "verification was unsuccessful. " +
        `${detail}. Refresh the preview before ` +
        "taking any further action.",
    );
  }

  return result;
}
