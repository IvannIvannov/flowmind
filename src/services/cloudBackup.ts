import { supabase } from "../lib/supabase";

const PAGE_SIZE = 500;

export const BACKUP_FORMAT = "flowmind-cloud-backup";
export const BACKUP_VERSION = 1;

type TableName =
  | "fm_projects"
  | "fm_tasks"
  | "fm_inbox"
  | "fm_focus_history"
  | "fm_day_priorities";

type BackupRow = Record<string, unknown>;

export interface FlowMindBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  ownerUserId: string;
  records: {
    projects: BackupRow[];
    tasks: BackupRow[];
    inbox: BackupRow[];
    focusHistory: BackupRow[];
    dayPriorities: BackupRow[];
  };
}

export interface BackupCounts {
  projects: number;
  tasks: number;
  inbox: number;
  focusHistory: number;
  dayPriorities: number;
  total: number;
}

async function verifyUser(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user || data.user.id !== userId) {
    throw new Error("Your account has changed. Sign in again.");
  }
}

/**
 * Load every page rather than relying on
 * the default Supabase row limit.
 *
 * Explicit columns prevent unexpected
 * future database columns from entering
 * an exported backup.
 */
async function readAllRows(
  table: TableName,
  columns: string,
  userId: string,
  orderColumn: string,
): Promise<BackupRow[]> {
  const all: BackupRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read ${table}: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as BackupRow[];

    all.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    offset += rows.length;
  }

  return all;
}

export function getBackupCounts(backup: FlowMindBackup): BackupCounts {
  const projects = backup.records.projects.length;
  const tasks = backup.records.tasks.length;
  const inbox = backup.records.inbox.length;

  const focusHistory = backup.records.focusHistory.length;

  const dayPriorities = backup.records.dayPriorities.length;

  return {
    projects,
    tasks,
    inbox,
    focusHistory,
    dayPriorities,
    total: projects + tasks + inbox + focusHistory + dayPriorities,
  };
}

/**
 * Builds a read-only snapshot of the
 * currently authenticated user's data.
 *
 * No inserts, updates or deletes.
 */
export async function createCloudBackup(
  userId: string,
): Promise<FlowMindBackup> {
  await verifyUser(userId);

  const [projects, tasks, inbox, focusHistory, dayPriorities] =
    await Promise.all([
      readAllRows(
        "fm_projects",
        "id,name,description,color,aliases,created_at",
        userId,
        "id",
      ),

      readAllRows(
        "fm_tasks",
        "id,title,priority,status,created_at,due_date,project_id",
        userId,
        "id",
      ),

      readAllRows("fm_inbox", "id,text,created_at", userId, "id"),

      readAllRows(
        "fm_focus_history",
        "id,task_id,task_title,duration_minutes,completed_at,project_id,project_name",
        userId,
        "id",
      ),

      readAllRows(
        "fm_day_priorities",
        "day_key,task_ids,updated_at",
        userId,
        "day_key",
      ),
    ]);

  // Verify that the same account remains active.
  await verifyUser(userId);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ownerUserId: userId,
    records: {
      projects,
      tasks,
      inbox,
      focusHistory,
      dayPriorities,
    },
  };
}

export function backupToJson(backup: FlowMindBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(backup: FlowMindBackup): string {
  const date = backup.exportedAt.slice(0, 10);

  return `flowmind-backup-${date}.json`;
}

/**
 * Uses the WebView's standard download
 * mechanism. Some Tauri configurations
 * may require an explicit save-dialog
 * implementation later.
 */
export function downloadCloudBackup(backup: FlowMindBackup): void {
  const json = backupToJson(backup);

  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = backupFilename(backup);
    anchor.style.display = "none";

    document.body.appendChild(anchor);

    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  } finally {
    // Release the object URL after the browser
    // has had an opportunity to process the click.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);
  }
}
