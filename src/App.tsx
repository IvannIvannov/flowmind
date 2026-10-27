import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import Calendar from "./components/Calendar/Calendar";
import Dashboard from "./components/Dashboard/Dashboard";
import Sidebar from "./components/Sidebar/Sidebar";
import Tasks from "./components/Tasks/Tasks";

import type { Page } from "./components/Sidebar/Sidebar";
import type {
  Priority,
  Task,
  TaskStatus,
  TaskFormState,
  TaskFilters,
} from "./components/Tasks/Tasks";

import "./App.css";

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

const INITIAL_TASK_FORM: TaskFormState = {
  title: "",
  priority: "medium",
  dueDate: "",
  projectId: "",
  editingId: null,
};

const INITIAL_FILTERS: TaskFilters = {
  search: "",
  status: "all",
  project: "all",
  sort: "newest",
};

function readStoredArray<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T[] {
  try {
    const text = localStorage.getItem(key);

    if (!text) return [];

    const parsed: unknown = JSON.parse(text);

    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch (error) {
    console.error(`Unable to read ${key}`, error);
    return [];
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

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
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as Partial<Project>;

  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    typeof project.description === "string" &&
    typeof project.color === "string" &&
    typeof project.createdAt === "string"
  );
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const [tasks, setTasks] = useState<Task[]>(() =>
    readStoredArray(TASKS_KEY, isTask),
  );

  const [projects, setProjects] = useState<Project[]>(() =>
    readStoredArray(PROJECTS_KEY, isProject),
  );

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);

  const [taskFilters, setTaskFilters] = useState<TaskFilters>(INITIAL_FILTERS);

  const [editingProject, setEditingProject] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState(COLORS[0]);

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
    const { search, status, project, sort } = taskFilters;

    return tasks
      .filter((task) => {
        const matchesSearch = task.title
          .toLowerCase()
          .includes(search.toLowerCase().trim());

        const matchesStatus = status === "all" || task.status === status;

        const matchesProject =
          project === "all" ||
          (project === "none"
            ? !task.projectId ||
              !projects.some((item) => item.id === task.projectId)
            : task.projectId === project);

        return matchesSearch && matchesStatus && matchesProject;
      })
      .sort((a, b) => {
        if (sort === "priority") {
          const difference =
            PRIORITY_VALUE[b.priority] - PRIORITY_VALUE[a.priority];

          if (difference !== 0) {
            return difference;
          }
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
  }, [tasks, projects, taskFilters]);

  function updateTaskForm(changes: Partial<TaskFormState>) {
    setTaskForm((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function updateTaskFilters(changes: Partial<TaskFilters>) {
    setTaskFilters((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function resetTaskForm() {
    setTaskForm({ ...INITIAL_TASK_FORM });
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = taskForm.title.trim();

    if (!name) return;

    const projectId = projects.some(
      (project) => project.id === taskForm.projectId,
    )
      ? taskForm.projectId
      : undefined;

    if (taskForm.editingId) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskForm.editingId
            ? {
                ...task,
                title: name,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate || undefined,
                projectId,
              }
            : task,
        ),
      );
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: name,
        priority: taskForm.priority,
        status: "todo",
        dueDate: taskForm.dueDate || undefined,
        projectId,
        createdAt: new Date().toISOString(),
      };

      setTasks((previous) => [newTask, ...previous]);
    }

    resetTaskForm();
  }

  function startEditTask(task: Task) {
    setTaskForm({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate || "",
      projectId: task.projectId || "",
      editingId: task.id,
    });

    setTaskFilters((previous) => ({
      ...previous,
      search: "",
      status: "all",
      project: "all",
    }));

    setPage("tasks");
  }

  function changeTaskStatus(id: string, status: TaskStatus) {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  function deleteTask(task: Task) {
    const confirmed = window.confirm(`Delete task "${task.title}"?`);

    if (!confirmed) return;

    setTasks((previous) => previous.filter((item) => item.id !== task.id));

    if (taskForm.editingId === task.id) {
      resetTaskForm();
    }
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
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        description: projectDescription.trim(),
        color: projectColor,
        createdAt: new Date().toISOString(),
      };

      setProjects((previous) => [...previous, newProject]);
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

    const confirmed = window.confirm(
      `Delete "${project.name}"?\n\n` +
        `${count} task(s) will become unassigned. ` +
        "The tasks themselves will NOT be deleted.",
    );

    if (!confirmed) return;

    setProjects((previous) =>
      previous.filter((item) => item.id !== project.id),
    );

    setTasks((previous) =>
      previous.map((task) =>
        task.projectId === project.id
          ? {
              ...task,
              projectId: undefined,
            }
          : task,
      ),
    );

    if (taskFilters.project === project.id) {
      updateTaskFilters({
        project: "all",
      });
    }

    if (taskForm.projectId === project.id) {
      updateTaskForm({
        projectId: "",
      });
    }

    if (editingProject === project.id) {
      resetProjectForm();
    }
  }

  function openProjectTasks(id: string) {
    setTaskFilters((previous) => ({
      ...previous,
      project: id,
      status: "all",
      search: "",
    }));

    setPage("tasks");
  }

  function addTaskFromCalendar(date: string) {
    setTaskForm({
      ...INITIAL_TASK_FORM,
      dueDate: date,
    });

    setTaskFilters((previous) => ({
      ...previous,
      search: "",
      status: "all",
      project: "all",
    }));

    setPage("tasks");
  }

  function openTaskFromCalendar(id: string) {
    const task = tasks.find((item) => item.id === id);

    if (task) {
      startEditTask(task);
    }
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
          <Tasks
            tasks={tasks}
            visibleTasks={visibleTasks}
            projects={projects}
            form={taskForm}
            filters={taskFilters}
            onFormChange={updateTaskForm}
            onFiltersChange={updateTaskFilters}
            onSubmit={submitTask}
            onCancelEdit={resetTaskForm}
            onEdit={startEditTask}
            onDelete={deleteTask}
            onStatusChange={changeTaskStatus}
          />
        )}

        {page === "projects" && (
          <div className="fm-projects">
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
                        style={{
                          backgroundColor: color,
                        }}
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
          </div>
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
