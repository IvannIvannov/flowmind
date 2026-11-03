import type { FlowMindBackup } from "./cloudBackup";

import { BACKUP_FORMAT, BACKUP_VERSION } from "./cloudBackup";

export type BackupCategory =
  | "projects"
  | "tasks"
  | "inbox"
  | "focusHistory"
  | "dayPriorities";

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  backup: FlowMindBackup | null;
}

export interface RestoreCategoryComparison {
  category: BackupCategory;
  label: string;
  archived: number;
  cloud: number;
  existing: number;
  possibleDuplicates: number;
  unmatched: number;
}

export interface RestorePreview {
  categories: RestoreCategoryComparison[];
  totalArchived: number;
  totalExisting: number;
  totalPossibleDuplicates: number;
  totalUnmatched: number;
}

export type BackupRecords = FlowMindBackup["records"];

const CATEGORIES: {
  key: BackupCategory;
  label: string;
}[] = [
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "inbox", label: "Inbox" },
  { key: "focusHistory", label: "Focus History" },
  { key: "dayPriorities", label: "Daily Priorities" },
];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): value is string {
  return typeof value === "string";
}

function nonempty(value: unknown): boolean {
  return stringValue(value) && value.trim().length > 0;
}

function optionalText(value: unknown): boolean {
  return value === null || stringValue(value);
}

function isoDateTime(value: unknown): boolean {
  return (
    stringValue(value) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function dateOnly(value: unknown): boolean {
  if (!stringValue(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isUuid(value: unknown): boolean {
  return stringValue(value) && UUID.test(value);
}

function textArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(stringValue);
}

function uuidArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isUuid);
}

function validRecord(category: BackupCategory, value: unknown): boolean {
  if (!isObject(value)) return false;

  if (category === "projects") {
    return (
      isUuid(value.id) &&
      nonempty(value.name) &&
      stringValue(value.description) &&
      nonempty(value.color) &&
      textArray(value.aliases) &&
      isoDateTime(value.created_at)
    );
  }

  if (category === "tasks") {
    return (
      isUuid(value.id) &&
      nonempty(value.title) &&
      ["low", "medium", "high"].includes(String(value.priority)) &&
      ["todo", "in-progress", "completed"].includes(String(value.status)) &&
      isoDateTime(value.created_at) &&
      (value.due_date === null || dateOnly(value.due_date)) &&
      (value.project_id === null || isUuid(value.project_id))
    );
  }

  if (category === "inbox") {
    return (
      isUuid(value.id) && nonempty(value.text) && isoDateTime(value.created_at)
    );
  }

  if (category === "focusHistory") {
    return (
      isUuid(value.id) &&
      isUuid(value.task_id) &&
      nonempty(value.task_title) &&
      typeof value.duration_minutes === "number" &&
      Number.isFinite(value.duration_minutes) &&
      value.duration_minutes > 0 &&
      isoDateTime(value.completed_at) &&
      (value.project_id === null || isUuid(value.project_id)) &&
      optionalText(value.project_name)
    );
  }

  return (
    dateOnly(value.day_key) &&
    uuidArray(value.task_ids) &&
    (value.task_ids as unknown[]).length <= 3 &&
    new Set(value.task_ids as string[]).size ===
      (value.task_ids as string[]).length &&
    isoDateTime(value.updated_at)
  );
}

function recordKey(
  category: BackupCategory,
  row: Record<string, unknown>,
): string {
  const value = category === "dayPriorities" ? row.day_key : row.id;

  return String(value).toLowerCase();
}

function normalize(value: unknown): string {
  return stringValue(value)
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG")
    : "";
}

/**
 * Parses an untrusted JSON file.
 *
 * It never sends its contents to Supabase
 * and never modifies cloud or local records.
 */
export function validateBackupJson(
  json: string,
  currentUserId: string,
): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      valid: false,
      errors: ["The selected file is not valid JSON."],
      warnings: [],
      backup: null,
    };
  }

  if (!isObject(parsed)) {
    errors.push("The root of the backup must be an object.");
  }

  if (!isObject(parsed)) {
    return {
      valid: false,
      errors,
      warnings,
      backup: null,
    };
  }

  if (parsed.format !== BACKUP_FORMAT) {
    errors.push("This is not a recognized FlowMind backup.");
  }

  if (parsed.version !== BACKUP_VERSION) {
    errors.push(`Unsupported backup version. Expected ${BACKUP_VERSION}.`);
  }

  if (!isoDateTime(parsed.exportedAt)) {
    errors.push("Invalid backup export date.");
  }

  if (!isUuid(parsed.ownerUserId)) {
    errors.push("Invalid backup owner ID.");
  } else if (parsed.ownerUserId !== currentUserId) {
    errors.push(
      "This backup belongs to a different account. Restore is not permitted.",
    );
  }

  if (!isObject(parsed.records)) {
    errors.push("Missing backup records object.");

    return {
      valid: false,
      errors,
      warnings,
      backup: null,
    };
  }

  const records = parsed.records;

  const validated: Record<BackupCategory, Record<string, unknown>[]> = {
    projects: [],
    tasks: [],
    inbox: [],
    focusHistory: [],
    dayPriorities: [],
  };

  for (const category of CATEGORIES) {
    const value = records[category.key];

    if (!Array.isArray(value)) {
      errors.push(`Missing or invalid category: ${category.label}.`);
      continue;
    }

    const keys = new Set<string>();

    for (let index = 0; index < value.length; index++) {
      const row: unknown = value[index];

      if (!validRecord(category.key, row)) {
        errors.push(
          `${category.label}: invalid record at position ${index + 1}.`,
        );
        continue;
      }

      // validRecord guarantees the object shape.
      const typedRow = row as Record<string, unknown>;

      const key = recordKey(category.key, typedRow);

      if (keys.has(key)) {
        errors.push(`${category.label}: duplicate record key ${key}.`);
        continue;
      }

      keys.add(key);
      validated[category.key].push(typedRow);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      backup: null,
    };
  }

  const projectIds = new Set(
    validated.projects.map((row) => String(row.id).toLowerCase()),
  );

  const taskIds = new Set(
    validated.tasks.map((row) => String(row.id).toLowerCase()),
  );

  for (const task of validated.tasks) {
    if (
      task.project_id &&
      !projectIds.has(String(task.project_id).toLowerCase())
    ) {
      warnings.push(
        `Task "${String(task.title)}" references a project not included in the backup.`,
      );
    }
  }

  for (const focus of validated.focusHistory) {
    if (!taskIds.has(String(focus.task_id).toLowerCase())) {
      warnings.push(
        `Focus session "${String(focus.task_title)}" references a task not included in the backup.`,
      );
    }
  }

  for (const day of validated.dayPriorities) {
    const ids = day.task_ids as string[];

    for (const taskId of ids) {
      if (!taskIds.has(taskId.toLowerCase())) {
        warnings.push(
          `Daily priorities for ${String(day.day_key)} reference a task not included in the backup.`,
        );
      }
    }
  }

  const backup: FlowMindBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: parsed.exportedAt as string,
    ownerUserId: parsed.ownerUserId as string,
    records: validated,
  };

  return {
    valid: true,
    errors: [],
    warnings,
    backup,
  };
}

