export interface FocusHistoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  durationMinutes: number;
  completedAt: string;
}

export interface FocusHistoryStats {
  todayMinutes: number;
  weekMinutes: number;
  totalMinutes: number;
  totalSessions: number;
}

export const FOCUS_HISTORY_KEY = "flowmind-focus-history-v1";

export const FOCUS_HISTORY_UPDATED = "flowmind-focus-history-updated";

const MAX_HISTORY_ENTRIES = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFocusHistoryEntry(value: unknown): value is FocusHistoryEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.taskId === "string" &&
    typeof value.taskTitle === "string" &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes > 0 &&
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt))
  );
}

export function loadFocusHistory(): FocusHistoryEntry[] {
  try {
    const stored = localStorage.getItem(FOCUS_HISTORY_KEY);

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();

    return parsed
      .filter(isFocusHistoryEntry)
      .filter((entry) => {
        if (seen.has(entry.id)) {
          return false;
        }

        seen.add(entry.id);

        return true;
      })
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch (error) {
    console.error("FlowMind: could not load focus history", error);

    return [];
  }
}

export function addFocusHistoryEntry(entry: FocusHistoryEntry): boolean {
  if (!isFocusHistoryEntry(entry)) {
    return false;
  }

  try {
    const existing = loadFocusHistory();

    // Every timer session has its own unique ID.
    // Never record the same session twice.
    if (existing.some((item) => item.id === entry.id)) {
      return true;
    }

    const updated = [entry, ...existing]
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, MAX_HISTORY_ENTRIES);

    localStorage.setItem(FOCUS_HISTORY_KEY, JSON.stringify(updated));

    window.dispatchEvent(new Event(FOCUS_HISTORY_UPDATED));

    return true;
  } catch (error) {
    console.error("FlowMind: could not save focus history", error);

    return false;
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const daysSinceMonday = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

export function getFocusHistoryStats(
  entries: FocusHistoryEntry[],
  now: Date = new Date(),
): FocusHistoryStats {
  const todayKey = localDateKey(now);

  const weekStart = startOfWeek(now);
  const nextWeekStart = new Date(weekStart);

  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  let todayMinutes = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  let totalSessions = 0;

  for (const entry of entries) {
    const completed = new Date(entry.completedAt);

    if (
      Number.isNaN(completed.getTime()) ||
      completed.getTime() > now.getTime()
    ) {
      continue;
    }

    const minutes = entry.durationMinutes;

    totalSessions += 1;
    totalMinutes += minutes;

    if (localDateKey(completed) === todayKey) {
      todayMinutes += minutes;
    }

    if (completed >= weekStart && completed < nextWeekStart) {
      weekMinutes += minutes;
    }
  }

  return {
    todayMinutes,
    weekMinutes,
    totalMinutes,
    totalSessions,
  };
}

export function formatFocusMinutes(minutes: number): string {
  const rounded = Math.round(Math.max(0, minutes));

  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;

  if (hours === 0) {
    return `${remaining}m`;
  }

  if (remaining === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remaining}m`;
}
