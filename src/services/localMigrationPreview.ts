import type { Project, Task } from "../types";
import type { InboxItem } from "../utils/inboxStorage";
import type { FocusHistoryEntry } from "../utils/focusHistory";
import { STORAGE_KEYS, isTask, isProject } from "../utils/storage";

export interface MigrationCategory<T> {
  items: T[];
  total: number;
  valid: number;
  invalid: number;
  duplicateIds: number;
  readError: string | null;
}

export interface LocalMigrationPreview {
  tasks: MigrationCategory<Task>;
  projects: MigrationCategory<Project>;
  inbox: MigrationCategory<InboxItem>;
  focusHistory: MigrationCategory<FocusHistoryEntry>;
  canImport: boolean;
  hasReadErrors: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInboxItem(value: unknown): value is InboxItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string"
  );
}

function isFocusEntry(value: unknown): value is FocusHistoryEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.taskId === "string" &&
    typeof value.taskTitle === "string" &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes > 0 &&
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt)) &&
    (value.projectId === undefined || typeof value.projectId === "string") &&
    (value.projectName === undefined || typeof value.projectName === "string")
  );
}

function readCategory<T extends { id: string }>(
  key: string,
  validator: (value: unknown) => value is T,
): MigrationCategory<T> {
  const empty: MigrationCategory<T> = {
    items: [],
    total: 0,
    valid: 0,
    invalid: 0,
    duplicateIds: 0,
    readError: null,
  };

  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return empty;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        ...empty,
        readError: `${key} does not contain an array.`,
      };
    }

    const items: T[] = [];
    const seen = new Set<string>();

    let invalid = 0;
    let duplicateIds = 0;

    for (const value of parsed) {
      if (!validator(value) || !value.id.trim()) {
        invalid += 1;
        continue;
      }

      if (seen.has(value.id)) {
        duplicateIds += 1;
        continue;
      }

      seen.add(value.id);
      items.push(value);
    }

    return {
      items,
      total: parsed.length,
      valid: items.length,
      invalid,
      duplicateIds,
      readError: null,
    };
  } catch (error) {
    return {
      ...empty,
      readError: error instanceof Error ? error.message : `Cannot read ${key}.`,
    };
  }
}

/**
 * Read-only inspection of legacy FlowMind data.
 *
 * This function NEVER writes to Supabase,
 * never changes localStorage and never
 * removes existing records.
 */
export function previewLocalMigration(): LocalMigrationPreview {
  const tasks = readCategory(STORAGE_KEYS.tasks, isTask);

  const projects = readCategory(STORAGE_KEYS.projects, isProject);

  const inbox = readCategory("flowmind-inbox-v1", isInboxItem);

  const focusHistory = readCategory("flowmind-focus-history-v1", isFocusEntry);

  const categories = [tasks, projects, inbox, focusHistory];

  const hasReadErrors = categories.some(
    (category) => category.readError !== null,
  );

  const canImport =
    !hasReadErrors && categories.some((category) => category.valid > 0);

  return {
    tasks,
    projects,
    inbox,
    focusHistory,
    canImport,
    hasReadErrors,
  };
}
