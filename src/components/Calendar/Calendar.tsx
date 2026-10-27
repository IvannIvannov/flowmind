import { useMemo, useState } from "react";

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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb7185",
};

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

      map.set(task.dueDate, [...existing, task]);
    });

    return map;
  }, [tasks]);

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  const completedTasks = selectedTasks.filter(
    (task) => task.status === "completed",
  ).length;

  function navigateMonth(direction: number) {
    setSelectedDate(changeMonth(selectedDate, direction));
  }

  function goToToday() {
    setSelectedDate(getTodayKey());
  }

  function findProject(projectId?: string) {
    return projects.find((project) => project.id === projectId);
  }

  const selectedDateTitle = formatDate(selectedDate, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-page">
      <header className="page-header">
        <p className="subtitle">PLAN YOUR TIME</p>

        <h1>Calendar 📅</h1>

        <p className="description">
          Plan your schedule and keep track of upcoming deadlines.
        </p>
      </header>

      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-toolbar">
            <h2>{monthTitle}</h2>

            <div className="calendar-controls">
              <button
                type="button"
                onClick={goToToday}
                className="calendar-today"
              >
                Today
              </button>

              <button
                type="button"
                aria-label="Previous month"
                onClick={() => navigateMonth(-1)}
              >
                ‹
              </button>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => navigateMonth(1)}
              >
                ›
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}

            {calendarDays.map((day) => {
              const dayTasks = tasksByDate.get(day.key) ?? [];

              const isSelected = day.key === selectedDate;

              const isToday = day.key === today;

              const activeCount = dayTasks.filter(
                (task) => task.status !== "completed",
              ).length;

              return (
                <button
                  type="button"
                  key={day.key}
                  className={[
                    "calendar-day",
                    !day.isCurrentMonth ? "outside-month" : "",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`${day.key}, ` + `${dayTasks.length} tasks`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDate(day.key)}
                >
                  <span className="calendar-day-number">{day.number}</span>

                  {dayTasks.length > 0 && (
                    <div className="calendar-day-tasks">
                      <div className="calendar-dots">
                        {dayTasks.slice(0, 4).map((task) => (
                          <span
                            key={task.id}
                            className={
                              task.status === "completed"
                                ? "calendar-dot completed"
                                : "calendar-dot"
                            }
                            style={{
                              backgroundColor: PRIORITY_COLORS[task.priority],
                            }}
                          />
                        ))}
                      </div>

                      <span className="calendar-count">
                        {activeCount} active
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            {(Object.entries(PRIORITY_COLORS) as [Priority, string][]).map(
              ([priority, color]) => (
                <span key={priority}>
                  <i
                    style={{
                      backgroundColor: color,
                    }}
                  />

                  {priority}
                </span>
              ),
            )}
          </div>
        </section>

        <aside className="calendar-details">
          <div className="calendar-details-header">
            <p className="subtitle">SELECTED DAY</p>

            <h2>{selectedDateTitle}</h2>

            <p className="calendar-details-count">
              {selectedTasks.length} tasks
              {" · "}
              {completedTasks} completed
            </p>

            <button
              className="calendar-add-button"
              type="button"
              onClick={() => onAddTask(selectedDate)}
            >
              + Add Task
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="calendar-empty">
              <div className="calendar-empty-icon">🗓️</div>

              <h3>Nothing scheduled</h3>

              <p>Select another date or create a new task for this day.</p>
            </div>
          ) : (
            <div className="calendar-task-list">
              {selectedTasks.map((task) => {
                const project = findProject(task.projectId);

                return (
                  <button
                    type="button"
                    key={task.id}
                    className="calendar-task-card"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span
                      className="calendar-task-accent"
                      style={{
                        backgroundColor: PRIORITY_COLORS[task.priority],
                      }}
                    />

                    <div className="calendar-task-content">
                      <h3
                        className={
                          task.status === "completed"
                            ? "calendar-task-done"
                            : ""
                        }
                      >
                        {task.title}
                      </h3>

                      <div className="calendar-task-meta">
                        <span>{task.priority} priority</span>

                        <span>
                          {task.status === "completed"
                            ? "Completed"
                            : task.status === "in-progress"
                              ? "In Progress"
                              : "To Do"}
                        </span>
                      </div>

                      {project && (
                        <div className="calendar-project">
                          <span
                            className="calendar-project-dot"
                            style={{
                              backgroundColor: project.color,
                            }}
                          />

                          {project.name}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Calendar;
