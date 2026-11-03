import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import AIAssistant from "../../AI/AIAssistant";
import type { AssistantTaskDraft } from "../../AI/AIAssistant";

import Dashboard from "../Dashboard/Dashboard";
import Tasks from "../Tasks/Tasks";
import Projects from "../Projects/Projects";
import Calendar from "../Calendar/Calendar";
import Sidebar from "../Sidebar/Sidebar";

import type {
  Page,
  Priority,
  Task,
  TaskStatus,
  TaskFormState,
  TaskFilters,
  Project,
  ProjectFormState,
} from "../../types";

import {
  loadWorkspace,
  createCloudTask,
  updateCloudTask,
  deleteCloudTask,
  createCloudProject,
  updateCloudProject,
  deleteCloudProject,
} from "../../services/workspace";

interface PrivateWorkspaceProps {
  userId: string;
  onSignOut: () => void;
  signingOut: boolean;
}

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

const INITIAL_PROJECT_FORM: ProjectFormState = {
  name: "",
  description: "",
  color: COLORS[0],
  aliases: "",
  editingId: null,
};

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function parseProjectAliases(value: string): string[] {
  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const item of value.split(",")) {
    const alias = item.trim().replace(/\s+/g, " ");

    if (!alias) continue;

    const normalized = normalizeProjectName(alias);

    if (seen.has(normalized)) continue;

    seen.add(normalized);
    aliases.push(alias);
  }

  return aliases;
}

