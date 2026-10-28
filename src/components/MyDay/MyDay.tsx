import { useMemo, useState } from "react";

import type { Project, Task, TaskStatus } from "../../types";

import { createDayPlan, localDateKey } from "../../utils/dayPlanner";

import { formatDate } from "../../utils/dates";

import FocusTimer from "./FocusTimer";

import "./MyDay.css";

interface MyDayProps {
  tasks: Task[];
  projects: Project[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onOpenTasks: () => void;
}

const FOCUS_STORAGE_PREFIX = "flowmind-focus-";

function readFocusSelection(dayKey: string): string[] | null {
  try {
    const stored = localStorage.getItem(`${FOCUS_STORAGE_PREFIX}${dayKey}`);

    if (stored === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);

    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === "string")
    ) {
      return null;
    }

    return [...new Set(parsed)].slice(0, 3);
  } catch (error) {
    console.error("FlowMind: could not read focus selection", error);

    return null;
  }
}

function saveFocusSelection(dayKey: string, ids: string[] | null): void {
  try {
    const storageKey = `${FOCUS_STORAGE_PREFIX}${dayKey}`;

    if (ids === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(ids.slice(0, 3)));
    }
  } catch (error) {
    console.error("FlowMind: could not save focus selection", error);
  }
}

