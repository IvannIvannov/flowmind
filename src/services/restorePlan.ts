import type { FlowMindBackup } from "./cloudBackup";
import type { BackupCategory } from "./backupValidation";

export type RestoreStatus =
  | "available"
  | "existing"
  | "conflict"
  | "possible-duplicate"
  | "missing-dependency";

export interface RestorePlanItem {
  key: string;
  category: BackupCategory;
  id: string;
  title: string;
  status: RestoreStatus;
  reason: string;
  dependencies: string[];
}

export interface RestorePlan {
  items: RestorePlanItem[];
  available: number;
  existing: number;
  conflicts: number;
  possibleDuplicates: number;
  missingDependencies: number;
}

type Row = Record<string, unknown>;

const CATEGORIES: BackupCategory[] = [
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

function keyOf(category: BackupCategory, row: Row): string {
  return category === "dayPriorities"
    ? String(row.day_key)
    : String(row.id).toLowerCase();
}

function itemKey(category: BackupCategory, id: string): string {
  return `${category}:${id}`;
}

function titleOf(category: BackupCategory, row: Row): string {
  if (category === "projects") {
    return String(row.name);
  }

  if (category === "tasks") {
    return String(row.title);
  }

  if (category === "inbox") {
    return String(row.text);
  }

  if (category === "focusHistory") {
    return String(row.task_title);
  }

  return String(row.day_key);
}

function sameRecord(a: Row, b: Row): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...keys].every((key) => {
    const left = a[key];
    const right = b[key];

    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    return left === right;
  });
}

function possibleDuplicate(category: BackupCategory, a: Row, b: Row): boolean {
  if (category === "projects") {
    return normalize(a.name) === normalize(b.name);
  }

  if (category === "tasks") {
    return normalize(a.title) === normalize(b.title);
  }

  if (category === "inbox") {
    return normalize(a.text) === normalize(b.text);
  }

  if (category === "focusHistory") {
    return (
      normalize(a.task_title) === normalize(b.task_title) &&
      a.duration_minutes === b.duration_minutes &&
      Date.parse(String(a.completed_at)) === Date.parse(String(b.completed_at))
    );
  }

  return false;
}

function references(category: BackupCategory, row: Row): string[] {
  if (category === "tasks") {
    return row.project_id
      ? [itemKey("projects", String(row.project_id).toLowerCase())]
      : [];
  }

  if (category === "focusHistory") {
    const dependencies = [itemKey("tasks", String(row.task_id).toLowerCase())];

    if (row.project_id) {
      dependencies.push(
        itemKey("projects", String(row.project_id).toLowerCase()),
      );
    }

    return dependencies;
  }

  if (category === "dayPriorities") {
    return (row.task_ids as string[]).map((id) =>
      itemKey("tasks", id.toLowerCase()),
    );
  }

  return [];
}

/**
 * Builds a read-only restore plan.
 *
 * This is deliberately conservative:
 * records with duplicate content, conflicting IDs,
 * or unresolved dependencies are not selectable.
 */
export function buildRestorePlan(
  archive: FlowMindBackup,
  cloud: FlowMindBackup,
): RestorePlan {
  const all: RestorePlanItem[] = [];

  for (const category of CATEGORIES) {
    const sourceRows = archive.records[category];
    const cloudRows = cloud.records[category];

    for (const row of sourceRows) {
      const id = keyOf(category, row);
      const key = itemKey(category, id);

      const sameId = cloudRows.find(
        (current) => keyOf(category, current) === id,
      );

      let status: RestoreStatus = "available";
      let reason = "No matching cloud record was found.";

      if (sameId) {
        if (sameRecord(row, sameId)) {
          status = "existing";
          reason = "This exact record already exists in cloud.";
        } else {
          status = "conflict";
          reason =
            "The same ID exists in cloud with different data. It must not be overwritten.";
        }
      } else if (
        cloudRows.some((current) => possibleDuplicate(category, row, current))
      ) {
        status = "possible-duplicate";
        reason = "A similar record exists in cloud under another ID.";
      }

      all.push({
        key,
        category,
        id,
        title: titleOf(category, row),
        status,
        reason,
        dependencies: references(category, row),
      });
    }
  }

  // Cloud records can satisfy dependencies
  // even when they were not included in the archive.
  const cloudKeys = new Set<string>();

  for (const category of CATEGORIES) {
    for (const row of cloud.records[category]) {
      cloudKeys.add(itemKey(category, keyOf(category, row)));
    }
  }

  const archiveIndex = new Map(all.map((item) => [item.key, item]));

  // A dependency can be satisfied by an existing
  // cloud record or a separately selectable
  // archive record. Detect unresolved chains.
  let changed = true;

  while (changed) {
    changed = false;

    for (const item of all) {
      if (item.status !== "available") continue;

      const missing = item.dependencies.some((dependency) => {
        if (cloudKeys.has(dependency)) {
          return false;
        }

        const archivedDependency = archiveIndex.get(dependency);

        return !archivedDependency || archivedDependency.status !== "available";
      });

      if (missing) {
        item.status = "missing-dependency";
        item.reason =
          "A required task or project is unavailable or needs manual review.";
        changed = true;
      }
    }
  }

  const count = (status: RestoreStatus): number =>
    all.filter((item) => item.status === status).length;

  return {
    items: all,
    available: count("available"),
    existing: count("existing"),
    conflicts: count("conflict"),
    possibleDuplicates: count("possible-duplicate"),
    missingDependencies: count("missing-dependency"),
  };
}

/**
 * Expands a selection to include required
 * archive projects and tasks.
 *
 * Existing cloud dependencies do not need
 * to be selected again.
 */
export function expandRestoreSelection(
  plan: RestorePlan,
  requestedKeys: string[],
): string[] {
  const index = new Map(plan.items.map((item) => [item.key, item]));

  const selected = new Set<string>();

  function include(key: string): void {
    const item = index.get(key);

    if (!item || item.status !== "available") {
      return;
    }

    if (selected.has(key)) return;

    selected.add(key);

    for (const dependency of item.dependencies) {
      include(dependency);
    }
  }

  for (const key of requestedKeys) {
    include(key);
  }

  return [...selected];
}

/**
 * Removes selected dependents when a required
 * archived record is unchecked.
 */
export function removeRestoreSelection(
  plan: RestorePlan,
  selectedKeys: string[],
  removedKey: string,
): string[] {
  const removed = new Set([removedKey]);

  let changed = true;

  while (changed) {
    changed = false;

    for (const item of plan.items) {
      if (removed.has(item.key) || !selectedKeys.includes(item.key)) {
        continue;
      }

      if (item.dependencies.some((dependency) => removed.has(dependency))) {
        removed.add(item.key);
        changed = true;
      }
    }
  }

  return selectedKeys.filter((key) => !removed.has(key));
}
