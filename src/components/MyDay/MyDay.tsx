import { useEffect, useMemo, useState } from "react";

import type { Project, Task, TaskStatus } from "../../types";

import { createDayPlan, localDateKey } from "../../utils/dayPlanner";

import FocusTimer from "./FocusTimer";
import FocusHistory from "./FocusHistory";

import "./MyDay.css";

interface MyDayProps {
  tasks: Task[];
  projects: Project[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onOpenTasks: () => void;
}

interface FocusSelection {
  dayKey: string;
  ids: string[] | null;
}

type TaskSection = "today" | "overdue" | "completed";

const PRIORITY_SCORE = {
  high: 3,
  medium: 2,
  low: 1,
};

function focusKey(day: string): string {
  return `flowmind-focus-${day}`;
}

function loadSelection(day: string): string[] | null {
  try {
    const raw = localStorage.getItem(focusKey(day));

    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return null;

    return Array.from(
      new Set(parsed.filter((id): id is string => typeof id === "string")),
    ).slice(0, 3);
  } catch {
    return null;
  }
}

function saveSelection(day: string, ids: string[] | null): boolean {
  try {
    if (ids === null) {
      localStorage.removeItem(focusKey(day));
    } else {
      localStorage.setItem(focusKey(day), JSON.stringify(ids));
    }

    return true;
  } catch (error) {
    console.error("FlowMind: cannot save focus selection", error);

    return false;
  }
}

function prettyDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function shortDueDate(date?: string): string {
  if (!date) return "No date";

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function MyDay({
  tasks,
  projects,
  onStatusChange,
  onEditTask,
  onOpenTasks,
}: MyDayProps) {
  const [now, setNow] = useState(() => new Date());

  const todayKey = localDateKey(now);

  const [focusSelection, setFocusSelection] = useState<FocusSelection>(() => {
    const today = localDateKey(new Date());

    return {
      dayKey: today,
      ids: loadSelection(today),
    };
  });

  const [editingFocus, setEditingFocus] = useState(false);

  const [showAllCandidates, setShowAllCandidates] = useState(false);

  const [openSections, setOpenSections] = useState<
    Record<TaskSection, boolean>
  >({
    today: true,
    overdue: true,
    completed: false,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const focusIds =
    focusSelection.dayKey === todayKey
      ? focusSelection.ids
      : loadSelection(todayKey);

  const plan = useMemo(
    () => createDayPlan(tasks, now, focusIds),
    [tasks, todayKey, focusIds],
  );

  const activeTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "completed")
      .sort((a, b) => {
        const priority =
          PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];

        if (priority !== 0) return priority;

        const dateComparison = (a.dueDate || "9999-12-31").localeCompare(
          b.dueDate || "9999-12-31",
        );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [tasks]);

  const candidates = activeTasks;

  const visibleCandidates = showAllCandidates
    ? candidates
    : candidates.slice(0, 8);

  const focusTaskIds = new Set(plan.focus.map((task) => task.id));

  const completedToday = plan.completed.length;

  const scheduledToday = plan.today.length + completedToday;

  const progress =
    scheduledToday === 0
      ? 0
      : Math.round((completedToday / scheduledToday) * 100);

  function projectName(projectId?: string): string {
    return (
      projects.find((project) => project.id === projectId)?.name ?? "Personal"
    );
  }

  function updateFocus(ids: string[] | null) {
    const next = ids?.slice(0, 3) ?? null;

    if (!saveSelection(todayKey, next)) return;

    setFocusSelection({
      dayKey: todayKey,
      ids: next,
    });
  }

  function togglePriority(id: string) {
    const current = plan.focus.map((task) => task.id);

    if (current.includes(id)) {
      updateFocus(current.filter((item) => item !== id));
      return;
    }

    if (current.length >= 3) return;

    updateFocus([...current, id]);
  }

  function toggleSection(id: TaskSection) {
    setOpenSections((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function renderTask(task: Task, section: TaskSection) {
    const completed = task.status === "completed";

    return (
      <div
        key={task.id}
        className={`fm-day-task-row ${completed ? "is-done" : ""}`}
      >
        <button
          type="button"
          className={`fm-day-check ${completed ? "is-checked" : ""}`}
          onClick={() =>
            onStatusChange(task.id, completed ? "todo" : "completed")
          }
          aria-label={
            completed ? `Reopen ${task.title}` : `Complete ${task.title}`
          }
          title={completed ? "Reopen task" : "Mark as completed"}
        >
          {completed ? "✓" : ""}
        </button>

        <div className="fm-day-task-content">
          <button
            type="button"
            className="fm-day-task-title"
            onClick={() => onEditTask(task)}
            title="Edit task"
          >
            {task.title}
          </button>

          <span className="fm-day-task-meta">
            {projectName(task.projectId)}
            <span aria-hidden="true"> · </span>
            {shortDueDate(task.dueDate)}
          </span>
        </div>

        {section === "today" && task.status === "todo" && (
          <button
            type="button"
            className="fm-day-task-start"
            onClick={() => onStatusChange(task.id, "in-progress")}
          >
            Start
          </button>
        )}

        {task.status === "in-progress" && (
          <span className="fm-day-task-status">In progress</span>
        )}
      </div>
    );
  }

  function renderSection(
    id: TaskSection,
    title: string,
    description: string,
    items: Task[],
  ) {
    return (
      <section className="fm-day-section" aria-label={title}>
        <button
          type="button"
          className="fm-day-section-trigger"
          aria-expanded={openSections[id]}
          onClick={() => toggleSection(id)}
        >
          <span className="fm-day-section-info">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>

          <span className="fm-day-section-count">{items.length}</span>

          <span
            className={`fm-day-section-chevron ${
              openSections[id] ? "is-open" : ""
            }`}
            aria-hidden="true"
          >
            ⌄
          </span>
        </button>

        {openSections[id] && (
          <div className="fm-day-section-body">
            {items.length === 0 ? (
              <p className="fm-day-section-empty">
                {id === "today"
                  ? "Nothing scheduled for today."
                  : id === "overdue"
                    ? "No overdue tasks. You're on track."
                    : "No completed tasks scheduled for today."}
              </p>
            ) : (
              items.map((task) => renderTask(task, id))
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="fm-my-day">
      <header className="fm-day-header">
        <div>
          <p className="fm-day-eyebrow">{prettyDate(now)}</p>

          <h1>
            Ready when you are<span>.</span>
          </h1>

          <p className="fm-day-description">
            One task at a time. Everything in its place.
          </p>
        </div>

        <button
          type="button"
          className="fm-day-all-tasks"
          onClick={onOpenTasks}
        >
          All tasks <span aria-hidden="true">↗</span>
        </button>
      </header>

      {/* 1. PRIMARY ACTION: THE TIMER */}

      <div className="fm-day-timer-area">
        <FocusTimer tasks={plan.focus} />
      </div>

      {/* 2. LIGHTWEIGHT DAY SUMMARY */}

      <div className="fm-day-status-strip" aria-label="Daily overview">
        <div>
          <strong>{plan.today.length}</strong>
          <span>Due today</span>
        </div>

        <div>
          <strong>{plan.overdue.length}</strong>
          <span>Overdue</span>
        </div>

        <div>
          <strong>{completedToday}</strong>
          <span>Completed</span>
        </div>

        <div>
          <strong>{progress}%</strong>
          <span>Daily progress</span>
        </div>
      </div>

      {/* 3. PRIORITIES AND REMAINING TASKS */}

      <div className="fm-day-workspace">
        <section className="fm-day-priorities" aria-label="Your priorities">
          <div className="fm-day-panel-heading">
            <div>
              <span className="fm-day-kicker">START HERE</span>
              <h2>Your priorities</h2>
              <p>Choose up to three tasks to focus on.</p>
            </div>

            <button
              type="button"
              className="fm-day-quiet-button"
              aria-expanded={editingFocus}
              onClick={() => setEditingFocus((value) => !value)}
            >
              {editingFocus ? "Done" : "Customize"}
            </button>
          </div>

          {plan.focus.length === 0 ? (
            <div className="fm-day-priority-empty">
              <p>Your focus list is empty. Choose a task to get started.</p>

              <button
                type="button"
                className="fm-day-primary-button"
                onClick={() => setEditingFocus(true)}
              >
                Choose priorities
              </button>
            </div>
          ) : (
            <div className="fm-day-priority-list">
              {plan.focus.map((task, index) => (
                <div key={task.id} className="fm-day-priority-item">
                  <span className="fm-day-priority-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="fm-day-priority-info">
                    <button type="button" onClick={() => onEditTask(task)}>
                      {task.title}
                    </button>

                    <small>{projectName(task.projectId)}</small>
                  </div>

                  <button
                    type="button"
                    className="fm-day-priority-done"
                    title="Mark as completed"
                    aria-label={`Complete ${task.title}`}
                    onClick={() => onStatusChange(task.id, "completed")}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          )}

          {editingFocus && (
            <div className="fm-day-customize">
              <div className="fm-day-customize-head">
                <div>
                  <h3>Select priorities</h3>
                  <p>{plan.focus.length} of 3 selected</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    updateFocus(null);
                    setEditingFocus(false);
                    setShowAllCandidates(false);
                  }}
                >
                  Auto-select
                </button>
              </div>

              {candidates.length === 0 ? (
                <p className="fm-day-empty">No active tasks available.</p>
              ) : (
                <>
                  <div className="fm-day-candidate-list">
                    {visibleCandidates.map((task) => {
                      const selected = focusTaskIds.has(task.id);

                      return (
                        <label
                          className={`fm-day-candidate ${
                            selected ? "selected" : ""
                          }`}
                          key={task.id}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && focusTaskIds.size >= 3}
                            onChange={() => togglePriority(task.id)}
                          />

                          <span>
                            <strong>{task.title}</strong>
                            <small>{projectName(task.projectId)}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {candidates.length > 8 && (
                    <button
                      type="button"
                      className="fm-day-show-more"
                      onClick={() => setShowAllCandidates((value) => !value)}
                    >
                      {showAllCandidates
                        ? "Show less"
                        : `Show all ${candidates.length} tasks`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        <section className="fm-day-other-tasks" aria-label="Your task lists">
          <div className="fm-day-panel-heading">
            <div>
              <span className="fm-day-kicker">KEEP MOVING</span>

              <h2>Your task lists</h2>

              <p>Everything else, neatly organized.</p>
            </div>
          </div>

          {renderSection(
            "today",
            "Due today",
            "Scheduled for today",
            plan.today,
          )}

          {renderSection("overdue", "Overdue", "Needs attention", plan.overdue)}

          {renderSection(
            "completed",
            "Completed",
            "Finished today",
            plan.completed,
          )}
        </section>
      </div>

      {/* 4. OPTIONAL HISTORY */}

      <div className="fm-day-history-area">
        <FocusHistory />
      </div>
    </div>
  );
}

export default MyDay;
