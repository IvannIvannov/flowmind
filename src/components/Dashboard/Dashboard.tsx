import "./Dashboard.css";

export interface DashboardTask {
  id: string;
  status: "todo" | "in-progress" | "completed";
  projectId?: string;
  dueDate?: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  color: string;
}

interface DashboardProps {
  tasks: DashboardTask[];
  projects: DashboardProject[];
  onOpenTasks: () => void;
  onOpenProjects: () => void;
}

function getLocalDate(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function Dashboard({
  tasks,
  projects,
  onOpenTasks,
  onOpenProjects,
}: DashboardProps) {
  const today = getLocalDate();

  const total = tasks.length;

  const inProgress = tasks.filter(
    (task) => task.status === "in-progress",
  ).length;

  const completed = tasks.filter((task) => task.status === "completed").length;

  const dueToday = tasks.filter(
    (task) => task.status !== "completed" && task.dueDate === today,
  ).length;

  const overdue = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      Boolean(task.dueDate) &&
      task.dueDate! < today,
  ).length;

  const stats = [
    {
      id: "total",
      title: "Total Tasks",
      value: total,
      description: "All your tasks",
    },
    {
      id: "in-progress",
      title: "In Progress",
      value: inProgress,
      description: "Active work",
    },
    {
      id: "completed",
      title: "Completed",
      value: completed,
      description: "Finished tasks",
    },
    {
      id: "today",
      title: "Due Today",
      value: dueToday,
      description: "Need attention today",
    },
    {
      id: "overdue",
      title: "Overdue",
      value: overdue,
      description: "Past their deadline",
    },
    {
      id: "projects",
      title: "Projects",
      value: projects.length,
      description: "Your workspaces",
    },
  ];

  return (
    <div className="fm-dashboard">
      <header className="fm-dashboard-header">
        <p className="fm-dashboard-subtitle">YOUR PERSONAL WORKSPACE</p>

        <h1>Welcome to FlowMind 👋</h1>

        <p className="fm-dashboard-description">
          Organize your tasks, projects and ideas in one place.
        </p>
      </header>

      <section className="fm-dashboard-welcome">
        <div className="fm-dashboard-welcome-icon">✨</div>

        <h2>Your workspace is ready!</h2>

        <p>Stay organized and focus on what matters most.</p>

        <button
          type="button"
          className="fm-dashboard-primary-button"
          onClick={onOpenTasks}
        >
          Manage Tasks →
        </button>
      </section>

      <section className="fm-dashboard-stats" aria-label="Task statistics">
        {stats.map((stat) => (
          <div className="fm-dashboard-stat-card" key={stat.id}>
            <p>{stat.title}</p>

            <h2
              className={
                stat.id === "overdue" && stat.value > 0
                  ? "fm-dashboard-danger"
                  : ""
              }
            >
              {stat.value}
            </h2>

            <span>{stat.description}</span>
          </div>
        ))}
      </section>

      {projects.length > 0 && (
        <section className="fm-dashboard-projects">
          <div className="fm-dashboard-section-heading">
            <h2>Your Projects</h2>

            <button
              type="button"
              className="fm-dashboard-text-button"
              onClick={onOpenProjects}
            >
              View all →
            </button>
          </div>

          <div className="fm-dashboard-project-grid">
            {projects.slice(0, 3).map((project) => {
              const projectTasks = tasks.filter(
                (task) => task.projectId === project.id,
              );

              const projectCompleted = projectTasks.filter(
                (task) => task.status === "completed",
              ).length;

              const progress = projectTasks.length
                ? Math.round((projectCompleted / projectTasks.length) * 100)
                : 0;

              return (
                <article className="fm-dashboard-project-card" key={project.id}>
                  <div className="fm-dashboard-project-title">
                    <span
                      className="fm-dashboard-project-dot"
                      style={{
                        backgroundColor: project.color,
                      }}
                    />

                    <h3>{project.name}</h3>
                  </div>

                  <p>
                    {projectTasks.length} tasks · {progress}% complete
                  </p>

                  <div
                    className="fm-dashboard-progress-track"
                    role="progressbar"
                    aria-label={`${project.name} progress`}
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="fm-dashboard-progress-fill"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: project.color,
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