function MyDay({
  tasks,
  projects,
  onStatusChange,
  onEditTask,
  onOpenTasks,
}: MyDayProps) {
  const todayKey = localDateKey(new Date());

  const today = useMemo(() => new Date(), [todayKey]);

  const [focusState, setFocusState] = useState<{
    dayKey: string;
    ids: string[] | null;
  }>(() => ({
    dayKey: todayKey,
    ids: readFocusSelection(todayKey),
  }));

  const [showFocusPicker, setShowFocusPicker] = useState(false);

  const [focusSearch, setFocusSearch] = useState("");

  const selectedFocusIds =
    focusState.dayKey === todayKey
      ? focusState.ids
      : readFocusSelection(todayKey);

  const manualMode = selectedFocusIds !== null;

  const automaticPlan = useMemo(
    () => createDayPlan(tasks, today, null),
    [tasks, today],
  );

  const plan = useMemo(
    () => createDayPlan(tasks, today, selectedFocusIds),
    [tasks, today, selectedFocusIds],
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "completed"),
    [tasks],
  );

  const availableFocusTasks = useMemo(
    () =>
      activeTasks
        .filter((task) =>
          task.title
            .toLocaleLowerCase("bg-BG")
            .includes(focusSearch.trim().toLocaleLowerCase("bg-BG")),
        )
        .sort((a, b) => {
          const aProject =
            projects.find((project) => project.id === a.projectId)?.name ?? "";

          const bProject =
            projects.find((project) => project.id === b.projectId)?.name ?? "";

          return (
            aProject.localeCompare(bProject) || a.title.localeCompare(b.title)
          );
        }),
    [activeTasks, focusSearch, projects],
  );

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const totalDue = plan.today.length + plan.overdue.length;

  function getProject(task: Task) {
    return projects.find((project) => project.id === task.projectId);
  }

  function updateFocus(ids: string[] | null) {
    const nextIds = ids === null ? null : [...new Set(ids)].slice(0, 3);

    setFocusState({
      dayKey: todayKey,
      ids: nextIds,
    });

    saveFocusSelection(todayKey, nextIds);
  }

  function startCustomFocus() {
    if (!manualMode) {
      updateFocus(automaticPlan.focus.map((task) => task.id));
    }

    setShowFocusPicker(true);
  }

  function toggleFocusTask(taskId: string) {
    const current =
      selectedFocusIds ?? automaticPlan.focus.map((task) => task.id);

    if (current.includes(taskId)) {
      updateFocus(current.filter((id) => id !== taskId));

      return;
    }

    if (current.length >= 3) {
      return;
    }

    updateFocus([...current, taskId]);
  }

  function restoreAutomaticFocus() {
    updateFocus(null);
    setShowFocusPicker(false);
    setFocusSearch("");
  }

  function completeTask(task: Task) {
    onStatusChange(task.id, task.status === "completed" ? "todo" : "completed");
  }

  function renderTask(task: Task, showDate = false) {
    const project = getProject(task);

    return (
      <article className="fm-day-task" key={task.id}>
        <button
          type="button"
          className={`fm-day-check ${
            task.status === "completed" ? "completed" : ""
          }`}
          aria-label={
            task.status === "completed"
              ? `Reopen ${task.title}`
              : `Complete ${task.title}`
          }
          onClick={() => completeTask(task)}
        >
          {task.status === "completed" ? "✓" : ""}
        </button>

        <div className="fm-day-task-info">
          <h3 className={task.status === "completed" ? "completed" : ""}>
            {task.title}
          </h3>

          <div className="fm-day-task-meta">
            <span className={`fm-day-priority ${task.priority}`}>
              {task.priority} priority
            </span>

            {project && (
              <span className="fm-day-project">
                <span
                  className="fm-day-project-dot"
                  style={{
                    backgroundColor: project.color,
                  }}
                />
                {project.name}
              </span>
            )}

            {showDate && task.dueDate && (
              <span className="fm-day-date">📅 {formatDate(task.dueDate)}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="fm-day-edit"
          title="Edit task"
          aria-label={`Edit ${task.title}`}
          onClick={() => onEditTask(task)}
        >
          ✏️
        </button>
      </article>
    );
  }

  return (
    <div className="fm-day">
      <header className="fm-day-header">
        <p className="fm-day-eyebrow">YOUR DAILY WORKSPACE</p>

        <h1>My Day ✨</h1>

        <p className="fm-day-date-label">{dateLabel}</p>

        <p className="fm-day-description">Focus on what matters most today.</p>
      </header>

      {/* DAILY OVERVIEW */}

      <section className="fm-day-overview">
        <div className="fm-day-progress-card">
          <div className="fm-day-progress-top">
            <div>
              <p className="fm-day-card-label">DAILY PROGRESS</p>

              <h2>
                {plan.completed.length}
                <span>/{plan.today.length + plan.completed.length}</span>
              </h2>
            </div>

            <div className="fm-day-progress-percent">{plan.progress}%</div>
          </div>

          <div
            className="fm-day-progress-track"
            role="progressbar"
            aria-label="Daily progress"
            aria-valuenow={plan.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="fm-day-progress-fill"
              style={{
                width: `${plan.progress}%`,
              }}
            />
          </div>

          <p className="fm-day-progress-description">
            {plan.progress === 100 && plan.completed.length > 0
              ? "Great work! Today's tasks are complete."
              : "Progress based on tasks due today."}
          </p>
        </div>

        <div className="fm-day-stat-card">
          <span className="fm-day-stat-icon">📅</span>

          <span className="fm-day-stat-label">Due Today</span>

          <strong>{plan.today.length}</strong>
        </div>

        <div className="fm-day-stat-card">
          <span className="fm-day-stat-icon">⚠️</span>

          <span className="fm-day-stat-label">Overdue</span>

          <strong>{plan.overdue.length}</strong>
        </div>
      </section>

      {/* FOCUS TASK SELECTION */}

      <section className="fm-day-panel fm-day-focus-panel">
        <div className="fm-day-panel-heading">
          <div>
            <p className="fm-day-section-eyebrow">YOUR TOP PRIORITIES</p>

            <h2>Focus Tasks 🎯</h2>
          </div>

          <span className="fm-day-count">{plan.focus.length}/3</span>
        </div>

        <p className="fm-day-panel-description">
          {manualMode
            ? "Your personal focus selection for today."
            : "Automatically suggested by priority and deadline."}
        </p>

        <div className="fm-day-focus-actions">
          <button
            type="button"
            className="fm-day-primary-button"
            onClick={() => {
              if (showFocusPicker) {
                setShowFocusPicker(false);
              } else {
                startCustomFocus();
              }
            }}
          >
            {showFocusPicker
              ? "Done Selecting"
              : manualMode
                ? "Edit Focus Tasks"
                : "Customize Focus"}
          </button>

          {manualMode && (
            <button
              type="button"
              className="fm-day-outline-button"
              onClick={restoreAutomaticFocus}
            >
              Use Automatic Focus
            </button>
          )}
        </div>

        {showFocusPicker && (
          <div className="fm-day-focus-picker">
            <div className="fm-day-picker-heading">
              <div>
                <h3>Choose Your Focus</h3>

                <p>Select up to three unfinished tasks.</p>
              </div>

              <span className="fm-day-count">
                {selectedFocusIds?.length ?? 0}/3
              </span>
            </div>

            <input
              className="fm-day-focus-search"
              type="search"
              aria-label="Search focus tasks"
              placeholder="Search tasks..."
              value={focusSearch}
              onChange={(event) => setFocusSearch(event.target.value)}
            />

            <div className="fm-day-picker-list">
              {availableFocusTasks.length === 0 ? (
                <p className="fm-day-empty-text">
                  No matching unfinished tasks.
                </p>
              ) : (
                availableFocusTasks.map((task) => {
                  const selected = selectedFocusIds?.includes(task.id) ?? false;

                  const selectionFull = (selectedFocusIds?.length ?? 0) >= 3;

                  const disabled = !selected && selectionFull;

                  const project = getProject(task);

                  return (
                    <label
                      className={`fm-day-picker-option ${
                        selected ? "selected" : ""
                      }`}
                      key={task.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => toggleFocusTask(task.id)}
                      />

                      <span className="fm-day-picker-task">
                        <strong>{task.title}</strong>

                        <span>
                          {project?.name ?? "No Project"}
                          {" · "}
                          {task.priority} priority
                          {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {plan.focus.length === 0 ? (
          <div className="fm-day-empty">
            <span>🎯</span>

            <h3>
              {manualMode ? "Choose your focus tasks" : "You're all caught up!"}
            </h3>

            <p>
              {manualMode
                ? "Select tasks above to create your daily focus."
                : "No urgent tasks need your attention."}
            </p>
          </div>
        ) : (
          <div className="fm-day-task-list">
            {plan.focus.map((task) => renderTask(task, true))}
          </div>
        )}
      </section>

      {/* NEW: FOCUS TIMER */}

      <FocusTimer tasks={plan.focus} />

      {/* TODAY AND OVERDUE */}

      <div className="fm-day-columns">
        <section className="fm-day-panel">
          <div className="fm-day-panel-heading">
            <h2>Today 📅</h2>

            <span className="fm-day-count">{plan.today.length}</span>
          </div>

          {plan.today.length === 0 ? (
            <div className="fm-day-empty">
              <span>☀️</span>

              <h3>No tasks due today</h3>

              <p>Your schedule is clear for today.</p>
            </div>
          ) : (
            <div className="fm-day-task-list">
              {plan.today.map((task) => renderTask(task))}
            </div>
          )}
        </section>

        <section className="fm-day-panel">
          <div className="fm-day-panel-heading">
            <h2>Overdue ⚠️</h2>

            <span className="fm-day-count">{plan.overdue.length}</span>
          </div>

          {plan.overdue.length === 0 ? (
            <div className="fm-day-empty">
              <span>✅</span>

              <h3>Nothing overdue</h3>

              <p>You're keeping up with your deadlines.</p>
            </div>
          ) : (
            <div className="fm-day-task-list">
              {plan.overdue.map((task) => renderTask(task, true))}
            </div>
          )}
        </section>
      </div>

      {/* COMPLETED TODAY */}

      <section className="fm-day-panel">
        <div className="fm-day-panel-heading">
          <h2>Completed Today ✅</h2>

          <span className="fm-day-count">{plan.completed.length}</span>
        </div>

        {plan.completed.length === 0 ? (
          <p className="fm-day-empty-text">
            Completed tasks with today's deadline will appear here.
          </p>
        ) : (
          <div className="fm-day-task-list">
            {plan.completed.map((task) => renderTask(task))}
          </div>
        )}
      </section>

      <div className="fm-day-footer">
        <span>{totalDue} active task(s) due today or earlier</span>

        <button
          type="button"
          className="fm-day-primary-button"
          onClick={onOpenTasks}
        >
          View All Tasks
        </button>
      </div>
    </div>
  );
}

export default MyDay;
