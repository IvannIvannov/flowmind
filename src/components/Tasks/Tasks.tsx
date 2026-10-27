import type { FormEvent } from "react";

import type {
  Task,
  Project,
  TaskStatus,
  TaskFormState,
  TaskFilters,
  Priority,
  TaskSort,
} from "../../types";

import { formatDate, getTodayKey, isOverdue, isToday } from "../../utils/dates";

import "./Tasks.css";

interface TasksProps {
  tasks: Task[];
  visibleTasks: Task[];
  projects: Project[];
  form: TaskFormState;
  filters: TaskFilters;
  onFormChange: (changes: Partial<TaskFormState>) => void;
  onFiltersChange: (changes: Partial<TaskFilters>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

function Tasks({
  tasks,
  visibleTasks,
  projects,
  form,
  filters,
  onFormChange,
  onFiltersChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
  onStatusChange,
}: TasksProps) {
  const today = getTodayKey();

  const completedCount = tasks.filter(
    (task) => task.status === "completed",
  ).length;

  function getProject(task: Task) {
    return projects.find((project) => project.id === task.projectId);
  }

  function deadlineLabel(task: Task): string {
    if (!task.dueDate) return "";

    if (task.status !== "completed") {
      if (isOverdue(task.dueDate)) {
        return `Overdue: ${formatDate(task.dueDate)}`;
      }

      if (isToday(task.dueDate)) {
        return "Due today";
      }
    }

    return `Due: ${formatDate(task.dueDate)}`;
  }

  function deadlineClass(task: Task): string {
    if (!task.dueDate || task.status === "completed") {
      return "";
    }

    if (isOverdue(task.dueDate)) return "overdue";
    if (task.dueDate === today) return "today";

    return "upcoming";
  }

  return (
    <div className="fm-tasks">
      <header className="fm-tasks-header">
        <p className="fm-tasks-subtitle">STAY ORGANIZED</p>

        <h1>My Tasks ✅</h1>

        <p className="fm-tasks-description">
          Manage tasks, projects, priorities and deadlines.
        </p>
      </header>

      <section className="fm-tasks-panel">
        <h2>{form.editingId ? "Edit Task" : "Create New Task"}</h2>

        <form className="fm-tasks-form" onSubmit={onSubmit}>
          <div className="fm-tasks-field fm-tasks-title-field">
            <label htmlFor="fm-task-title">Task Name</label>

            <input
              id="fm-task-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                onFormChange({
                  title: event.target.value,
                })
              }
              placeholder="What do you need to do?"
              maxLength={200}
              required
            />
          </div>

          <div className="fm-tasks-field">
            <label htmlFor="fm-task-priority">Priority</label>

            <select
              id="fm-task-priority"
              value={form.priority}
              onChange={(event) =>
                onFormChange({
                  priority: event.target.value as Priority,
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="fm-tasks-field">
            <label htmlFor="fm-task-date">Due Date</label>

            <input
              id="fm-task-date"
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                onFormChange({
                  dueDate: event.target.value,
                })
              }
            />
          </div>

          <div className="fm-tasks-field">
            <label htmlFor="fm-task-project">Project</label>

            <select
              id="fm-task-project"
              value={form.projectId}
              onChange={(event) =>
                onFormChange({
                  projectId: event.target.value,
                })
              }
            >
              <option value="">No Project</option>

              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fm-tasks-form-actions">
            <button type="submit" className="fm-tasks-primary-button">
              {form.editingId ? "Save Changes" : "+ Add Task"}
            </button>

            {form.editingId && (
              <button
                type="button"
                className="fm-tasks-secondary-button"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="fm-tasks-panel">
        <div className="fm-tasks-section-heading">
          <h2>Your Tasks ({visibleTasks.length})</h2>

          <span className="fm-tasks-muted">
            {completedCount} of {tasks.length} completed
          </span>
        </div>

        <div className="fm-tasks-toolbar">
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({
                search: event.target.value,
              })
            }
          />

          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                status: event.target.value,
              })
            }
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            aria-label="Filter by project"
            value={filters.project}
            onChange={(event) =>
              onFiltersChange({
                project: event.target.value,
              })
            }
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
            value={filters.sort}
            onChange={(event) =>
              onFiltersChange({
                sort: event.target.value as TaskSort,
              })
            }
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Highest Priority</option>
            <option value="due-date">Nearest Deadline</option>
          </select>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="fm-tasks-empty">
            <div>📋</div>

            <h3>{tasks.length === 0 ? "No tasks yet" : "No matching tasks"}</h3>

            <p>
              {tasks.length === 0
                ? "Create your first task above."
                : "Change your search or filters."}
            </p>
          </div>
        ) : (
          <div className="fm-tasks-list">
            {visibleTasks.map((task) => {
              const project = getProject(task);

              return (
                <div className="fm-tasks-item" key={task.id}>
                  <div className="fm-tasks-info">
                    <h3
                      className={
                        task.status === "completed" ? "fm-tasks-completed" : ""
                      }
                    >
                      {task.title}
                    </h3>

                    <div className="fm-tasks-meta">
                      <span
                        className={
                          `fm-tasks-priority ` +
                          `fm-tasks-priority-${task.priority}`
                        }
                      >
                        {task.priority} priority
                      </span>

                      {task.dueDate && (
                        <span
                          className={`fm-tasks-deadline ` + deadlineClass(task)}
                        >
                          📅 {deadlineLabel(task)}
                        </span>
                      )}

                      {project && (
                        <span className="fm-tasks-project-tag">
                          <span
                            className="fm-tasks-project-dot"
                            style={{
                              backgroundColor: project.color,
                            }}
                          />

                          {project.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="fm-tasks-actions">
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(event) =>
                        onStatusChange(
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
                      type="button"
                      className="fm-tasks-icon-button fm-tasks-edit-button"
                      title="Edit task"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      className="fm-tasks-icon-button fm-tasks-delete-button"
                      title="Delete task"
                      aria-label={`Delete ${task.title}`}
                      onClick={() => onDelete(task)}
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
    </div>
  );
}

export default Tasks;
