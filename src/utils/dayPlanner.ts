
import type { Task } from "../types";

export interface DayPlan {
  today: Task[];
  overdue: Task[];
  focus: Task[];
  completed: Task[];
  progress: number;
}

const PRIORITY_SCORE = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortByImportance(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityDifference =
      PRIORITY_SCORE[b.priority] -
      PRIORITY_SCORE[a.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const aDate = a.dueDate || "9999-12-31";
    const bDate = b.dueDate || "9999-12-31";

    return aDate.localeCompare(bDate);
  });
}

export function createDayPlan(
  tasks: Task[],
  date: Date = new Date()
): DayPlan {
  const todayKey = localDateKey(date);

  const today = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.dueDate === todayKey
  );

  const overdue = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      Boolean(task.dueDate) &&
      task.dueDate! < todayKey
  );

  const completed = tasks.filter(
    (task) =>
      task.status === "completed" &&
      task.dueDate === todayKey
  );

  const focus = sortByImportance([
    ...overdue,
    ...today,
  ]).slice(0, 3);

  const totalToday = today.length + completed.length;

  const progress =
    totalToday > 0
      ? Math.round(
          (completed.length / totalToday) * 100
        )
      : 0;

  return {
    today: sortByImportance(today),
    overdue: sortByImportance(overdue),
    focus,
    completed,
    progress,
  };
}
