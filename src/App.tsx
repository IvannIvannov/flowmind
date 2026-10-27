import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type Page = "dashboard" | "tasks" | "projects";
type Priority = "low" | "medium" | "high";
type Status = "todo" | "in-progress" | "completed";
type Sort = "newest" | "oldest" | "priority" | "due-date";

interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  dueDate?: string;
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

const TASKS_KEY = "flowmind-tasks";
const PROJECTS_KEY = "flowmind-projects";

const COLORS = [
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#f472b6",
];

const PRIORITY_VALUE: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function readStoredArray<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T[] {
  try {
    const text = localStorage.getItem(key);
    if (!text) return [];
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data.filter(validate) : [];
  } catch {
    console.error(`Unable to read ${key}`);
    return [];
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<Task>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.createdAt === "string" &&
    ["low", "medium", "high"].includes(t.priority ?? "") &&
    ["todo", "in-progress", "completed"].includes(t.status ?? "")
  );
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Project>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.description === "string" &&
    typeof p.color === "string" &&
    typeof p.createdAt === "string"
  );
}

function todayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formattedDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const [tasks, setTasks] = useState<Task[]>(() =>
    readStoredArray(TASKS_KEY, isTask),
  );

  const [projects, setProjects] = useState<Project[]>(() =>
    readStoredArray(PROJECTS_KEY, isProject),
  );

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");

  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState(COLORS[0]);

  const today = todayString();

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks", error);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error("Could not save projects", error);
    }
  }, [projects]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      dueToday: tasks.filter(
        (t) => t.status !== "completed" && t.dueDate === today,
      ).length,
      overdue: tasks.filter(
        (t) => t.status !== "completed" && t.dueDate && t.dueDate < today,
      ).length,
    }),
    [tasks, today],
  );

  const visibleTasks = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase().trim()) &&
          (statusFilter === "all" || t.status === statusFilter) &&
          (projectFilter === "all" ||
            (projectFilter === "none"
              ? !t.projectId || !projects.some((p) => p.id === t.projectId)
              : t.projectId === projectFilter)),
      )
      .sort((a, b) => {
        if (sort === "priority") {
          const diff = PRIORITY_VALUE[b.priority] - PRIORITY_VALUE[a.priority];
          if (diff) return diff;
        }
        if (sort === "due-date") {
          return (a.dueDate || "9999-12-31").localeCompare(
            b.dueDate || "9999-12-31",
          );
        }
        if (sort === "oldest") {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tasks, projects, search, statusFilter, projectFilter, sort]);

  function resetTaskForm() {
    setTitle("");
    setPriority("medium");
    setDueDate("");
    setSelectedProject("");
    setEditingTask(null);
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    const projectId = projects.some((p) => p.id === selectedProject)
      ? selectedProject
      : undefined;

    if (editingTask) {
      setTasks((previous) =>
        previous.map((t) =>
          t.id === editingTask
            ? {
                ...t,
                title: title.trim(),
                priority,
                dueDate: dueDate || undefined,
                projectId,
              }
            : t,
        ),
      );
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        title: title.trim(),
        priority,
        status: "todo",
        dueDate: dueDate || undefined,
        projectId,
        createdAt: new Date().toISOString(),
      };
      setTasks((previous) => [task, ...previous]);
    }

    resetTaskForm();
  }

  function startEditTask(task: Task) {
    setEditingTask(task.id);
    setTitle(task.title);
    setPriority(task.priority);
    setDueDate(task.dueDate || "");
    setSelectedProject(task.projectId || "");
    setPage("tasks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeStatus(id: string, status: Status) {
    setTasks((previous) =>
      previous.map((t) => (t.id === id ? { ...t, status } : t)),
    );
  }

  function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setTasks((previous) => previous.filter((t) => t.id !== task.id));
    if (editingTask === task.id) resetTaskForm();
  }

  function resetProjectForm() {
    setProjectName("");
    setProjectDescription("");
    setProjectColor(COLORS[0]);
    setEditingProject(null);
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim()) return;

    const duplicate = projects.some(
      (p) =>
        p.name.trim().toLowerCase() === projectName.trim().toLowerCase() &&
        p.id !== editingProject,
    );

    if (duplicate) {
      window.alert("A project with this name already exists.");
      return;
    }

    if (editingProject) {
      setProjects((previous) =>
        previous.map((p) =>
          p.id === editingProject
            ? {
                ...p,
                name: projectName.trim(),
                description: projectDescription.trim(),
                color: projectColor,
              }
            : p,
        ),
      );
    } else {
      setProjects((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          name: projectName.trim(),
          description: projectDescription.trim(),
          color: projectColor,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    resetProjectForm();
  }

  function startEditProject(project: Project) {
    setEditingProject(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description);
    setProjectColor(project.color);
  }

  function deleteProject(project: Project) {
    const count = tasks.filter((t) => t.projectId === project.id).length;

    const confirmed = window.confirm(
      `Delete "${project.name}"?\n\n` +
        `${count} task(s) will become unassigned. ` +
        "The tasks themselves will NOT be deleted.",
    );

    if (!confirmed) return;

    setProjects((previous) => previous.filter((p) => p.id !== project.id));
    setTasks((previous) =>
      previous.map((t) =>
        t.projectId === project.id ? { ...t, projectId: undefined } : t,
      ),
    );

    if (projectFilter === project.id) setProjectFilter("all");
    if (selectedProject === project.id) setSelectedProject("");
    if (editingProject === project.id) resetProjectForm();
  }

  function projectForTask(task: Task) {
    return projects.find((p) => p.id === task.projectId);
  }

  function deadlineLabel(task: Task) {
    if (!task.dueDate) return "";

    if (task.status !== "completed") {
      if (task.dueDate < today) {
        return `Overdue: ${formattedDate(task.dueDate)}`;
      }
      if (task.dueDate === today) return "Due today";
    }
    return `Due: ${formattedDate(task.dueDate)}`;
  }

  function deadlineClass(task: Task) {
    if (!task.dueDate || task.status === "completed") return "";
    if (task.dueDate < today) return "overdue";
    if (task.dueDate === today) return "today";
    return "upcoming";
  }

  function openProjectTasks(id: string) {
    setProjectFilter(id);
    setStatusFilter("all");
    setSearch("");
    setPage("tasks");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">✦ FlowMind</h2>

        <nav className="navigation">
          <button
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => setPage("dashboard")}
          >
            🏠 Dashboard
          </button>
          <button
            className={`nav-item ${page === "tasks" ? "active" : ""}`}
            onClick={() => setPage("tasks")}
          >
            ✅ My Tasks
          </button>
          <button
            className={`nav-item ${page === "projects" ? "active" : ""}`}
            onClick={() => setPage("projects")}
          >
            📁 Projects
          </button>
          <button className="nav-item" disabled>
            📅 Calendar
          </button>
          <button className="nav-item" disabled>
            🧠 AI Assistant
          </button>
          <button className="nav-item" disabled>
            ⚙️ Settings
          </button>
        </nav>

        <div className="sidebar-footer">FlowMind v0.4.0</div>
      </aside>

      <main className="content">
        {page === "dashboard" && (
          <>
            <header className="page-header">
              <p className="subtitle">YOUR PERSONAL WORKSPACE</p>
              <h1>Welcome to FlowMind 👋</h1>
              <p className="description">
                Organize your tasks, projects and ideas in one place.
              </p>
            </header>

            <section className="welcome-card">
              <div className="card-icon">✨</div>
              <h2>Your workspace is ready!</h2>
              <p>Stay organized and focus on what matters most.</p>
              <button
                className="primary-button"
                onClick={() => setPage("tasks")}
              >
                Manage Tasks →
              </button>
            </section>

            <section className="stats-grid">
              {[
                ["Total Tasks", stats.total, "All your tasks"],
                ["In Progress", stats.inProgress, "Active work"],
                ["Completed", stats.completed, "Finished tasks"],
                ["Due Today", stats.dueToday, "Need attention today"],
                ["Overdue", stats.overdue, "Past their deadline"],
                ["Projects", projects.length, "Your workspaces"],
              ].map(([label, value, description]) => (
                <div className="stat-card" key={label}>
                  <p>{label}</p>
                  <h2
                    className={
                      label === "Overdue" && stats.overdue > 0
                        ? "danger-text"
                        : ""
                    }
                  >
                    {value}
                  </h2>
                  <span>{description}</span>
                </div>
              ))}
            </section>

            {projects.length > 0 && (
              <section className="dashboard-projects">
                <div className="section-heading">
                  <h2>Your Projects</h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("projects")}
                  >
                    View all →
                  </button>
                </div>
                <div className="project-grid">
                  {projects.slice(0, 3).map((project) => {
                    const items = tasks.filter(
                      (t) => t.projectId === project.id,
                    );
                    const done = items.filter(
                      (t) => t.status === "completed",
                    ).length;
                    const percent = items.length
                      ? Math.round((done / items.length) * 100)
                      : 0;

                    return (
                      <div className="project-card" key={project.id}>
                        <div className="project-card-top">
                          <span
                            className="project-dot"
                            style={{ backgroundColor: project.color }}
                          />
                          <h3>{project.name}</h3>
                        </div>
                        <p>
                          {items.length} tasks · {percent}% complete
                        </p>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: project.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {page === "tasks" && (
          <>
            <header className="page-header">
              <p className="subtitle">STAY ORGANIZED</p>
              <h1>My Tasks ✅</h1>
              <p className="description">
                Manage tasks, projects, priorities and deadlines.
              </p>
            </header>

            <section className="task-panel">
              <h2>{editingTask ? "Edit Task" : "Create New Task"}</h2>

              <form className="task-form" onSubmit={submitTask}>
                <div className="form-field title-field">
                  <label htmlFor="task-title">Task Name</label>
                  <input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What do you need to do?"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="task-priority">Priority</label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="task-date">Due Date</label>
                  <input
                    id="task-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="task-project">Project</label>
                  <select
                    id="task-project"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">No Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    {editingTask ? "Save Changes" : "+ Add Task"}
                  </button>
                  {editingTask && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetTaskForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="task-panel">
              <div className="section-heading">
                <h2>Your Tasks ({visibleTasks.length})</h2>
                <span className="muted">
                  {stats.completed} of {stats.total} completed
                </span>
              </div>

              <div className="task-toolbar">
                <input
                  type="search"
                  aria-label="Search tasks"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  aria-label="Filter by project"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="all">All Projects</option>
                  <option value="none">No Project</option>
                  {projects.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Sort tasks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="priority">Highest Priority</option>
                  <option value="due-date">Nearest Deadline</option>
                </select>
              </div>

              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <div>📋</div>
                  <h3>No matching tasks</h3>
                  <p>Create a task or change your filters.</p>
                </div>
              ) : (
                <div className="task-list">
                  {visibleTasks.map((task) => {
                    const project = projectForTask(task);

                    return (
                      <div className="task-item" key={task.id}>
                        <div className="task-info">
                          <h3
                            className={
                              task.status === "completed"
                                ? "completed-task"
                                : ""
                            }
                          >
                            {task.title}
                          </h3>

                          <div className="task-meta">
                            <span
                              className={`priority priority-${task.priority}`}
                            >
                              {task.priority} priority
                            </span>

                            {task.dueDate && (
                              <span
                                className={`deadline ${deadlineClass(task)}`}
                              >
                                📅 {deadlineLabel(task)}
                              </span>
                            )}

                            {project && (
                              <span className="project-tag">
                                <span
                                  className="project-dot"
                                  style={{ backgroundColor: project.color }}
                                />
                                {project.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="task-actions">
                          <select
                            aria-label={`Status for ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              changeStatus(task.id, e.target.value as Status)
                            }
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>

                          <button
                            className="icon-button edit-button"
                            title="Edit task"
                            aria-label={`Edit ${task.title}`}
                            onClick={() => startEditTask(task)}
                          >
                            ✏️
                          </button>

                          <button
                            className="icon-button delete-button"
                            title="Delete task"
                            aria-label={`Delete ${task.title}`}
                            onClick={() => deleteTask(task)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {page === "projects" && (
          <>
            <header className="page-header">
              <p className="subtitle">ORGANIZE YOUR WORK</p>
              <h1>Projects 📁</h1>
              <p className="description">
                Group related tasks and track your progress.
              </p>
            </header>

            <section className="task-panel">
              <h2>{editingProject ? "Edit Project" : "Create New Project"}</h2>

              <form className="project-form" onSubmit={submitProject}>
                <div className="form-field">
                  <label htmlFor="project-name">Project Name</label>
                  <input
                    id="project-name"
                    placeholder="e.g. University"
                    value={projectName}
                    maxLength={80}
                    required
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="project-description">
                    Description (Optional)
                  </label>
                  <textarea
                    id="project-description"
                    placeholder="What's this project about?"
                    value={projectDescription}
                    maxLength={300}
                    rows={3}
                    onChange={(e) => setProjectDescription(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Project Color</label>
                  <div className="color-picker">
                    {COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        aria-label={`Choose color ${color}`}
                        aria-pressed={projectColor === color}
                        className={`color-choice ${
                          projectColor === color ? "selected" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setProjectColor(color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {editingProject ? "Save Project" : "+ Create Project"}
                  </button>

                  {editingProject && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetProjectForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <div className="section-heading projects-title">
              <h2>Your Projects ({projects.length})</h2>
            </div>

            {projects.length === 0 ? (
              <div className="task-panel empty-state">
                <div>📁</div>
                <h3>No projects yet</h3>
                <p>Create your first project above.</p>
              </div>
            ) : (
              <div className="project-grid">
                {projects.map((project) => {
                  const projectTasks = tasks.filter(
                    (t) => t.projectId === project.id,
                  );
                  const done = projectTasks.filter(
                    (t) => t.status === "completed",
                  ).length;
                  const percent = projectTasks.length
                    ? Math.round((done / projectTasks.length) * 100)
                    : 0;

                  return (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-top">
                        <span
                          className="project-dot"
                          style={{ backgroundColor: project.color }}
                        />
                        <h3>{project.name}</h3>
                      </div>

                      <p className="project-description">
                        {project.description || "No description"}
                      </p>

                      <div className="project-progress-label">
                        <span>
                          {done}/{projectTasks.length} tasks completed
                        </span>
                        <strong>{percent}%</strong>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>

                      <div className="project-actions">
                        <button
                          className="secondary-button"
                          onClick={() => openProjectTasks(project.id)}
                        >
                          View Tasks
                        </button>
                        <button
                          className="icon-button edit-button"
                          title="Edit project"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => startEditProject(project)}
                        >
                          ✏️
                        </button>
                        <button
                          className="icon-button delete-button"
                          title="Delete project"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => deleteProject(project)}
                        >
                          🗑️
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
