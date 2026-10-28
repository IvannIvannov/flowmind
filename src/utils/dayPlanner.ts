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

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortByImportance(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityDifference =
      PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const aDate = a.dueDate || "9999-12-31";
    const bDate = b.dueDate || "9999-12-31";

    const dateDifference = aDate.localeCompare(bDate);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function createDayPlan(
  tasks: Task[],
  date: Date = new Date(),
  selectedFocusIds: string[] | null = null,
): DayPlan {
  const todayKey = localDateKey(date);

  const activeTasks = tasks.filter((task) => task.status !== "completed");

  const today = activeTasks.filter((task) => task.dueDate === todayKey);

  const overdue = activeTasks.filter(
    (task) => Boolean(task.dueDate) && task.dueDate! < todayKey,
  );

  const completed = tasks.filter(
    (task) => task.status === "completed" && task.dueDate === todayKey,
  );

  let focus: Task[];

  if (selectedFocusIds === null) {
    focus = sortByImportance([...overdue, ...today]).slice(0, 3);
  } else {
    const selected = new Set(selectedFocusIds.slice(0, 3));

    focus = activeTasks
      .filter((task) => selected.has(task.id))
      .sort(
        (a, b) =>
          selectedFocusIds.indexOf(a.id) - selectedFocusIds.indexOf(b.id),
      )
      .slice(0, 3);
  }

  const totalToday = today.length + completed.length;

  const progress =
    totalToday > 0 ? Math.round((completed.length / totalToday) * 100) : 0;

  return {
    today: sortByImportance(today),
    overdue: sortByImportance(overdue),
    focus,
    completed,
    progress,
  };
}
