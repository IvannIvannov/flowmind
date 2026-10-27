import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Calendar from "./components/Calendar/Calendar";
import Dashboard from "./components/Dashboard/Dashboard";
import Sidebar from "./components/Sidebar/Sidebar";
import type { Page } from "./components/Sidebar/Sidebar";
import "./App.css";

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
  } catch (error) {
    console.error(`Unable to read ${key}`, error);
    return [];
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.createdAt === "string" &&
    ["low", "medium", "high"].includes(task.priority ?? "") &&
    ["todo", "in-progress", "completed"].includes(task.status ?? "")
  );
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;

  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    typeof project.description === "string" &&
    typeof project.color === "string" &&
    typeof project.createdAt === "string"
  );
}

function todayString(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formattedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
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
  const [editingTask, setEditingTask] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");

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

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const matchesSearch = task.title
          .toLowerCase()
          .includes(search.toLowerCase().trim());

        const matchesStatus =
          statusFilter === "all" || task.status === statusFilter;

        const matchesProject =
          projectFilter === "all" ||
          (projectFilter === "none"
            ? !task.projectId ||
              !projects.some((project) => project.id === task.projectId)
            : task.projectId === projectFilter);

        return matchesSearch && matchesStatus && matchesProject;
      })
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

    const name = title.trim();
    if (!name) return;

    const projectId = projects.some((project) => project.id === selectedProject)
      ? selectedProject
      : undefined;

    if (editingTask) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === editingTask
            ? {
                ...task,
                title: name,
                priority,
                dueDate: dueDate || undefined,
                projectId,
              }
            : task,
        ),
      );
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        title: name,
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
    setSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
    setPage("tasks");
  }

  function changeStatus(id: string, status: Status) {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    setTasks((previous) => previous.filter((item) => item.id !== task.id));

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

    const name = projectName.trim();
    if (!name) return;

    const duplicate = projects.some(
      (project) =>
        project.name.trim().toLowerCase() === name.toLowerCase() &&
        project.id !== editingProject,
    );

    if (duplicate) {
      window.alert("A project with this name already exists.");
      return;
    }

    if (editingProject) {
      setProjects((previous) =>
        previous.map((project) =>
          project.id === editingProject
            ? {
                ...project,
                name,
                description: projectDescription.trim(),
                color: projectColor,
              }
            : project,
        ),
      );
    } else {
      const project: Project = {
        id: crypto.randomUUID(),
        name,
        description: projectDescription.trim(),
        color: projectColor,
        createdAt: new Date().toISOString(),
      };

      setProjects((previous) => [...previous, project]);
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
    const count = tasks.filter((task) => task.projectId === project.id).length;

    if (
      !window.confirm(
        `Delete "${project.name}"?\n\n` +
          `${count} task(s) will become unassigned. ` +
          "The tasks themselves will NOT be deleted.",
      )
    )
      return;

    setProjects((previous) =>
      previous.filter((item) => item.id !== project.id),
    );

    setTasks((previous) =>
      previous.map((task) =>
        task.projectId === project.id
          ? { ...task, projectId: undefined }
          : task,
      ),
    );

    if (projectFilter === project.id) setProjectFilter("all");
    if (selectedProject === project.id) setSelectedProject("");
    if (editingProject === project.id) resetProjectForm();
  }

  function projectForTask(task: Task) {
    return projects.find((project) => project.id === task.projectId);
  }

  function deadlineLabel(task: Task): string {
    if (!task.dueDate) return "";

    if (task.status !== "completed") {
      if (task.dueDate < today) {
        return `Overdue: ${formattedDate(task.dueDate)}`;
      }

      if (task.dueDate === today) return "Due today";
    }

    return `Due: ${formattedDate(task.dueDate)}`;
  }

  function deadlineClass(task: Task): string {
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

  function addTaskFromCalendar(date: string) {
    resetTaskForm();
    setDueDate(date);
    setSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
    setPage("tasks");
  }

  function openTaskFromCalendar(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (task) startEditTask(task);
  }

  return (
    <div className="app">
      <Sidebar currentPage={page} onNavigate={setPage} />

      <main className="content">
        {page === "dashboard" && (
          <Dashboard
            tasks={tasks}
            projects={projects}
            onOpenTasks={() => setPage("tasks")}
            onOpenProjects={() => setPage("projects")}
          />
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
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
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
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="task-project">Project</label>

                  <select
                    id="task-project"
                    value={selectedProject}
                    onChange={(event) => setSelectedProject(event.target.value)}
                  >
                    <option value="">No Project</option>

                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
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
                  {tasks.filter((t) => t.status === "completed").length} of{" "}
                  {tasks.length} completed
                </span>
              </div>

              <div className="task-toolbar">
                <input
                  type="search"
                  aria-label="Search tasks"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  aria-label="Filter by project"
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                >
                  <option value="all">All Projects</option>
                  <option value="none">No Project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Sort tasks"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
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
                                  style={{
                                    backgroundColor: project.color,
                                  }}
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
                            onChange={(event) =>
                              changeStatus(
                                task.id,
                                event.target.value as Status,
                              )
                            }
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>

                          <button
                            type="button"
                            className="icon-button edit-button"
                            title="Edit task"
                            aria-label={`Edit ${task.title}`}
                            onClick={() => startEditTask(task)}
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
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
                    onChange={(event) => setProjectName(event.target.value)}
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
                    onChange={(event) =>
                      setProjectDescription(event.target.value)
                    }
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
                    (task) => task.projectId === project.id,
                  );

                  const done = projectTasks.filter(
                    (task) => task.status === "completed",
                  ).length;

                  const percent = projectTasks.length
                    ? Math.round((done / projectTasks.length) * 100)
                    : 0;

                  return (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-top">
                        <span
                          className="project-dot"
                          style={{
                            backgroundColor: project.color,
                          }}
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
                          type="button"
                          className="secondary-button"
                          onClick={() => openProjectTasks(project.id)}
                        >
                          View Tasks
                        </button>

                        <button
                          type="button"
                          className="icon-button edit-button"
                          title="Edit project"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => startEditProject(project)}
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
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

        {page === "calendar" && (
          <Calendar
            tasks={tasks}
            projects={projects}
            onAddTask={addTaskFromCalendar}
            onOpenTask={openTaskFromCalendar}
          />
        )}
      </main>
    </div>
  );
}

export default App;
