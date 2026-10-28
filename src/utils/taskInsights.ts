import type { Task } from "../types";

export type SmartTaskFilter =
  | "all"
  | "today"
  | "overdue"
  | "upcoming"
  | "high-priority";

export interface TaskInsights {
  today: number;
  overdue: number;
  upcoming: number;
  highPriority: number;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  result.setDate(result.getDate() + days);

  return result;
}

export function getTaskInsights(
  tasks: Task[],
  today: Date = new Date(),
): TaskInsights {
  const todayKey = toLocalDateKey(today);

  const nextWeekKey = toLocalDateKey(addLocalDays(today, 7));

  const activeTasks = tasks.filter((task) => task.status !== "completed");

  return {
    today: activeTasks.filter((task) => task.dueDate === todayKey).length,

    overdue: activeTasks.filter(
      (task) => Boolean(task.dueDate) && task.dueDate! < todayKey,
    ).length,

    upcoming: activeTasks.filter(
      (task) =>
        Boolean(task.dueDate) &&
        task.dueDate! > todayKey &&
        task.dueDate! <= nextWeekKey,
    ).length,

    highPriority: activeTasks.filter((task) => task.priority === "high").length,
  };
}

export function matchesSmartTaskFilter(
  task: Task,
  filter: SmartTaskFilter,
  today: Date = new Date(),
): boolean {
  if (filter === "all") {
    return true;
  }

  if (task.status === "completed") {
    return false;
  }

  const todayKey = toLocalDateKey(today);

  if (filter === "today") {
    return task.dueDate === todayKey;
  }

  if (filter === "overdue") {
    return Boolean(task.dueDate && task.dueDate < todayKey);
  }

  if (filter === "upcoming") {
    const nextWeekKey = toLocalDateKey(addLocalDays(today, 7));

    return Boolean(
      task.dueDate && task.dueDate > todayKey && task.dueDate <= nextWeekKey,
    );
  }

  if (filter === "high-priority") {
    return task.priority === "high";
  }

  return true;
}
