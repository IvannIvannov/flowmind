import { useMemo } from "react";

import type { Project, Task, TaskStatus } from "../../types";

import { createDayPlan } from "../../utils/dayPlanner";

import { formatDate } from "../../utils/dates";

import "./MyDay.css";

interface MyDayProps {
  tasks: Task[];
  projects: Project[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onOpenTasks: () => void;
}

function MyDay({
  tasks,
  projects,
  onStatusChange,
  onEditTask,
  onOpenTasks,
}: MyDayProps) {
  const plan = useMemo(() => createDayPlan(tasks), [tasks]);

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const totalDue = plan.today.length + plan.overdue.length;

  function getProject(task: Task) {
    return projects.find((project) => project.id === task.projectId);
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
          aria-label={`Complete ${task.title}`}
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
              : "Every completed task brings you closer to your goals."}
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

      <section className="fm-day-panel fm-day-focus-panel">
        <div className="fm-day-panel-heading">
          <div>
            <p className="fm-day-section-eyebrow">YOUR TOP PRIORITIES</p>

            <h2>Focus Tasks 🎯</h2>
          </div>

          <span className="fm-day-count">{plan.focus.length}/3</span>
        </div>

        <p className="fm-day-panel-description">
          Your three most important tasks, selected by priority and deadline.
        </p>

        {plan.focus.length === 0 ? (
          <div className="fm-day-empty">
            <span>🎉</span>
            <h3>You're all caught up!</h3>
            <p>No urgent tasks need your attention.</p>
          </div>
        ) : (
          <div className="fm-day-task-list">
            {plan.focus.map((task) => renderTask(task, true))}
          </div>
        )}
      </section>

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

      <section className="fm-day-panel">
        <div className="fm-day-panel-heading">
          <h2>Completed Today ✅</h2>

          <span className="fm-day-count">{plan.completed.length}</span>
        </div>

        {plan.completed.length === 0 ? (
          <p className="fm-day-empty-text">
            Tasks with today's deadline will appear here when you complete them.
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
