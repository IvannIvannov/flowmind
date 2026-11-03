import { supabase } from "../lib/supabase";

interface DayPriorityRow {
  task_ids: string[];
}

function validateDay(day: string): void {
  const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(day);

  if (!validFormat) {
    throw new Error("Invalid day format.");
  }

  const [year, month, date] = day.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, date));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== date
  ) {
    throw new Error("Invalid day.");
  }
}

async function verifyUser(userId: string): Promise<void> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user || user.id !== userId) {
    throw new Error("Your session has changed. Please sign in again.");
  }
}

/**
 * null = automatic selection
 * []   = explicitly empty selection
 * IDs  = manually selected priorities
 */
export async function loadCloudDayPriorities(
  userId: string,
  day: string,
): Promise<string[] | null> {
  validateDay(day);
  await verifyUser(userId);

  const { data, error } = await supabase
    .from("fm_day_priorities")
    .select("task_ids")
    .eq("user_id", userId)
    .eq("day_key", day)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as DayPriorityRow;

  if (
    !Array.isArray(row.task_ids) ||
    row.task_ids.some((id) => typeof id !== "string")
  ) {
    throw new Error("Invalid priorities received from the server.");
  }

  return [...new Set(row.task_ids)].slice(0, 3);
}

export async function saveCloudDayPriorities(
  userId: string,
  day: string,
  ids: string[] | null,
): Promise<void> {
  validateDay(day);
  await verifyUser(userId);

  // Automatic selection removes the manual override.
  if (ids === null) {
    const { error } = await supabase
      .from("fm_day_priorities")
      .delete()
      .eq("user_id", userId)
      .eq("day_key", day);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length > 3) {
    throw new Error("You can select a maximum of three priorities.");
  }

  const { error } = await supabase.from("fm_day_priorities").upsert(
    {
      user_id: userId,
      day_key: day,
      task_ids: uniqueIds,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,day_key",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
