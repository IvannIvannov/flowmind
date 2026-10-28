import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { Task, Project, Priority } from "../../types";

import {
  getTodayKey,
  toDateKey,
  parseDateKey,
  formatDate,
  changeMonth,
  getMonthTitle,
} from "../../utils/dates";

import "./Calendar.css";

interface CalendarProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (date: string) => void;
  onOpenTask: (taskId: string) => void;
}

type IconName =
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "calendar"
  | "check"
  | "clock"
  | "folder"
  | "arrow"
  | "list";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,

    "chevron-left": <path d="m15 18-6-6 6-6" />,

    "chevron-right": <path d="m9 18 6-6-6-6" />,

    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),

    check: <path d="m5 12 4 4 14-14" />,

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    folder: (
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    ),

    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,

    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function taskStatusLabel(task: Task): string {
  switch (task.status) {
    case "completed":
      return "Completed";
    case "in-progress":
      return "In progress";
    default:
      return "To do";
  }
}

function Calendar({ tasks, projects, onAddTask, onOpenTask }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(getTodayKey);

  const today = getTodayKey();

  const currentDate = parseDateKey(selectedDate) ?? new Date();

  const year = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthTitle = getMonthTitle(year, currentMonth);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, currentMonth, 1);

    const totalDays = new Date(year, currentMonth + 1, 0).getDate();

    const startingDay = (firstDay.getDay() + 6) % 7;

    const totalCells = Math.ceil((startingDay + totalDays) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - startingDay + 1;

      const date = new Date(year, currentMonth, dayNumber);

      return {
        key: toDateKey(date),
        number: date.getDate(),
        isCurrentMonth: date.getMonth() === currentMonth,
      };
    });
  }, [year, currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (!task.dueDate) return;

      const existing = map.get(task.dueDate) ?? [];

      existing.push(task);
      map.set(task.dueDate, existing);
    });

    return map;
  }, [tasks]);

  const selectedTasks = useMemo(() => {
    return [...(tasksByDate.get(selectedDate) ?? [])].sort((a, b) => {
      const aCompleted = a.status === "completed" ? 1 : 0;

      const bCompleted = b.status === "completed" ? 1 : 0;

      if (aCompleted !== bCompleted) {
        return aCompleted - bCompleted;
      }

      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }, [tasksByDate, selectedDate]);

  const completedTasks = selectedTasks.filter(
    (task) => task.status === "completed",
  ).length;

  const activeTasks = selectedTasks.length - completedTasks;

  const selectedDateTitle = formatDate(selectedDate, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectedDayIsToday = selectedDate === today;

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  function navigateMonth(direction: number) {
    setSelectedDate(changeMonth(selectedDate, direction));
  }

  function goToToday() {
    setSelectedDate(getTodayKey());
  }

  function selectDay(date: string) {
    setSelectedDate(date);
  }

  function findProject(projectId?: string) {
    if (!projectId) return undefined;

    return projectMap.get(projectId);
  }

  function renderTask(task: Task) {
    const project = findProject(task.projectId);

    const completed = task.status === "completed";

    return (
      <button
        key={task.id}
        type="button"
        className={`fm-calendar-task ${completed ? "is-completed" : ""}`}
        onClick={() => onOpenTask(task.id)}
        aria-label={`Open task ${task.title}`}
      >
        <span
          className={`fm-calendar-task-priority is-${task.priority}`}
          aria-hidden="true"
        />

        <div className="fm-calendar-task-content">
          <h3>{task.title}</h3>

          <div className="fm-calendar-task-meta">
            <span className={`fm-calendar-priority-label is-${task.priority}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>

            <span className="fm-calendar-meta-divider">·</span>

            <span
              className={`fm-calendar-task-status ${
                completed ? "is-completed" : ""
              }`}
            >
              {taskStatusLabel(task)}
            </span>
          </div>

          {project && (
            <div className="fm-calendar-task-project">
              <span
                className="fm-calendar-project-dot"
                style={{
                  backgroundColor: project.color,
                }}
              />
              {project.name}
            </div>
          )}
        </div>

        <span className="fm-calendar-task-arrow" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
      </button>
    );
  }

  return (
    <main className="fm-calendar">
      {/* HEADER */}

      <header className="fm-calendar-header">
        <div>
          <p className="fm-calendar-subtitle">YOUR SCHEDULE</p>

          <h1>
            Calendar<span>.</span>
          </h1>

          <p className="fm-calendar-description">
            Plan your days with clarity.
          </p>
        </div>

        <button
          type="button"
          className="fm-calendar-new-button"
          onClick={() => onAddTask(selectedDate)}
        >
          <Icon name="plus" size={17} />
          New task
        </button>
      </header>

      {/* CALENDAR LAYOUT */}

      <div className="fm-calendar-layout">
        <section className="fm-calendar-panel" aria-label="Monthly calendar">
          <div className="fm-calendar-toolbar">
            <h2>{monthTitle}</h2>

            <div className="fm-calendar-controls">
              <button
                type="button"
                className="fm-calendar-today-button"
                onClick={goToToday}
              >
                Today
              </button>

              <button
                type="button"
                className="fm-calendar-nav-button"
                aria-label="Previous month"
                title="Previous month"
                onClick={() => navigateMonth(-1)}
              >
                <Icon name="chevron-left" size={17} />
              </button>

              <button
                type="button"
                className="fm-calendar-nav-button"
                aria-label="Next month"
                title="Next month"
                onClick={() => navigateMonth(1)}
              >
                <Icon name="chevron-right" size={17} />
              </button>
            </div>
          </div>

          <div className="fm-calendar-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="fm-calendar-weekday">
                {day}
              </div>
            ))}

            {calendarDays.map((day) => {
              const dayTasks = tasksByDate.get(day.key) ?? [];

              const isSelected = day.key === selectedDate;

              const isToday = day.key === today;

              const openCount = dayTasks.filter(
                (task) => task.status !== "completed",
              ).length;

              const sortedIndicators = [...dayTasks].sort((a, b) => {
                const aCompleted = a.status === "completed" ? 1 : 0;

                const bCompleted = b.status === "completed" ? 1 : 0;

                if (aCompleted !== bCompleted) {
                  return aCompleted - bCompleted;
                }

                return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
              });

              return (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    "fm-calendar-day",
                    !day.isCurrentMonth ? "outside-month" : "",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`${day.key}, ${dayTasks.length} tasks`}
                  aria-pressed={isSelected}
                  onClick={() => selectDay(day.key)}
                >
                  <span className="fm-calendar-day-top">
                    <span className="fm-calendar-day-number">{day.number}</span>

                    {isToday && <span className="fm-calendar-today-dot" />}
                  </span>

                  {dayTasks.length > 0 && (
                    <div className="fm-calendar-day-content">
                      <div className="fm-calendar-dots">
                        {sortedIndicators.slice(0, 4).map((task) => (
                          <span
                            key={task.id}
                            className={`fm-calendar-dot is-${task.priority} ${
                              task.status === "completed" ? "is-completed" : ""
                            }`}
                          />
                        ))}
                      </div>

                      <span className="fm-calendar-day-count">
                        {openCount > 0 ? `${openCount} active` : "All done"}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="fm-calendar-footer">
            <div className="fm-calendar-legend" aria-label="Priority legend">
              <span>
                <i className="is-high" />
                High
              </span>

              <span>
                <i className="is-medium" />
                Medium
              </span>

              <span>
                <i className="is-low" />
                Low
              </span>
            </div>

            <span className="fm-calendar-footer-hint">
              Select a date to view tasks
            </span>
          </div>
        </section>

        {/* SELECTED DAY */}

        <aside className="fm-calendar-details" aria-label="Selected day tasks">
          <div className="fm-calendar-details-header">
            <div className="fm-calendar-details-top">
              <span className="fm-calendar-kicker">SELECTED DAY</span>

              {selectedDayIsToday && (
                <span className="fm-calendar-today-badge">Today</span>
              )}
            </div>

            <h2>{selectedDateTitle}</h2>

            <p className="fm-calendar-details-description">
              {selectedTasks.length === 0
                ? "Your schedule is clear."
                : `${selectedTasks.length} ${
                    selectedTasks.length === 1 ? "task" : "tasks"
                  } scheduled`}
            </p>
          </div>

          <div className="fm-calendar-day-summary">
            <div>
              <strong>{activeTasks}</strong>
              <span>Open</span>
            </div>

            <div>
              <strong>{completedTasks}</strong>
              <span>Completed</span>
            </div>
          </div>

          <div className="fm-calendar-details-actions">
            <button
              type="button"
              className="fm-calendar-add-button"
              onClick={() => onAddTask(selectedDate)}
            >
              <Icon name="plus" size={16} />
              Add task
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="fm-calendar-empty">
              <span className="fm-calendar-empty-icon">
                <Icon name="calendar" size={22} />
              </span>

              <h3>Nothing scheduled</h3>

              <p>A little breathing room. Add a task whenever you are ready.</p>
            </div>
          ) : (
            <div className="fm-calendar-task-list">
              {selectedTasks.map(renderTask)}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default Calendar;
