import { useEffect, useState } from "react";
import "./App.css";

type Priority = "low" | "medium" | "high";
type TaskStatus = "todo" | "in-progress" | "completed";
type Page = "dashboard" | "tasks";

interface Task {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
}

const STORAGE_KEY = "flowmind-tasks";

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Task[]) : [];
    } catch {
      return [];
    }
  });

  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newTask.trim();
    if (!title) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      priority,
      status: "todo",
      createdAt: new Date().toISOString(),
    };

    setTasks((previous) => [task, ...previous]);
    setNewTask("");
    setPriority("medium");
  };

  const updateStatus = (id: string, status: TaskStatus) => {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== id));
  };

  const completed = tasks.filter((task) => task.status === "completed").length;

  const inProgress = tasks.filter(
    (task) => task.status === "in-progress",
  ).length;

  const visibleTasks = tasks.filter(
    (task) => filter === "all" || task.status === filter,
  );

  const priorityLabels: Record<Priority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };

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
          <p>FlowMind v0.2.0</p>
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
                <h2>{tasks.length}</h2>
                <span>All your tasks</span>
              </div>

              <div className="stat-card">
                <p>In Progress</p>
                <h2>{inProgress}</h2>
                <span>Currently working on</span>
              </div>

              <div className="stat-card">
                <p>Completed</p>
                <h2>{completed}</h2>
                <span>Tasks successfully finished</span>
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
                Keep track of everything you need to do.
              </p>
            </header>

            <section className="task-panel">
              <h2>Create New Task</h2>

              <form className="task-form" onSubmit={addTask}>
                <input
                  type="text"
                  placeholder="What do you need to do?"
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  maxLength={200}
                  required
                />

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as Priority)
                  }
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>

                <button className="primary-button" type="submit">
                  + Add Task
                </button>
              </form>
            </section>

            <section className="task-panel">
              <div className="tasks-header">
                <h2>Your Tasks ({visibleTasks.length})</h2>
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as typeof filter)
                  }
                >
                  <option value="all">All Tasks</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <p>📋</p>
                  <h3>No tasks here yet</h3>
                  <span>Your tasks will appear here.</span>
                </div>
              ) : (
                <div className="task-list">
                  {visibleTasks.map((task) => (
                    <div className="task-item" key={task.id}>
                      <div className="task-info">
                        <h3
                          className={
                            task.status === "completed" ? "completed-task" : ""
                          }
                        >
                          {task.title}
                        </h3>

                        <span className={`priority priority-${task.priority}`}>
                          {priorityLabels[task.priority]} Priority
                        </span>
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
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>

                        <button
                          className="delete-button"
                          onClick={() => deleteTask(task.id)}
                          aria-label={`Delete ${task.title}`}
                          title="Delete task"
                        >
                          🗑️
                        </button>
                      </div>
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