export default function PrivateWorkspace({
  userId,
  onSignOut,
  signingOut,
}: PrivateWorkspaceProps) {
  const [page, setPage] = useState<Page>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);

  const [taskFilters, setTaskFilters] = useState<TaskFilters>(INITIAL_FILTERS);

  const [projectForm, setProjectForm] =
    useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  const mountedRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const workspace = await loadWorkspace(userId);

        if (!mountedRef.current) return;

        setTasks(workspace.tasks);
        setProjects(workspace.projects);
      } catch (cause) {
        if (!mountedRef.current) return;

        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your workspace.",
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  async function refreshWorkspace() {
    const workspace = await loadWorkspace(userId);

    if (!mountedRef.current) return;

    setTasks(workspace.tasks);
    setProjects(workspace.projects);
  }

  async function runAction(
    action: () => Promise<void>,
    afterSuccess?: () => void,
  ): Promise<boolean> {
    if (busyRef.current) return false;

    busyRef.current = true;
    setSaving(true);
    setError("");

    try {
      await action();
      await refreshWorkspace();

      if (mountedRef.current) {
        afterSuccess?.();
      }

      return true;
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save your changes.",
        );
      }

      return false;
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

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

          if (difference !== 0) return difference;
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

  function navigate(next: Page) {
    setError("");
    setPage(next);
  }

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
    if (!name || busyRef.current) return;

    const projectId = projects.some(
      (project) => project.id === taskForm.projectId,
    )
      ? taskForm.projectId
      : "";

    const editingId = taskForm.editingId;

    if (editingId) {
      void runAction(
        () =>
          updateCloudTask(userId, editingId, {
            title: name,
            priority: taskForm.priority,
            dueDate: taskForm.dueDate,
            projectId,
          }),
        resetTaskForm,
      );

      return;
    }

    void runAction(
      () =>
        createCloudTask(userId, {
          title: name,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate,
          projectId,
        }),
      resetTaskForm,
    );
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
    void runAction(() => updateCloudTask(userId, id, { status }));
  }

  function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) {
      return;
    }

    void runAction(
      () => deleteCloudTask(userId, task.id),
      () => {
        if (taskForm.editingId === task.id) {
          resetTaskForm();
        }
      },
    );
  }

  function createTaskFromAssistant(draft: AssistantTaskDraft) {
    const name = draft.title.trim();
    if (!name) return;

    const projectId = projects.some((project) => project.id === draft.projectId)
      ? draft.projectId
      : "";

    void runAction(() =>
      createCloudTask(userId, {
        title: name,
        priority: draft.priority,
        dueDate: draft.dueDate,
        projectId,
      }),
    );
  }

  function updateProjectForm(changes: Partial<ProjectFormState>) {
    setProjectForm((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function resetProjectForm() {
    setProjectForm({ ...INITIAL_PROJECT_FORM });
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = projectForm.name.trim().replace(/\s+/g, " ");

    if (!name || busyRef.current) return;

    const normalizedName = normalizeProjectName(name);

    const aliases = parseProjectAliases(projectForm.aliases).filter(
      (alias) => normalizeProjectName(alias) !== normalizedName,
    );

    const candidateNames = [name, ...aliases];
    const candidateKeys = new Set(candidateNames.map(normalizeProjectName));

    const conflictingProject = projects.find((project) => {
      if (project.id === projectForm.editingId) {
        return false;
      }

      const existingNames = [project.name, ...(project.aliases ?? [])];

      return existingNames.some((existingName) =>
        candidateKeys.has(normalizeProjectName(existingName)),
      );
    });

    if (conflictingProject) {
      setError(
        `A name or alternative name is already used by "${conflictingProject.name}".`,
      );
      return;
    }

    const input = {
      name,
      description: projectForm.description.trim(),
      color: projectForm.color,
      aliases,
    };

    if (projectForm.editingId) {
      const id = projectForm.editingId;

      void runAction(
        () => updateCloudProject(userId, id, input),
        resetProjectForm,
      );
    } else {
      void runAction(() => createCloudProject(userId, input), resetProjectForm);
    }
  }

  function startEditProject(project: Project) {
    setProjectForm({
      name: project.name,
      description: project.description,
      color: project.color,
      aliases: (project.aliases ?? []).join(", "),
      editingId: project.id,
    });

    setPage("projects");
  }

  function deleteProject(project: Project) {
    const count = tasks.filter((task) => task.projectId === project.id).length;

    const confirmed = window.confirm(
      `Delete "${project.name}"?\n\n` +
        `${count} task(s) will become unassigned. ` +
        "The tasks themselves will NOT be deleted.",
    );

    if (!confirmed) return;

    void runAction(
      () => deleteCloudProject(userId, project.id),
      () => {
        if (projectForm.editingId === project.id) {
          resetProjectForm();
        }

        if (taskFilters.project === project.id) {
          updateTaskFilters({ project: "all" });
        }

        if (taskForm.projectId === project.id) {
          updateTaskForm({ projectId: "" });
        }
      },
    );
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

    if (task) startEditTask(task);
  }

  return (
    <div className="app">
      <Sidebar currentPage={page} onNavigate={navigate} />

      <main className="content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--fm-muted)",
            }}
          >
            Private workspace
            {saving ? " · Saving..." : ""}
          </span>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut || saving}
            style={{
              border: "1px solid var(--fm-border)",
              borderRadius: 9,
              padding: "9px 13px",
              background: "var(--fm-surface)",
              color: "var(--fm-text)",
              cursor: "pointer",
              font: "inherit",
              fontSize: 12,
            }}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              border: "1px solid var(--fm-border)",
              borderLeft: "3px solid #dc2626",
              borderRadius: 10,
              padding: 14,
              marginBottom: 18,
              color: "var(--fm-text)",
              fontSize: 12,
            }}
          >
            {error}

            <button
              type="button"
              onClick={() => {
                void refreshWorkspace()
                  .then(() => setError(""))
                  .catch((cause: unknown) => {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not reload your data.",
                    );
                  });
              }}
              style={{ marginLeft: 12 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div>
            <h1>Loading your workspace...</h1>
            <p>Connecting to your private data.</p>
          </div>
        ) : error && tasks.length === 0 && projects.length === 0 ? (
          <div>
            <h1>Unable to load your workspace</h1>
            <p>Check your connection and retry.</p>
          </div>
        ) : (
          <>
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
              <Projects
                projects={projects}
                tasks={tasks}
                colors={COLORS}
                form={projectForm}
                onFormChange={updateProjectForm}
                onSubmit={submitProject}
                onCancelEdit={resetProjectForm}
                onEdit={startEditProject}
                onDelete={deleteProject}
                onOpenTasks={openProjectTasks}
              />
            )}

            {page === "calendar" && (
              <Calendar
                tasks={tasks}
                projects={projects}
                onAddTask={addTaskFromCalendar}
                onOpenTask={openTaskFromCalendar}
              />
            )}

            {page === "ai" && (
              <AIAssistant
                projects={projects}
                tasks={tasks}
                onCreateTask={createTaskFromAssistant}
                onOpenTasks={() => setPage("tasks")}
              />
            )}

            {(page === "my-day" || page === "inbox") && (
              <section>
                <h1>{page === "my-day" ? "My Day" : "Inbox"}</h1>

                <p>
                  This section is temporarily unavailable while we move its data
                  to your private account.
                </p>

                <button type="button" onClick={() => setPage("dashboard")}>
                  Back to Dashboard
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
