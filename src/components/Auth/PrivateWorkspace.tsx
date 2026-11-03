import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

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

import type { InboxItem } from "../../utils/inboxStorage";
import type { FocusHistoryEntry } from "../../utils/focusHistory";
import type { AssistantTaskDraft } from "../../AI/AIAssistant";
import type { CloudTaskInput } from "../../services/workspace";

import AIAssistant from "../../AI/AIAssistant";
import Dashboard from "../Dashboard/Dashboard";
import Tasks from "../Tasks/Tasks";
import Projects from "../Projects/Projects";
import Calendar from "../Calendar/Calendar";
import Sidebar from "../Sidebar/Sidebar";
import Inbox from "../Inbox/Inbox";
import MyDay from "../MyDay/MyDay";
import QuickAdd from "../QuickAdd/QuickAdd";
import GlobalSearch from "../GlobalSearch/GlobalSearch";

import {
  loadWorkspace,
  createCloudTask,
  createCloudTasks,
  updateCloudTask,
  deleteCloudTask,
  createCloudProject,
  updateCloudProject,
  deleteCloudProject,
} from "../../services/workspace";

import {
  loadCloudInbox,
  createCloudInboxItems,
  updateCloudInboxItem,
  deleteCloudInboxItem,
} from "../../services/cloudInbox";

import {
  loadCloudFocusHistory,
  addCloudFocusEntry,
} from "../../services/cloudFocusHistory";

interface Props {
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

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Could not save your changes.";
}

