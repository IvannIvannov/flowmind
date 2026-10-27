import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type Priority = "low" | "medium" | "high";
type TaskStatus = "todo" | "in-progress" | "completed";
type Page = "dashboard" | "tasks";
type TaskFilter = TaskStatus | "all";
type SortOption = "newest" | "oldest" | "priority" | "due-date";

interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
}

const STORAGE_KEY = "flowmind-tasks";

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityValues: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  completed: "Completed",
};

function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  if (!date) return "No deadline";

  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return date;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is Task => {
      if (!item || typeof item !== "object") return false;

      const task = item as Partial<Task>;

      return (
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.createdAt === "string" &&
        ["low", "medium", "high"].includes(task.priority ?? "") &&
        ["todo", "in-progress", "completed"].includes(task.status ?? "")
      );
    });
  } catch (error) {
    console.error("Failed to load tasks:", error);
    return [];
  }
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const [tasks, setTasks] = useState<Task[]>(loadTasks);

  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editDueDate, setEditDueDate] = useState("");

  const today = getToday();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks:", error);
    }
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;

    const inProgress = tasks.filter(
      (task) => task.status === "in-progress",
    ).length;

    const completed = tasks.filter(
      (task) => task.status === "completed",
    ).length;

    const overdue = tasks.filter(
      (task) =>
        task.status !== "completed" && !!task.dueDate && task.dueDate < today,
    ).length;

    const dueToday = tasks.filter(
      (task) => task.status !== "completed" && task.dueDate === today,
    ).length;

    return {
      total,
      inProgress,
      completed,
      overdue,
      dueToday,
    };
  }, [tasks, today]);

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesFilter = filter === "all" || task.status === filter;

        const matchesSearch = task.title.toLowerCase().includes(query);

        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const difference =
            priorityValues[b.priority] - priorityValues[a.priority];

          if (difference !== 0) return difference;
        }

        if (sortBy === "due-date") {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;

          return a.dueDate.localeCompare(b.dueDate);
        }

        if (sortBy === "oldest") {
          return a.createdAt.localeCompare(b.createdAt);
        }

        if (sortBy === "newest") {
          return b.createdAt.localeCompare(a.createdAt);
        }

        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tasks, filter, searchQuery, sortBy]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTask.trim();
    if (!title) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      priority,
      status: "todo",
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
    };

    setTasks((previous) => [task, ...previous]);

    setNewTask("");
    setPriority("medium");
    setDueDate("");
  }

  function updateStatus(id: string, status: TaskStatus) {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  function deleteTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`,
    );

    if (!confirmed) return;

    setTasks((previous) => previous.filter((item) => item.id !== id));

    if (editingId === id) {
      cancelEditing();
    }
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditPriority("medium");
    setEditDueDate("");
  }

  function saveEditing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = editTitle.trim();

    if (!title || !editingId) return;

    setTasks((previous) =>
      previous.map((task) =>
        task.id === editingId
          ? {
              ...task,
              title,
              priority: editPriority,
              dueDate: editDueDate || undefined,
            }
          : task,
      ),
    );

    cancelEditing();
  }

  function getDeadlineClass(task: Task): string {
    if (!task.dueDate || task.status === "completed") {
      return "";
    }

    if (task.dueDate < today) return "deadline-overdue";
    if (task.dueDate === today) return "deadline-today";

    return "deadline-upcoming";
  }

  function getDeadlineText(task: Task): string {
    if (!task.dueDate) return "";

    if (task.status !== "completed") {
      if (task.dueDate < today) {
        return `Overdue: ${formatDate(task.dueDate)}`;
      }

      if (task.dueDate === today) {
        return "Due today";
      }
    }

    return `Due: ${formatDate(task.dueDate)}`;
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

          <button className="nav-item" disabled>
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

        <div className="sidebar-footer">
          <p>FlowMind v0.3.0</p>
        </div>
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
              <div className="stat-card">
                <p>Total Tasks</p>
                <h2>{stats.total}</h2>
                <span>All your tasks</span>
              </div>

              <div className="stat-card">
                <p>In Progress</p>
                <h2>{stats.inProgress}</h2>
                <span>Currently working on</span>
              </div>

              <div className="stat-card">
                <p>Completed</p>
                <h2>{stats.completed}</h2>
                <span>Tasks successfully finished</span>
              </div>

              <div className="stat-card">
                <p>Due Today</p>
                <h2>{stats.dueToday}</h2>
                <span>Tasks requiring attention today</span>
              </div>

              <div className="stat-card">
                <p>Overdue</p>
                <h2 className={stats.overdue > 0 ? "danger-text" : ""}>
                  {stats.overdue}
                </h2>
                <span>Unfinished tasks past their deadline</span>
              </div>
            </section>
          </>
        )}

        {page === "tasks" && (
          <>
            <header className="page-header">
              <p className="subtitle">STAY ORGANIZED</p>
              <h1>My Tasks ✅</h1>

              <p className="description">
                Manage your work, priorities and deadlines.
              </p>
            </header>

            <section className="task-panel">
              <h2>Create New Task</h2>

              <form className="task-form" onSubmit={addTask}>
                <div className="form-field task-title-field">
                  <label htmlFor="new-task-title">Task Name</label>

                  <input
                    id="new-task-title"
                    type="text"
                    placeholder="What do you need to do?"
                    value={newTask}
                    onChange={(event) => setNewTask(event.target.value)}
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="new-task-priority">Priority</label>

                  <select
                    id="new-task-priority"
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
                  <label htmlFor="new-task-date">Due Date (Optional)</label>

                  <input
                    id="new-task-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>

                <button
                  className="primary-button add-task-button"
                  type="submit"
                >
                  + Add Task
                </button>
              </form>
            </section>

            <section className="task-panel">
              <div className="tasks-header">
                <h2>Your Tasks ({visibleTasks.length})</h2>

                <p className="tasks-summary">
                  {stats.completed} completed of {stats.total}
                </p>
              </div>

              <div className="task-toolbar">
                <div className="search-wrapper">
                  <input
                    type="search"
                    placeholder="Search tasks..."
                    aria-label="Search tasks"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>

                <select
                  aria-label="Filter tasks by status"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as TaskFilter)
                  }
                >
                  <option value="all">All Tasks</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  aria-label="Sort tasks"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="priority">Highest Priority</option>
                  <option value="due-date">Nearest Deadline</option>
                </select>
              </div>

              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <p>📋</p>

                  <h3>
                    {tasks.length === 0
                      ? "No tasks here yet"
                      : "No matching tasks"}
                  </h3>

                  <span>
                    {tasks.length === 0
                      ? "Create your first task to get started."
                      : "Try changing your search or filters."}
                  </span>
                </div>
              ) : (
                <div className="task-list">
                  {visibleTasks.map((task) => (
                    <div className="task-item" key={task.id}>
                      {editingId === task.id ? (
                        <form className="edit-task-form" onSubmit={saveEditing}>
                          <div className="form-field">
                            <label htmlFor={`edit-title-${task.id}`}>
                              Task Name
                            </label>

                            <input
                              id={`edit-title-${task.id}`}
                              type="text"
                              value={editTitle}
                              maxLength={200}
                              required
                              onChange={(event) =>
                                setEditTitle(event.target.value)
                              }
                            />
                          </div>

                          <div className="edit-fields">
                            <div className="form-field">
                              <label htmlFor={`edit-priority-${task.id}`}>
                                Priority
                              </label>

                              <select
                                id={`edit-priority-${task.id}`}
                                value={editPriority}
                                onChange={(event) =>
                                  setEditPriority(
                                    event.target.value as Priority,
                                  )
                                }
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>

                            <div className="form-field">
                              <label htmlFor={`edit-date-${task.id}`}>
                                Due Date
                              </label>

                              <input
                                id={`edit-date-${task.id}`}
                                type="date"
                                value={editDueDate}
                                onChange={(event) =>
                                  setEditDueDate(event.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="edit-actions">
                            <button type="submit" className="save-button">
                              Save Changes
                            </button>

                            <button
                              type="button"
                              className="cancel-button"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
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
                                {priorityLabels[task.priority]} Priority
                              </span>

                              {task.dueDate && (
                                <span
                                  className={`deadline ${getDeadlineClass(task)}`}
                                >
                                  📅 {getDeadlineText(task)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="task-actions">
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={task.status}
                              onChange={(event) =>
                                updateStatus(
                                  task.id,
                                  event.target.value as TaskStatus,
                                )
                              }
                            >
                              {(Object.keys(statusLabels) as TaskStatus[]).map(
                                (status) => (
                                  <option key={status} value={status}>
                                    {statusLabels[status]}
                                  </option>
                                ),
                              )}
                            </select>

                            <button
                              className="edit-button"
                              onClick={() => startEditing(task)}
                              aria-label={`Edit ${task.title}`}
                              title="Edit task"
                            >
                              ✏️
                            </button>

                            <button
                              className="delete-button"
                              onClick={() => deleteTask(task.id)}
                              aria-label={`Delete ${task.title}`}
                              title="Delete task"
                            >
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
