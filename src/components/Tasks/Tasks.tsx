import { useEffect, useMemo, useRef, useState } from "react";

import type { FormEvent, ReactNode } from "react";

import type {
  Task,
  Project,
  TaskStatus,
  TaskFormState,
  TaskFilters,
  Priority,
  TaskSort,
} from "../../types";

import {
  formatDate,
  getTodayKey,
  isOverdue,
  isToday,
  parseDateKey,
  toDateKey,
} from "../../utils/dates";

import {
  getTaskInsights,
  matchesSmartTaskFilter,
} from "../../utils/taskInsights";

import type { SmartTaskFilter } from "../../utils/taskInsights";

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

type IconName =
  | "plus"
  | "search"
  | "filter"
  | "chevron"
  | "chevron-left"
  | "chevron-right"
  | "check"
  | "calendar"
  | "edit"
  | "trash"
  | "close"
  | "arrow"
  | "list";

type SelectOption = {
  value: string;
  label: string;
};

const ANIMATION_MS = 420;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const QUICK_FILTERS: {
  id: SmartTaskFilter;
  label: string;
}[] = [
  { id: "all", label: "All tasks" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Next 7 days" },
  { id: "high-priority", label: "High priority" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low priority" },
  { value: "medium", label: "Medium priority" },
  { value: "high", label: "High priority" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Highest priority" },
  { value: "due-date", label: "Nearest deadline" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    filter: <path d="M4 7h16M7 12h10M10 17h4" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4 14-14" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="m16 4 4 4L9 19l-5 1 1-5Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14" />
        <path d="M10 10v6M14 10v6" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* CUSTOM DROPDOWN */

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  priorityColors?: boolean;
}

function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select an option",
  priorityColors = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div
      className={`fm-tasks-custom-select ${open ? "is-open" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="fm-tasks-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="fm-tasks-select-value">
          {priorityColors && selected && (
            <span
              className={`fm-tasks-select-priority is-${value}`}
              aria-hidden="true"
            />
          )}

          {selected?.label ?? placeholder}
        </span>

        <span className="fm-tasks-select-chevron">
          <Icon name="chevron" size={16} />
        </span>
      </button>

      {open && (
        <div
          className="fm-tasks-select-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`fm-tasks-select-option ${
                  isSelected ? "is-selected" : ""
                }`}
                onClick={() => choose(option.value)}
              >
                {priorityColors && (
                  <span
                    className={`fm-tasks-select-priority is-${option.value}`}
                    aria-hidden="true"
                  />
                )}

                <span>{option.label}</span>

                {isSelected && <Icon name="check" size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* CUSTOM DATE PICKER */

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function CustomDatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const initialDate = parseDateKey(value) ?? new Date();

  const [viewDate, setViewDate] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const today = getTodayKey();

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function toggleCalendar() {
    if (!open) {
      const date = parseDateKey(value) ?? new Date();

      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    setOpen((previous) => !previous);
  }

  function changeMonth(direction: number) {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );
  }

  function chooseDate(date: string) {
    onChange(date);
    setOpen(false);
  }

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const count = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: count }, (_, index) => {
      const date = new Date(year, month, index - firstWeekday + 1);

      return {
        key: toDateKey(date),
        number: date.getDate(),
        inMonth: date.getMonth() === month,
      };
    });
  }, [viewDate]);

  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(viewDate);

  const selectedLabel = value
    ? formatDate(value, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Choose a date";

  return (
    <div
      className={`fm-tasks-datepicker ${open ? "is-open" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="fm-tasks-date-trigger"
        aria-label="Choose due date"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleCalendar}
      >
        <span className="fm-tasks-date-value">
          <Icon name="calendar" size={16} />
          <span className={value ? "" : "is-placeholder"}>{selectedLabel}</span>
        </span>

        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <div
          className="fm-tasks-date-popover"
          role="dialog"
          aria-label="Choose due date"
        >
          <div className="fm-tasks-date-header">
            <strong>{monthTitle}</strong>

            <div className="fm-tasks-date-navigation">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <Icon name="chevron-left" size={17} />
              </button>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                <Icon name="chevron-right" size={17} />
              </button>
            </div>
          </div>

          <div className="fm-tasks-date-grid">
            {WEEKDAYS.map((day) => (
              <span key={day} className="fm-tasks-date-weekday">
                {day}
              </span>
            ))}

            {calendarDays.map((day) => (
              <button
                key={day.key}
                type="button"
                className={[
                  "fm-tasks-date-day",
                  !day.inMonth ? "is-outside" : "",
                  day.key === today ? "is-today" : "",
                  day.key === value ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={day.key}
                aria-pressed={day.key === value}
                onClick={() => chooseDate(day.key)}
              >
                {day.number}
              </button>
            ))}
          </div>

          <div className="fm-tasks-date-footer">
            <button type="button" onClick={() => chooseDate("")}>
              Clear
            </button>

            <button type="button" onClick={() => chooseDate(today)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: TaskStatus): string {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "To do"
  );
}

function priorityLabel(priority: Priority): string {
  return (
    PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ??
    "Low priority"
  );
}

/* MAIN COMPONENT */

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
  const [smartFilter, setSmartFilter] = useState<SmartTaskFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  const [pending, setPending] = useState<Record<string, TaskStatus>>({});

  const timers = useRef<Map<string, number>>(new Map());
  const pendingActions = useRef<Map<string, TaskStatus>>(new Map());
  const statusCallback = useRef(onStatusChange);

  statusCallback.current = onStatusChange;

  const formRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const editing = Boolean(form.editingId);
  const today = getTodayKey();

  const insights = useMemo(() => getTaskInsights(tasks), [tasks]);

  const completedCount = tasks.filter(
    (task) => task.status === "completed",
  ).length;

  const activeCount = tasks.length - completedCount;

  const filteredTasks = useMemo(
    () =>
      visibleTasks.filter((task) => matchesSmartTaskFilter(task, smartFilter)),
    [visibleTasks, smartFilter],
  );

  const groupedTasks = useMemo(
    () => ({
      inProgress: filteredTasks.filter((task) => task.status === "in-progress"),
      todo: filteredTasks.filter((task) => task.status === "todo"),
      completed: filteredTasks.filter((task) => task.status === "completed"),
    }),
    [filteredTasks],
  );

  const showGroups = smartFilter === "all" && filters.status === "all";

  const hasAdvancedFilters =
    filters.status !== "all" ||
    filters.project !== "all" ||
    filters.sort !== "newest";

  const projectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "No project" },
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ],
    [projects],
  );

  const filterProjectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "all", label: "All projects" },
      { value: "none", label: "No project" },
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ],
    [projects],
  );

  useEffect(() => {
    if (editing) setFormOpen(true);
  }, [editing]);

  useEffect(() => {
    if (openStatusId === null) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        !event.target.closest(".fm-tasks-status-control")
      ) {
        setOpenStatusId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenStatusId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openStatusId]);

  useEffect(() => {
    if (!formOpen) return;

    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [formOpen]);

  useEffect(() => {
    const activeTimers = timers.current;
    const actions = pendingActions.current;

    return () => {
      activeTimers.forEach((handle) => window.clearTimeout(handle));
      activeTimers.clear();

      actions.forEach((status, id) => statusCallback.current(id, status));
      actions.clear();
    };
  }, []);

  function projectFor(task: Task) {
    return projects.find((project) => project.id === task.projectId);
  }

  function deadlineLabel(task: Task): string {
    if (!task.dueDate) return "";

    if (task.status !== "completed") {
      if (isOverdue(task.dueDate)) {
        return `Overdue · ${formatDate(task.dueDate)}`;
      }

      if (isToday(task.dueDate)) {
        return "Due today";
      }
    }

    return formatDate(task.dueDate);
  }

  function deadlineClass(task: Task): string {
    if (!task.dueDate || task.status === "completed") {
      return "";
    }

    if (isOverdue(task.dueDate)) return "is-overdue";
    if (task.dueDate === today) return "is-today";

    return "";
  }

  function countForFilter(filter: SmartTaskFilter): number {
    switch (filter) {
      case "all":
        return tasks.length;
      case "today":
        return insights.today;
      case "overdue":
        return insights.overdue;
      case "upcoming":
        return insights.upcoming;
      case "high-priority":
        return insights.highPriority;
      default:
        return 0;
    }
  }

  function handleQuickFilter(filter: SmartTaskFilter) {
    setSmartFilter(filter);
    setOpenStatusId(null);

    if (filter !== "all" && filters.status === "completed") {
      onFiltersChange({ status: "all" });
    }
  }

  function openCreateForm() {
    if (editing) onCancelEdit();
    setFormOpen(true);

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      titleRef.current?.focus();
    });
  }

  function closeForm() {
    if (editing) onCancelEdit();
    setFormOpen(false);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit(event);

    if (!form.title.trim()) return;
    if (!editing) setFormOpen(false);
  }

  function handleEdit(task: Task) {
    onEdit(task);
    setFormOpen(true);
    setOpenStatusId(null);

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function changeStatus(task: Task, status: TaskStatus) {
    setOpenStatusId(null);
    onStatusChange(task.id, status);
  }

  function toggleComplete(task: Task) {
    if (timers.current.has(task.id)) return;

    const nextStatus: TaskStatus =
      task.status === "completed" ? "todo" : "completed";

    pendingActions.current.set(task.id, nextStatus);

    setPending((current) => ({
      ...current,
      [task.id]: nextStatus,
    }));

    const handle = window.setTimeout(() => {
      timers.current.delete(task.id);
      pendingActions.current.delete(task.id);

      statusCallback.current(task.id, nextStatus);

      setPending((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
    }, ANIMATION_MS);

    timers.current.set(task.id, handle);
  }

  function resetFilters() {
    setSmartFilter("all");

    onFiltersChange({
      search: "",
      status: "all",
      project: "all",
      sort: "newest",
    });

    setAdvancedFiltersOpen(false);
  }

  function renderTask(task: Task) {
    const project = projectFor(task);
    const isPending = Object.prototype.hasOwnProperty.call(pending, task.id);

    const visualStatus = pending[task.id] ?? task.status;
    const isComplete = visualStatus === "completed";
    const statusOpen = openStatusId === task.id;

    return (
      <article
        key={task.id}
        className={`fm-tasks-item ${
          isComplete ? "is-completed" : ""
        } ${isPending ? "is-transitioning" : ""}`}
      >
        <button
          type="button"
          className={`fm-tasks-checkbox ${isComplete ? "is-checked" : ""}`}
          onClick={() => toggleComplete(task)}
          disabled={isPending}
          aria-pressed={isComplete}
          aria-label={
            isComplete ? `Reopen ${task.title}` : `Complete ${task.title}`
          }
          title={isComplete ? "Reopen task" : "Mark completed"}
        >
          <Icon name="check" size={14} />
        </button>

        <div className="fm-tasks-info">
          <button
            type="button"
            className={`fm-tasks-title ${isComplete ? "is-done" : ""}`}
            onClick={() => handleEdit(task)}
          >
            {task.title}
          </button>

          <div className="fm-tasks-meta">
            {project && (
              <span className="fm-tasks-project">
                <Icon name="list" size={12} />
                {project.name}
              </span>
            )}

            {task.dueDate && (
              <span className={`fm-tasks-date ${deadlineClass(task)}`}>
                <Icon name="calendar" size={12} />
                {deadlineLabel(task)}
              </span>
            )}

            <span className={`fm-tasks-priority is-${task.priority}`}>
              <span className="fm-tasks-priority-dot" aria-hidden="true" />
              {priorityLabel(task.priority)}
            </span>
          </div>
        </div>

        <div className="fm-tasks-item-actions">
          <div className="fm-tasks-status-control">
            <button
              type="button"
              className={`fm-tasks-status-button is-${visualStatus}`}
              onClick={() => setOpenStatusId(statusOpen ? null : task.id)}
              aria-expanded={statusOpen}
              disabled={isPending}
              aria-label={`Change status for ${task.title}`}
              title="Change task status"
            >
              <span className="fm-tasks-status-dot" />
              {statusLabel(visualStatus)}
              <Icon name="chevron" size={14} />
            </button>

            {statusOpen && (
              <div className="fm-tasks-status-menu">
                <span className="fm-tasks-menu-label">SET STATUS</span>

                {STATUS_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`fm-tasks-status-option ${
                      visualStatus === option.value ? "is-selected" : ""
                    }`}
                    onClick={() =>
                      changeStatus(task, option.value as TaskStatus)
                    }
                  >
                    <span
                      className={`fm-tasks-status-dot is-${option.value}`}
                    />
                    {option.label}

                    {visualStatus === option.value && (
                      <Icon name="check" size={14} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="fm-tasks-icon-button"
            title="Edit task"
            aria-label={`Edit ${task.title}`}
            onClick={() => handleEdit(task)}
          >
            <Icon name="edit" size={16} />
          </button>

          <button
            type="button"
            className="fm-tasks-icon-button fm-tasks-delete-button"
            title="Delete task"
            aria-label={`Delete ${task.title}`}
            onClick={() => onDelete(task)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </article>
    );
  }

  function renderGroup(title: string, items: Task[], description: string) {
    if (items.length === 0) return null;

    return (
      <div className="fm-tasks-group">
        <div className="fm-tasks-group-header">
          <div className="fm-tasks-group-name">
            <h3>{title}</h3>
            <span>{items.length}</span>
          </div>
          <p>{description}</p>
        </div>

        <div className="fm-tasks-list">{items.map(renderTask)}</div>
      </div>
    );
  }

  return (
    <main className="fm-tasks">
      <header className="fm-tasks-header">
        <div>
          <p className="fm-tasks-subtitle">YOUR WORKSPACE</p>

          <h1>
            My Tasks<span>.</span>
          </h1>

          <p className="fm-tasks-description">
            A clearer view of everything you need to get done.
          </p>
        </div>

        <button
          type="button"
          className="fm-tasks-new-button"
          onClick={openCreateForm}
        >
          <Icon name="plus" size={17} />
          New task
        </button>
      </header>

      <div className="fm-tasks-overview" aria-label="Task overview">
        <div className="fm-tasks-overview-item">
          <strong>{activeCount}</strong>
          <span>Open tasks</span>
        </div>

        <div className="fm-tasks-overview-item">
          <strong>{insights.today}</strong>
          <span>Due today</span>
        </div>

        <div className="fm-tasks-overview-item">
          <strong>{insights.overdue}</strong>
          <span>Overdue</span>
        </div>

        <div className="fm-tasks-overview-item">
          <strong>{completedCount}</strong>
          <span>Completed</span>
        </div>
      </div>

      {formOpen && (
        <section
          ref={formRef}
          className="fm-tasks-form-panel"
          aria-label={editing ? "Edit task" : "Create new task"}
        >
          <div className="fm-tasks-form-heading">
            <div>
              <span className="fm-tasks-kicker">
                {editing ? "UPDATE TASK" : "QUICK ADD"}
              </span>

              <h2>{editing ? "Edit your task" : "Create a task"}</h2>

              <p>
                {editing
                  ? "Update the details below."
                  : "Add the details that matter."}
              </p>
            </div>

            <button
              type="button"
              className="fm-tasks-icon-button"
              onClick={closeForm}
              aria-label="Close task form"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <form className="fm-tasks-form" onSubmit={handleFormSubmit}>
            <div className="fm-tasks-field fm-tasks-title-field">
              <label htmlFor="fm-task-title">Task name</label>

              <input
                ref={titleRef}
                id="fm-task-title"
                type="text"
                value={form.title}
                onChange={(event) =>
                  onFormChange({
                    title: event.target.value,
                  })
                }
                placeholder="What needs to get done?"
                maxLength={200}
                required
              />
            </div>

            <div className="fm-tasks-form-grid">
              <div className="fm-tasks-field">
                <span className="fm-tasks-field-label">Priority</span>

                <CustomSelect
                  ariaLabel="Task priority"
                  value={form.priority}
                  options={PRIORITY_OPTIONS}
                  priorityColors
                  onChange={(value) =>
                    onFormChange({
                      priority: value as Priority,
                    })
                  }
                />
              </div>

              <div className="fm-tasks-field">
                <span className="fm-tasks-field-label">Due date</span>

                <CustomDatePicker
                  value={form.dueDate}
                  onChange={(value) =>
                    onFormChange({
                      dueDate: value,
                    })
                  }
                />
              </div>

              <div className="fm-tasks-field">
                <span className="fm-tasks-field-label">Project</span>

                <CustomSelect
                  ariaLabel="Task project"
                  value={form.projectId}
                  options={projectOptions}
                  onChange={(value) =>
                    onFormChange({
                      projectId: value,
                    })
                  }
                />
              </div>
            </div>

            <div className="fm-tasks-form-footer">
              <span>
                {editing
                  ? "Changes will update this task."
                  : "You can edit this later."}
              </span>

              <div className="fm-tasks-form-actions">
                <button
                  type="button"
                  className="fm-tasks-secondary-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button type="submit" className="fm-tasks-primary-button">
                  {editing ? "Save changes" : "Create task"}
                  <Icon name={editing ? "check" : "arrow"} size={16} />
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="fm-tasks-workspace" aria-label="Your tasks">
        <div className="fm-tasks-section-heading">
          <div>
            <span className="fm-tasks-kicker">STAY ON TRACK</span>
            <h2>Your tasks</h2>
            <p>
              {filteredTasks.length} shown · {completedCount} of {tasks.length}{" "}
              completed
            </p>
          </div>
        </div>

        <div
          className="fm-tasks-quick-filters"
          role="group"
          aria-label="Quick task filters"
        >
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`fm-tasks-quick-filter ${
                smartFilter === filter.id ? "active" : ""
              }`}
              aria-pressed={smartFilter === filter.id}
              onClick={() => handleQuickFilter(filter.id)}
            >
              {filter.label}
              <span>{countForFilter(filter.id)}</span>
            </button>
          ))}
        </div>

        <div className="fm-tasks-toolbar">
          <div className="fm-tasks-search-wrap">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="Search tasks"
              placeholder="Search your tasks..."
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({
                  search: event.target.value,
                })
              }
            />
          </div>

          <button
            type="button"
            className={`fm-tasks-filter-button ${
              advancedFiltersOpen || hasAdvancedFilters ? "active" : ""
            }`}
            onClick={() => setAdvancedFiltersOpen((value) => !value)}
            aria-expanded={advancedFiltersOpen}
          >
            <Icon name="filter" size={17} />
            Filters
            {hasAdvancedFilters && (
              <span className="fm-tasks-active-indicator" />
            )}
          </button>
        </div>

        {advancedFiltersOpen && (
          <div className="fm-tasks-advanced-filters">
            <div className="fm-tasks-filter-field">
              <span className="fm-tasks-field-label">Status</span>
              <CustomSelect
                ariaLabel="Filter tasks by status"
                value={filters.status}
                options={[
                  { value: "all", label: "All statuses" },
                  ...STATUS_OPTIONS,
                ]}
                onChange={(value) => onFiltersChange({ status: value })}
              />
            </div>

            <div className="fm-tasks-filter-field">
              <span className="fm-tasks-field-label">Project</span>
              <CustomSelect
                ariaLabel="Filter tasks by project"
                value={filters.project}
                options={filterProjectOptions}
                onChange={(value) => onFiltersChange({ project: value })}
              />
            </div>

            <div className="fm-tasks-filter-field">
              <span className="fm-tasks-field-label">Sort by</span>
              <CustomSelect
                ariaLabel="Sort tasks"
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(value) =>
                  onFiltersChange({
                    sort: value as TaskSort,
                  })
                }
              />
            </div>

            <button
              type="button"
              className="fm-tasks-reset-filters"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        )}

        {filteredTasks.length === 0 ? (
          <div className="fm-tasks-empty">
            <div className="fm-tasks-empty-icon">
              <Icon name="list" size={24} />
            </div>

            <h3>
              {tasks.length === 0 ? "A fresh start." : "No matching tasks."}
            </h3>

            <p>
              {tasks.length === 0
                ? "Create your first task and start making progress."
                : "Try adjusting your search or filters."}
            </p>

            <button
              type="button"
              className={
                tasks.length === 0
                  ? "fm-tasks-primary-button"
                  : "fm-tasks-secondary-button"
              }
              onClick={tasks.length === 0 ? openCreateForm : resetFilters}
            >
              {tasks.length === 0 ? "Create a task" : "Clear filters"}
            </button>
          </div>
        ) : showGroups ? (
          <div className="fm-tasks-groups">
            {renderGroup(
              "In progress",
              groupedTasks.inProgress,
              "What you're working on",
            )}
            {renderGroup("To do", groupedTasks.todo, "Ready when you are")}
            {renderGroup("Completed", groupedTasks.completed, "Finished tasks")}
          </div>
        ) : (
          <div className="fm-tasks-list fm-tasks-list-flat">
            {filteredTasks.map(renderTask)}
          </div>
        )}
      </section>
    </main>
  );
}

export default Tasks;
