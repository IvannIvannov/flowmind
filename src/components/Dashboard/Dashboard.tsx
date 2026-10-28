import type { Task, Project, DashboardStats } from "../../types";

import { getTodayKey, isOverdue } from "../../utils/dates";

import "./Dashboard.css";

interface DashboardProps {
  tasks: Task[];
  projects: Project[];
  onOpenTasks: () => void;
  onOpenProjects: () => void;
}

const PRIORITY_ORDER = {
  high: 3,
  medium: 2,
  low: 1,
};

function formatToday(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard({
  tasks,
  projects,
  onOpenTasks,
  onOpenProjects,
}: DashboardProps) {
  const today = getTodayKey();

  const stats: DashboardStats = {
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    dueToday: tasks.filter(
      (task) => task.status !== "completed" && task.dueDate === today,
    ).length,
    overdue: tasks.filter((task) =>
      isOverdue(task.dueDate, task.status === "completed"),
    ).length,
    projects: projects.length,
  };

  const openTasks = tasks.filter((task) => task.status !== "completed").length;

  const statisticItems = [
    {
      id: "all",
      title: "All tasks",
      value: stats.total,
    },
    {
      id: "progress",
      title: "In progress",
      value: stats.inProgress,
    },
    {
      id: "completed",
      title: "Completed",
      value: stats.completed,
    },
    {
      id: "today",
      title: "Due today",
      value: stats.dueToday,
    },
    {
      id: "overdue",
      title: "Overdue",
      value: stats.overdue,
    },
    {
      id: "projects",
      title: "Projects",
      value: stats.projects,
    },
  ];

  const priorityTasks = [...tasks]
    .filter((task) => task.status !== "completed")
    .sort((a, b) => {
      const aOverdue = isOverdue(a.dueDate, false);

      const bOverdue = isOverdue(b.dueDate, false);

      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }

      const aToday = a.dueDate === today;
      const bToday = b.dueDate === today;

      if (aToday !== bToday) {
        return aToday ? -1 : 1;
      }

      const priorityDifference =
        PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (a.dueDate || "9999-12-31").localeCompare(
        b.dueDate || "9999-12-31",
      );
    })
    .slice(0, 5);

  function projectName(id?: string): string {
    return projects.find((project) => project.id === id)?.name ?? "Personal";
  }

  function taskDateLabel(task: Task): string {
    if (!task.dueDate) {
      return "No due date";
    }

    if (isOverdue(task.dueDate, false)) {
      return "Overdue";
    }

    if (task.dueDate === today) {
      return "Today";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${task.dueDate}T12:00:00`));
  }

  return (
    <div className="fm-dashboard">
      <header className="fm-dashboard-header">
        <div>
          <p className="fm-dashboard-subtitle">{formatToday()}</p>

          <h1>
            {greeting()}
            <span className="fm-dash-heading-period">.</span>
          </h1>

          <p className="fm-dashboard-description">
            A clearer mind. A more productive day.
          </p>
        </div>

        <button
          type="button"
          className="fm-dashboard-header-action"
          onClick={onOpenTasks}
        >
          <span aria-hidden="true">+</span>
          New task
        </button>
      </header>

      <section className="fm-dashboard-overview">
        <div className="fm-dashboard-overview-copy">
          <span className="fm-dashboard-overview-label">
            YOUR WORKSPACE AT A GLANCE
          </span>

          <h2>
            Make space for what
            <br />
            matters most.
          </h2>

          <p>
            Everything you're working on, beautifully organized in one place.
          </p>

          <button
            type="button"
            className="fm-dashboard-overview-button"
            onClick={onOpenTasks}
          >
            Explore your tasks
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="fm-dashboard-summary-panel">
          <div className="fm-dashboard-summary-top">
            <span>Today&apos;s snapshot</span>

            <span className="fm-dashboard-summary-badge" aria-hidden="true">
              ●
            </span>
          </div>

          <div className="fm-dashboard-summary-main">
            <strong>{stats.completed}</strong>

            <div className="fm-dashboard-summary-main-text">
              <span>tasks completed</span>
              <p>
                {stats.completed} of {stats.total} finished
              </p>
            </div>
          </div>

          <div className="fm-dashboard-summary-list">
            <div className="fm-dashboard-summary-item">
              <span>Open tasks</span>
              <strong>{openTasks}</strong>
            </div>

            <div className="fm-dashboard-summary-item">
              <span>Due today</span>
              <strong>{stats.dueToday}</strong>
            </div>

            <div className="fm-dashboard-summary-item">
              <span>Overdue</span>
              <strong>{stats.overdue}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="fm-dashboard-stats" aria-label="Workspace statistics">
        <div className="fm-dashboard-stats-heading">
          <h2>Workspace overview</h2>
          <span>All time</span>
        </div>

        <div className="fm-dashboard-stats-row">
          {statisticItems.map((stat) => (
            <div className="fm-dashboard-stat-item" key={stat.id}>
              <span className="fm-dashboard-stat-label">{stat.title}</span>

              <strong className="fm-dashboard-stat-value">{stat.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="fm-dashboard-bottom-grid">
        <section className="fm-dashboard-task-panel">
          <div className="fm-dashboard-section-heading">
            <div>
              <span className="fm-dashboard-section-kicker">STAY ON TRACK</span>

              <h2>Up next</h2>
            </div>

            <button
              type="button"
              className="fm-dashboard-text-button"
              onClick={onOpenTasks}
            >
              View tasks
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          {priorityTasks.length === 0 ? (
            <div className="fm-dashboard-empty">
              <span className="fm-dashboard-empty-icon">✓</span>

              <h3>All caught up</h3>

              <p>Your next priorities will appear here.</p>
            </div>
          ) : (
            <div className="fm-dashboard-task-list">
              {priorityTasks.map((task) => (
                <div className="fm-dashboard-task-row" key={task.id}>
                  <span className="fm-dash-task-check" aria-hidden="true" />

                  <div className="fm-dashboard-task-info">
                    <strong>{task.title}</strong>
                    <span>{projectName(task.projectId)}</span>
                  </div>

                  <span
                    className={`fm-dashboard-task-date ${
                      isOverdue(task.dueDate, false) ? "is-overdue" : ""
                    }`}
                  >
                    {taskDateLabel(task)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fm-dashboard-projects">
          <div className="fm-dashboard-section-heading">
            <div>
              <span className="fm-dashboard-section-kicker">
                IN YOUR WORKSPACE
              </span>

              <h2>Projects</h2>
            </div>

            <button
              type="button"
              className="fm-dashboard-text-button"
              onClick={onOpenProjects}
            >
              View all
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="fm-dashboard-empty">
              <span className="fm-dashboard-empty-icon">+</span>

              <h3>No projects yet</h3>
              <p>Create a project to organize your work.</p>
            </div>
          ) : (
            <div className="fm-dashboard-project-list">
              {projects.slice(0, 4).map((project) => {
                const projectTasks = tasks.filter(
                  (task) => task.projectId === project.id,
                );

                const projectCompleted = projectTasks.filter(
                  (task) => task.status === "completed",
                ).length;

                const progress =
                  projectTasks.length > 0
                    ? Math.round((projectCompleted / projectTasks.length) * 100)
                    : 0;

                return (
                  <article
                    className="fm-dashboard-project-card"
                    key={project.id}
                  >
                    <div className="fm-dashboard-project-title">
                      <span
                        className="fm-dashboard-project-mark"
                        aria-hidden="true"
                      >
                        {project.name.trim().charAt(0).toUpperCase() || "P"}
                      </span>

                      <div>
                        <h3>{project.name}</h3>
                        <p>{projectTasks.length} tasks</p>
                      </div>

                      <strong>{progress}%</strong>
                    </div>

                    <div
                      className="fm-dashboard-project-track"
                      role="progressbar"
                      aria-label={`${project.name} progress`}
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="fm-dashboard-project-fill"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