function hasSameContent(
  category: BackupCategory,
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): boolean {
  if (category === "projects") {
    return normalize(first.name) === normalize(second.name);
  }

  if (category === "tasks") {
    return normalize(first.title) === normalize(second.title);
  }

  if (category === "inbox") {
    return normalize(first.text) === normalize(second.text);
  }

  if (category === "focusHistory") {
    return (
      normalize(first.task_title) === normalize(second.task_title) &&
      first.duration_minutes === second.duration_minutes &&
      Date.parse(String(first.completed_at)) ===
        Date.parse(String(second.completed_at))
    );
  }

  // Daily priorities are identified only by date.
  return false;
}

/**
 * Compares a validated archive with a fresh
 * cloud backup. No database writes are made.
 */
export function compareBackupWithCloud(
  archive: FlowMindBackup,
  cloud: FlowMindBackup,
): RestorePreview {
  const categories: RestoreCategoryComparison[] = CATEGORIES.map((category) => {
    const archived = archive.records[category.key];

    const current = cloud.records[category.key];

    const currentKeys = new Set(
      current.map((row) => recordKey(category.key, row)),
    );

    let existing = 0;
    let possibleDuplicates = 0;
    let unmatched = 0;

    for (const row of archived) {
      const key = recordKey(category.key, row);

      if (currentKeys.has(key)) {
        existing += 1;
      } else if (
        current.some((cloudRow) => hasSameContent(category.key, row, cloudRow))
      ) {
        possibleDuplicates += 1;
      } else {
        unmatched += 1;
      }
    }

    return {
      category: category.key,
      label: category.label,
      archived: archived.length,
      cloud: current.length,
      existing,
      possibleDuplicates,
      unmatched,
    };
  });

  return {
    categories,
    totalArchived: categories.reduce((sum, item) => sum + item.archived, 0),
    totalExisting: categories.reduce((sum, item) => sum + item.existing, 0),
    totalPossibleDuplicates: categories.reduce(
      (sum, item) => sum + item.possibleDuplicates,
      0,
    ),
    totalUnmatched: categories.reduce((sum, item) => sum + item.unmatched, 0),
  };
}