export default function PrivateWorkspace({
  userId,
  onSignOut,
  signingOut,
}: Props) {
  const [page, setPage] = useState<Page>("dashboard");

  const [tasks, setTasks] = useState<Task[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);

  const [inbox, setInbox] = useState<InboxItem[]>([]);

  const [focusHistory, setFocusHistory] = useState<FocusHistoryEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [focusLoaded, setFocusLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [inboxError, setInboxError] = useState("");
  const [focusError, setFocusError] = useState("");

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);

  const [taskFilters, setTaskFilters] = useState<TaskFilters>(INITIAL_FILTERS);

  const [projectForm, setProjectForm] =
    useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  const [pendingInboxId, setPendingInboxId] = useState<string | null>(null);

  const [failedAiTasks, setFailedAiTasks] = useState<CloudTaskInput[]>([]);

  const [pendingAiCount, setPendingAiCount] = useState(0);

  const mounted = useRef(false);
  const busy = useRef(false);
  const inboxBusy = useRef(false);
  const aiQueue = useRef<CloudTaskInput[]>([]);
  const aiTimer = useRef<number | null>(null);

  const refreshWorkspace = useCallback(async () => {
    const data = await loadWorkspace(userId);

    if (mounted.current) {
      setTasks(data.tasks);
      setProjects(data.projects);
      setLoaded(true);
    }
  }, [userId]);

  const refreshInbox = useCallback(async () => {
    const data = await loadCloudInbox(userId);

    if (mounted.current) {
      setInbox(data);
      setInboxLoaded(true);
      setInboxError("");
    }
  }, [userId]);

  const refreshFocus = useCallback(async () => {
    const data = await loadCloudFocusHistory(userId);

    if (mounted.current) {
      setFocusHistory(data);
      setFocusLoaded(true);
      setFocusError("");
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;

    setLoading(true);
    setLoaded(false);
    setInboxLoaded(false);
    setFocusLoaded(false);

    void Promise.allSettled([
      refreshWorkspace().catch((cause: unknown) => {
        if (mounted.current) {
          setError(errorText(cause));
        }
      }),
      refreshInbox().catch((cause: unknown) => {
        if (mounted.current) {
          setInboxError(errorText(cause));
        }
      }),
      refreshFocus().catch((cause: unknown) => {
        if (mounted.current) {
          setFocusError(errorText(cause));
        }
      }),
    ]).then(() => {
      if (mounted.current) {
        setLoading(false);
      }
    });

    return () => {
      mounted.current = false;

      if (aiTimer.current !== null) {
        window.clearTimeout(aiTimer.current);
      }

      aiTimer.current = null;
    };
  }, [refreshWorkspace, refreshInbox, refreshFocus]);

  async function runAction(
    action: () => Promise<void>,
    after?: () => void,
  ): Promise<boolean> {
    if (busy.current || !loaded) {
      return false;
    }

    busy.current = true;
    setSaving(true);
    setError("");

    try {
      await action();
      await refreshWorkspace();

      if (mounted.current) {
        after?.();
      }

      return true;
    } catch (cause) {
      if (mounted.current) {
        setError(errorText(cause));
      }

      return false;
    } finally {
      busy.current = false;

      if (mounted.current) {
        setSaving(false);

        if (aiQueue.current.length) {
          flushAiQueue();
        }
      }
    }
  }

  function flushAiQueue() {
    if (aiTimer.current !== null || !mounted.current) {
      return;
    }

    aiTimer.current = window.setTimeout(() => {
      aiTimer.current = null;

      if (!mounted.current || busy.current) {
        return;
      }

      const batch = aiQueue.current.splice(0);

      setPendingAiCount(aiQueue.current.length);

      if (!batch.length) return;

      void runAction(() => createCloudTasks(userId, batch)).then((ok) => {
        if (!ok && mounted.current) {
          setFailedAiTasks((before) => [...before, ...batch]);
        }
      });
    }, 0);
  }

  function createTaskFromAssistant(draft: AssistantTaskDraft) {
    if (!loaded || !draft.title.trim()) {
      return;
    }

    aiQueue.current.push({
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      priority: draft.priority,
      dueDate: draft.dueDate,
      projectId: projects.some((project) => project.id === draft.projectId)
        ? draft.projectId
        : "",
    });

    setPendingAiCount(aiQueue.current.length);

    flushAiQueue();
  }

  async function retryFailedAiTasks() {
    if (!failedAiTasks.length || busy.current) {
      return;
    }

    try {
      const server = await loadWorkspace(userId);

      const missing = failedAiTasks.filter(
        (draft) => !server.tasks.some((task) => task.id === draft.id),
      );

      if (missing.length === 0) {
        setFailedAiTasks([]);
        await refreshWorkspace();
        return;
      }

      const saved = await runAction(() => createCloudTasks(userId, missing));

      if (saved) {
        setFailedAiTasks([]);
      }
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function inboxAction(action: () => Promise<void>): Promise<void> {
    if (!inboxLoaded) {
      throw new Error(inboxError || "Inbox could not be loaded.");
    }

    if (inboxBusy.current) {
      throw new Error("An Inbox action is still saving.");
    }

    inboxBusy.current = true;

    try {
      await action();
      await refreshInbox();
    } catch (cause) {
      setInboxError(errorText(cause));
      throw cause;
    } finally {
      inboxBusy.current = false;
    }
  }

  const addInboxItems = (texts: string[]) =>
    inboxAction(() => createCloudInboxItems(userId, texts));

  const editInboxItem = (id: string, text: string) =>
    inboxAction(() => updateCloudInboxItem(userId, id, text));

  const removeInboxItem = (id: string) =>
    inboxAction(() => deleteCloudInboxItem(userId, id));

  const onFocusComplete = useCallback(
    async (entry: FocusHistoryEntry): Promise<void> => {
      if (!focusLoaded) {
        throw new Error(focusError || "Focus history is not loaded.");
      }

      await addCloudFocusEntry(userId, entry);

      try {
        await refreshFocus();
      } catch (cause) {
        if (mounted.current) {
          setFocusError(errorText(cause));
        }
      }
    },
    [focusLoaded, focusError, refreshFocus, userId],
  );

  const visibleTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          const { search, status, project } = taskFilters;

          const matchesSearch = task.title
            .toLowerCase()
            .includes(search.trim().toLowerCase());

          const matchesStatus = status === "all" || task.status === status;

          const matchesProject =
            project === "all" ||
            (project === "none" ? !task.projectId : task.projectId === project);

          return matchesSearch && matchesStatus && matchesProject;
        })
        .sort((a, b) => {
          if (taskFilters.sort === "priority") {
            const delta =
              PRIORITY_VALUE[b.priority] - PRIORITY_VALUE[a.priority];

            if (delta !== 0) {
              return delta;
            }
          }

          if (taskFilters.sort === "due-date") {
            return (a.dueDate || "9999-12-31").localeCompare(
              b.dueDate || "9999-12-31",
            );
          }

          if (taskFilters.sort === "oldest") {
            return a.createdAt.localeCompare(b.createdAt);
          }

          return b.createdAt.localeCompare(a.createdAt);
        }),
    [tasks, taskFilters],
  );

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
    setTaskForm({
      ...INITIAL_TASK_FORM,
    });

    setPendingInboxId(null);
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!taskForm.title.trim() || busy.current || !loaded) {
      return;
    }

    const projectId = projects.some(
      (project) => project.id === taskForm.projectId,
    )
      ? taskForm.projectId
      : "";

    if (taskForm.editingId) {
      const id = taskForm.editingId;

      void runAction(
        () =>
          updateCloudTask(userId, id, {
            title: taskForm.title,
            priority: taskForm.priority,
            dueDate: taskForm.dueDate,
            projectId,
          }),
        resetTaskForm,
      );

      return;
    }

    const inboxId = pendingInboxId;

    void runAction(
      () =>
        createCloudTask(userId, {
          title: taskForm.title,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate,
          projectId,
        }),
      () => {
        resetTaskForm();

        if (inboxId) {
          void removeInboxItem(inboxId).catch((cause: unknown) => {
            setError(
              `Task saved, but the Inbox note could not be removed: ${errorText(
                cause,
              )}`,
            );
          });
        }
      },
    );
  }

  function startEditTask(task: Task) {
    setPendingInboxId(null);

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
    void runAction(() =>
      updateCloudTask(userId, id, {
        status,
      }),
    );
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

  function organizeInboxItem(item: InboxItem) {
    setPendingInboxId(item.id);

    setTaskForm({
      ...INITIAL_TASK_FORM,
      title: item.text.slice(0, 200),
    });

    setTaskFilters((previous) => ({
      ...previous,
      search: "",
      status: "all",
      project: "all",
    }));

    setPage("tasks");
  }

  function updateProjectForm(changes: Partial<ProjectFormState>) {
    setProjectForm((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function resetProjectForm() {
    setProjectForm({
      ...INITIAL_PROJECT_FORM,
    });
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy.current || !loaded) {
      return;
    }

    const name = projectForm.name.trim().replace(/\s+/g, " ");

    if (!name) return;

    const aliases = [
      ...new Set(
        projectForm.aliases
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].filter((item) => normalize(item) !== normalize(name));

    const candidateNames = new Set([name, ...aliases].map(normalize));

    const conflict = projects.find(
      (project) =>
        project.id !== projectForm.editingId &&
        [project.name, ...(project.aliases ?? [])].some((item) =>
          candidateNames.has(normalize(item)),
        ),
    );

    if (conflict) {
      setError(`Project name or alias already used by "${conflict.name}".`);
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
        `${count} tasks will become unassigned. ` +
        "Tasks will not be deleted.",
    );

    if (!confirmed) return;

    void runAction(
      () => deleteCloudProject(userId, project.id),
      () => {
        if (projectForm.editingId === project.id) {
          resetProjectForm();
        }

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
    setPendingInboxId(null);

    setTaskForm({
      ...INITIAL_TASK_FORM,
      dueDate: date,
    });

    setTaskFilters((previous) => ({
      ...previous,
      project: "all",
      status: "all",
      search: "",
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

      {inboxLoaded && (
        <QuickAdd
          onOpenInbox={() => setPage("inbox")}
          onAddItems={addInboxItems}
        />
      )}

      {inboxLoaded && (
        <GlobalSearch
          tasks={tasks}
          projects={projects}
          inbox={inbox}
          onOpenTask={startEditTask}
          onOpenProject={openProjectTasks}
          onOpenInbox={() => setPage("inbox")}
        />
      )}

      <main className="content">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              color: "var(--fm-muted)",
              fontSize: 12,
            }}
          >
            Private workspace
            {saving ? " · Saving..." : ""}
          </span>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut || saving || pendingAiCount > 0}
            style={{
              border: "1px solid var(--fm-border)",
              borderRadius: 9,
              padding: "9px 13px",
              background: "var(--fm-surface)",
              color: "var(--fm-text)",
              cursor: "pointer",
            }}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              padding: 12,
              background: "var(--fm-panel)",
              borderLeft: "3px solid #dc2626",
            }}
          >
            {error}
          </p>
        )}

        {failedAiTasks.length > 0 && (
          <div role="alert">
            {failedAiTasks.length} AI tasks could not be confirmed as saved.
            <button
              type="button"
              onClick={() => {
                void retryFailedAiTasks();
              }}
            >
              Retry missing tasks
            </button>
          </div>
        )}

        {loading ? (
          <h1>Loading your workspace...</h1>
        ) : !loaded ? (
          <section>
            <h1>Unable to load your workspace</h1>

            <button
              type="button"
              onClick={() => {
                void refreshWorkspace().catch((cause: unknown) =>
                  setError(errorText(cause)),
                );
              }}
            >
              Retry
            </button>
          </section>
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
                tasks={tasks}
                projects={projects}
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

            {page === "inbox" &&
              (!inboxLoaded ? (
                <section>
                  <h1>Inbox unavailable</h1>

                  <p role="alert">{inboxError}</p>

                  <button
                    type="button"
                    onClick={() => {
                      void refreshInbox().catch((cause: unknown) =>
                        setInboxError(errorText(cause)),
                      );
                    }}
                  >
                    Retry
                  </button>
                </section>
              ) : (
                <Inbox
                  items={inbox}
                  onAddItems={addInboxItems}
                  onUpdateItem={editInboxItem}
                  onDeleteItem={removeInboxItem}
                  onOrganize={organizeInboxItem}
                />
              ))}

            {page === "my-day" && (
              <MyDay
                tasks={tasks}
                projects={projects}
                userId={userId}
                onStatusChange={changeTaskStatus}
                onEditTask={startEditTask}
                onOpenTasks={() => setPage("tasks")}
                focusHistory={focusHistory}
                focusHistoryLoading={!focusLoaded}
                focusHistoryError={focusError}
                onFocusHistoryRefresh={() => {
                  void refreshFocus().catch((cause: unknown) =>
                    setFocusError(errorText(cause)),
                  );
                }}
                onFocusComplete={onFocusComplete}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
