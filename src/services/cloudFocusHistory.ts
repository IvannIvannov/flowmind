import { supabase } from "../lib/supabase";
import type { FocusHistoryEntry } from "../utils/focusHistory";

interface FocusRow {
  id: string;
  task_id: string;
  task_title: string;
  duration_minutes: number;
  completed_at: string;
  project_id: string | null;
  project_name: string | null;
}

function mapFocus(row: FocusRow): FocusHistoryEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    durationMinutes: row.duration_minutes,
    completedAt: row.completed_at,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
  };
}

async function verifyUser(userId: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  if (!user || user.id !== userId) {
    throw new Error("Your account has changed. Sign in again.");
  }
}

export async function loadCloudFocusHistory(
  userId: string,
): Promise<FocusHistoryEntry[]> {
  await verifyUser(userId);

  const all: FocusRow[] = [];
  let offset = 0;
  const pageSize = 500;

  for (;;) {
    const { data, error } = await supabase
      .from("fm_focus_history")
      .select(
        "id,task_id,task_title,duration_minutes,completed_at,project_id,project_name",
      )
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as FocusRow[];

    all.push(...rows);

    if (rows.length < pageSize) break;

    offset += rows.length;
  }

  return all.map(mapFocus);
}

export async function addCloudFocusEntry(
  userId: string,
  entry: FocusHistoryEntry,
): Promise<void> {
  await verifyUser(userId);

  if (
    !entry.id ||
    !entry.taskId ||
    !entry.taskTitle.trim() ||
    !Number.isFinite(entry.durationMinutes) ||
    entry.durationMinutes <= 0 ||
    !Number.isFinite(Date.parse(entry.completedAt))
  ) {
    throw new Error("Invalid focus session.");
  }

  // Stable session ID prevents duplicates on retry.
  const { error } = await supabase.from("fm_focus_history").upsert(
    {
      id: entry.id,
      user_id: userId,
      task_id: entry.taskId,
      task_title: entry.taskTitle,
      duration_minutes: entry.durationMinutes,
      completed_at: entry.completedAt,
      project_id: entry.projectId || null,
      project_name: entry.projectName || null,
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}
