export interface FocusHistoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  durationMinutes: number;
  completedAt: string;
  projectId?: string;
  projectName?: string;
}

export interface FocusHistoryStats {
  todayMinutes: number;
  weekMinutes: number;
  totalMinutes: number;
  totalSessions: number;
}

export interface ProjectFocusStats {
  key: string;
  projectId?: string;
  name: string;
  minutes: number;
  sessions: number;
}

export type FocusPeriod = "this-week" | "last-week" | "all";

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
    !Number.isNaN(Date.parse(value.completedAt)) &&
    (value.projectId === undefined || typeof value.projectId === "string") &&
    (value.projectName === undefined || typeof value.projectName === "string")
  );
}

export function loadFocusHistory(): FocusHistoryEntry[] {
  try {
    const stored = localStorage.getItem(FOCUS_HISTORY_KEY);

    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();

    return parsed
      .filter(isFocusHistoryEntry)
      .filter((entry) => {
        if (seen.has(entry.id)) return false;

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
  if (!isFocusHistoryEntry(entry)) return false;

  try {
    const existing = loadFocusHistory();

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

export function localFocusDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function focusWeekStart(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));

  return result;
}

export function filterFocusEntries(
  entries: FocusHistoryEntry[],
  period: FocusPeriod,
  now: Date = new Date(),
): FocusHistoryEntry[] {
  const monday = focusWeekStart(now);

  const start =
    period === "last-week"
      ? new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7)
      : monday;

  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7,
  );

  return entries.filter((entry) => {
    const timestamp = Date.parse(entry.completedAt);

    if (!Number.isFinite(timestamp) || timestamp > now.getTime()) {
      return false;
    }

    if (period === "all") return true;

    return timestamp >= start.getTime() && timestamp < end.getTime();
  });
}

export function getFocusHistoryStats(
  entries: FocusHistoryEntry[],
  now: Date = new Date(),
): FocusHistoryStats {
  const todayKey = localFocusDateKey(now);
  const weekEntries = filterFocusEntries(entries, "this-week", now);
  const weekIds = new Set(weekEntries.map((entry) => entry.id));

  let todayMinutes = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  let totalSessions = 0;

  for (const entry of entries) {
    const completed = new Date(entry.completedAt);

    if (Number.isNaN(completed.getTime()) || completed > now) {
      continue;
    }

    totalSessions++;
    totalMinutes += entry.durationMinutes;

    if (weekIds.has(entry.id)) {
      weekMinutes += entry.durationMinutes;
    }

    if (localFocusDateKey(completed) === todayKey) {
      todayMinutes += entry.durationMinutes;
    }
  }

  return {
    todayMinutes,
    weekMinutes,
    totalMinutes,
    totalSessions,
  };
}

export function getProjectFocusStats(
  entries: FocusHistoryEntry[],
): ProjectFocusStats[] {
  const groups = new Map<string, ProjectFocusStats>();

  for (const entry of entries) {
    const key = entry.projectId
      ? `project:${entry.projectId}`
      : entry.projectName
        ? `legacy:${entry.projectName}`
        : "unassigned";

    const name =
      entry.projectName?.trim() ||
      (entry.projectId
        ? "Deleted or unknown project"
        : "No Project / Earlier Sessions");

    const previous = groups.get(key);

    if (previous) {
      previous.minutes += entry.durationMinutes;
      previous.sessions += 1;
    } else {
      groups.set(key, {
        key,
        projectId: entry.projectId,
        name,
        minutes: entry.durationMinutes,
        sessions: 1,
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
}

export function formatFocusMinutes(minutes: number): string {
  const rounded = Math.round(Math.max(0, minutes));
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;

  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}
