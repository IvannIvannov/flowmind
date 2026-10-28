import { useEffect, useMemo, useRef, useState } from "react";

import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

import type { Priority, Project, Task } from "../types";

import { getTodayKey, parseDateKey, toDateKey } from "../utils/dates";

import { extractTasksWithOllama } from "../services/ollama";

import type { SuggestedTask } from "../services/ollama";

import { findTaskDuplicates } from "../services/taskDuplicates";

import "./AIAssistant.css";

export interface AssistantTaskDraft {
  title: string;
  priority: Priority;
  dueDate: string;
  projectId: string;
}

interface AIAssistantProps {
  projects: Project[];
  tasks: Task[];
  onCreateTask: (draft: AssistantTaskDraft) => void;
  onOpenTasks: () => void;
}

interface ReviewTask extends SuggestedTask {
  allowDuplicate: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

type CaptureMode = "quick" | "assistant";

type IconName =
  | "sparkles"
  | "list"
  | "arrow"
  | "plus"
  | "trash"
  | "check"
  | "close"
  | "warning"
  | "info"
  | "file"
  | "calendar"
  | "chevron"
  | "chevron-left"
  | "chevron-right";

const EXAMPLE_TEXT = `Да монтирам рийла за Мазу до петък
Да изпратя имейлите за Radapola утре
Да подготвя контент план за следващата седмица`;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    sparkles: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14" />
        <path d="M10 10v6M14 10v6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 5" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v6h6M8 13h8M8 17h6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
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

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function makeReviewTask(task: SuggestedTask): ReviewTask {
  return {
    ...task,
    allowDuplicate: false,
  };
}

/* CUSTOM SELECT */

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
  priority?: boolean;
}

function CustomSelect({
  value,
  options,
  onChange,
  label,
  priority = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentIndex = options.findIndex((option) => option.value === value);

  const selected = options[currentIndex];

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

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      if (!options.length) return;

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const index = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = (index + direction + options.length) % options.length;

      onChange(options[nextIndex].value);
    }
  }

  return (
    <div
      className={`fm-ai-custom-select ${open ? "is-open" : ""}`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="fm-ai-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={handleKeyDown}
      >
        <span className="fm-ai-select-value">
          {priority && (
            <span
              className={`fm-ai-priority-dot is-${value}`}
              aria-hidden="true"
            />
          )}
          <span>{selected?.label ?? "Select"}</span>
        </span>

        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <div className="fm-ai-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`fm-ai-select-option ${
                option.value === value ? "is-selected" : ""
              }`}
              onClick={() => selectValue(option.value)}
            >
              {priority && (
                <span
                  className={`fm-ai-priority-dot is-${option.value}`}
                  aria-hidden="true"
                />
              )}

              <span className="fm-ai-option-text">{option.label}</span>

              {option.value === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* CUSTOM DATE PICKER */

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function CustomDatePicker({ value, onChange, label }: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);

  const [viewDate, setViewDate] = useState(() => {
    const date = parseDateKey(value) ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function togglePicker() {
    if (!open) {
      const date = parseDateKey(value) ?? new Date();

      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    setOpen((previous) => !previous);
  }

  function navigateMonth(direction: number) {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );
  }

  function chooseDate(date: string) {
    onChange(date);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

    const totalDays = new Date(year, month + 1, 0).getDate();

    const count = Math.ceil((firstWeekday + totalDays) / 7) * 7;

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

  const selectedDate = parseDateKey(value);

  const displayDate = selectedDate
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(selectedDate)
    : "Choose date";

  return (
    <div
      ref={containerRef}
      className={`fm-ai-datepicker ${open ? "is-open" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="fm-ai-date-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={togglePicker}
      >
        <span className="fm-ai-date-value">
          <Icon name="calendar" size={15} />
          <span className={!value ? "is-placeholder" : ""}>{displayDate}</span>
        </span>

        <Icon name="chevron" size={15} />
      </button>

      {open && (
        <div className="fm-ai-date-popover" role="dialog" aria-label={label}>
          <div className="fm-ai-date-header">
            <strong>{monthTitle}</strong>

            <div className="fm-ai-date-navigation">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => navigateMonth(-1)}
              >
                <Icon name="chevron-left" size={17} />
              </button>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => navigateMonth(1)}
              >
                <Icon name="chevron-right" size={17} />
              </button>
            </div>
          </div>

          <div className="fm-ai-date-grid">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="fm-ai-date-weekday">
                {weekday}
              </span>
            ))}

            {calendarDays.map((day) => (
              <button
                type="button"
                key={day.key}
                className={[
                  "fm-ai-date-day",
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

          <div className="fm-ai-date-footer">
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

/* AI ASSISTANT */

function AIAssistant({
  projects,
  tasks,
  onCreateTask,
  onOpenTasks,
}: AIAssistantProps) {
  const [mode, setMode] = useState<CaptureMode>("quick");

  const [input, setInput] = useState("");
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);

  const [warnings, setWarnings] = useState<string[]>([]);

  const [analyzedSections, setAnalyzedSections] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const [expandedSources, setExpandedSources] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCount = reviewTasks.filter((task) => task.selected).length;

  const lineCount = input.split(/\r?\n/).filter((line) => line.trim()).length;

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

  const existingTaskIds = useMemo(
    () => new Set(tasks.map((task) => task.id)),
    [tasks],
  );

  function updateReviewTask(id: string, changes: Partial<ReviewTask>) {
    setReviewTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );

    setSuccessCount(0);
  }

  function removeReviewTask(id: string) {
    setReviewTasks((previous) => previous.filter((task) => task.id !== id));

    setExpandedSources((previous) => previous.filter((item) => item !== id));
  }

  function resetReview() {
    setReviewTasks([]);
    setWarnings([]);
    setAnalyzedSections(0);
    setHasAnalyzed(false);
    setError("");
    setSuccessCount(0);
    setExpandedSources([]);
  }

  function changeMode(next: CaptureMode) {
    if (loading || next === mode) return;

    setMode(next);
    resetReview();
  }

  function useExample() {
    if (loading) return;

    setInput(EXAMPLE_TEXT);
    resetReview();
    textareaRef.current?.focus();
  }

  function clearInput() {
    if (loading) return;

    setInput("");
    resetReview();
    textareaRef.current?.focus();
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);

    if (hasAnalyzed || successCount > 0 || error) {
      resetReview();
    }
  }

  async function analyzeTasks() {
    const source = input.trim();

    if (!source || loading) return;

    setLoading(true);
    setError("");
    setSuccessCount(0);
    setWarnings([]);
    setReviewTasks([]);
    setHasAnalyzed(false);

    try {
      const result = await extractTasksWithOllama(source, projects);

      const uniqueIds = new Set<string>();

      const prepared = result.tasks.map((task) => {
        let id = task.id || crypto.randomUUID();

        if (uniqueIds.has(id)) {
          id = crypto.randomUUID();
        }

        uniqueIds.add(id);

        return makeReviewTask({
          ...task,
          id,
          selected: task.selected ?? true,
        });
      });

      setReviewTasks(prepared);
      setWarnings(result.warnings);
      setAnalyzedSections(result.analyzedSections);
      setHasAnalyzed(true);

      if (prepared.length === 0) {
        setError(
          "No tasks could be extracted. Try writing one action per line.",
        );
      }
    } catch (cause) {
      console.error("FlowMind: task extraction failed", cause);

      setError(
        "Could not analyze your text. Check the local AI service and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function getProjectName(projectId: string) {
    return (
      projects.find((project) => project.id === projectId)?.name ?? "No project"
    );
  }

  function duplicateInfo(task: ReviewTask) {
    const matches = findTaskDuplicates(
      {
        title: task.title,
        projectId: task.projectId || undefined,
        dueDate: task.dueDate || undefined,
      },
      tasks,
    );

    const exact = matches.filter((match) => match.level === "exact");

    const similar = matches.filter((match) => match.level === "similar");

    const batchMatches = reviewTasks.filter(
      (other) =>
        other.id !== task.id &&
        other.selected &&
        normalizedTitle(other.title) === normalizedTitle(task.title) &&
        other.projectId === task.projectId,
    );

    const sameDateInBatch = batchMatches.some(
      (other) => (other.dueDate || "") === (task.dueDate || ""),
    );

    const level =
      exact.length > 0 || sameDateInBatch
        ? "exact"
        : similar.length > 0 || batchMatches.length > 0
          ? "similar"
          : null;

    return {
      level,
      matches,
      batchMatches,
    };
  }

  const reviewSummary = useMemo(() => {
    let exact = 0;
    let similar = 0;

    for (const task of reviewTasks) {
      if (!task.selected) continue;

      const matches = findTaskDuplicates(
        {
          title: task.title,
          projectId: task.projectId || undefined,
          dueDate: task.dueDate || undefined,
        },
        tasks,
      );

      const otherMatches = reviewTasks.filter(
        (other) =>
          other.id !== task.id &&
          other.selected &&
          normalizedTitle(other.title) === normalizedTitle(task.title) &&
          other.projectId === task.projectId,
      );

      const hasExact =
        matches.some((match) => match.level === "exact") ||
        otherMatches.some(
          (other) => (other.dueDate || "") === (task.dueDate || ""),
        );

      const hasSimilar =
        matches.some((match) => match.level === "similar") ||
        otherMatches.length > 0;

      if (hasExact) {
        exact += 1;
      } else if (hasSimilar) {
        similar += 1;
      }
    }

    return { exact, similar };
  }, [reviewTasks, tasks]);

  function selectAll() {
    setReviewTasks((previous) =>
      previous.map((task) => ({
        ...task,
        selected: true,
      })),
    );
  }

  function deselectAll() {
    setReviewTasks((previous) =>
      previous.map((task) => ({
        ...task,
        selected: false,
      })),
    );
  }

  function saveSelectedTasks() {
    const selected = reviewTasks.filter(
      (task) => task.selected && task.title.trim().length > 0,
    );

    if (selected.length === 0) {
      setError("Select at least one task to save.");
      return;
    }

    const accepted: ReviewTask[] = [];
    const skipped: ReviewTask[] = [];

    for (const task of selected) {
      const existingMatches = findTaskDuplicates(
        {
          title: task.title,
          projectId: task.projectId || undefined,
          dueDate: task.dueDate || undefined,
        },
        tasks,
      );

      const matchesAccepted = accepted.some(
        (other) =>
          normalizedTitle(other.title) === normalizedTitle(task.title) &&
          other.projectId === task.projectId,
      );

      const isDuplicate = existingMatches.length > 0 || matchesAccepted;

      if (isDuplicate && !task.allowDuplicate) {
        skipped.push(task);
        continue;
      }

      accepted.push(task);
    }

    if (accepted.length === 0) {
      setError(
        "No tasks were saved. Review the duplicate warnings or allow specific duplicates.",
      );
      return;
    }

    for (const task of accepted) {
      onCreateTask({
        title: task.title.trim(),
        priority: task.priority,
        dueDate: task.dueDate || "",
        projectId: task.projectId || "",
      });
    }

    const savedIds = new Set(accepted.map((task) => task.id));

    setReviewTasks((previous) =>
      previous.filter((task) => !savedIds.has(task.id)),
    );

    setSuccessCount(accepted.length);

    if (skipped.length > 0) {
      setError(
        `${skipped.length} possible duplicate(s) were left in the review list.`,
      );
    } else {
      setError("");
    }
  }

  function addManualReviewTask() {
    const task: ReviewTask = {
      id: crypto.randomUUID(),
      title: "",
      priority: "medium",
      dueDate: "",
      projectId: "",
      selected: true,
      sourceText: "",
      origin: "fallback",
      allowDuplicate: false,
    };

    setReviewTasks((previous) => [...previous, task]);

    setHasAnalyzed(true);
    setSuccessCount(0);
  }

  function toggleSource(id: string) {
    setExpandedSources((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }

  return (
    <main className="fm-ai">
      {/* HEADER */}

      <header className="fm-ai-header">
        <div>
          <p className="fm-ai-eyebrow">YOUR INTELLIGENT WORKSPACE</p>

          <h1>
            AI Assistant<span>.</span>
          </h1>

          <p className="fm-ai-description">
            Turn scattered notes into clear, actionable tasks.
          </p>
        </div>

        <div className="fm-ai-local-badge">
          <span className="fm-ai-local-dot" />
          Local AI
        </div>
      </header>

      {/* CAPTURE */}

      <section className="fm-ai-capture">
        <div className="fm-ai-tabs" role="group" aria-label="Task capture mode">
          <button
            type="button"
            className={mode === "quick" ? "active" : ""}
            aria-pressed={mode === "quick"}
            onClick={() => changeMode("quick")}
            disabled={loading}
          >
            <Icon name="list" size={16} />
            Smart Task Inbox
          </button>

          <button
            type="button"
            className={mode === "assistant" ? "active" : ""}
            aria-pressed={mode === "assistant"}
            onClick={() => changeMode("assistant")}
            disabled={loading}
          >
            <Icon name="sparkles" size={16} />
            AI Assistant
          </button>
        </div>

        <div className="fm-ai-capture-heading">
          <div>
            <span className="fm-ai-kicker">
              {mode === "quick" ? "QUICK CAPTURE" : "SMART EXTRACTION"}
            </span>

            <h2>
              {mode === "quick"
                ? "Everything on your mind."
                : "Let AI find the action."}
            </h2>

            <p>
              {mode === "quick"
                ? "Paste your task list. FlowMind will organize it for you."
                : "Paste meeting notes, ideas or instructions to extract tasks."}
            </p>
          </div>

          <span className="fm-ai-step-number">01 / CAPTURE</span>
        </div>

        <label className="fm-ai-input-label" htmlFor="fm-ai-input">
          {mode === "quick" ? "Your tasks" : "Your notes"}
        </label>

        <div className="fm-ai-input-shell">
          <textarea
            ref={textareaRef}
            id="fm-ai-input"
            className="fm-ai-textarea"
            value={input}
            onChange={handleInputChange}
            rows={mode === "quick" ? 8 : 7}
            placeholder={
              mode === "quick"
                ? "Write or paste your tasks here...\n\nPrepare the content plan\nSend brand emails tomorrow\nEdit three reels by Friday"
                : "Paste your meeting notes, brainstorm or work instructions here..."
            }
            disabled={loading}
          />

          <div className="fm-ai-input-footer">
            <span>
              <Icon name="file" size={14} />
              {input.trim()
                ? `${lineCount} non-empty lines`
                : "Processed with local AI"}
            </span>

            <span>{input.length} characters</span>
          </div>
        </div>

        <div className="fm-ai-actions">
          <button
            type="button"
            className="fm-ai-primary"
            disabled={loading || !input.trim()}
            onClick={analyzeTasks}
          >
            {loading ? (
              <>
                <span className="fm-ai-spinner" />
                Analyzing...
              </>
            ) : (
              <>
                <Icon name="sparkles" size={17} />
                {mode === "quick" ? "Organize tasks" : "Extract tasks"}
                <Icon name="arrow" size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            className="fm-ai-secondary"
            disabled={loading}
            onClick={useExample}
          >
            Use example
          </button>

          <button
            type="button"
            className="fm-ai-clear"
            disabled={loading || !input}
            onClick={clearInput}
          >
            Clear
          </button>
        </div>
      </section>

      {/* FEEDBACK */}

      {loading && (
        <div className="fm-ai-message" role="status">
          <span className="fm-ai-spinner" />
          Analyzing your text and preparing an editable task list...
        </div>
      )}

      {warnings.length > 0 && (
        <section className="fm-ai-warnings">
          <div className="fm-ai-notice-heading">
            <Icon name="info" size={17} />
            <h3>Analysis notes</h3>
          </div>

          {warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      )}

      {error && (
        <div className="fm-ai-error" role="alert">
          <Icon name="warning" size={18} />
          <span>{error}</span>
        </div>
      )}

      {successCount > 0 && (
        <div className="fm-ai-success" role="status">
          <div>
            <Icon name="check" size={18} />
            <span>
              {successCount} {successCount === 1 ? "task saved" : "tasks saved"}{" "}
              successfully.
            </span>
          </div>

          <button type="button" onClick={onOpenTasks}>
            View tasks
            <Icon name="arrow" size={15} />
          </button>
        </div>
      )}

      {/* REVIEW */}

      {(hasAnalyzed || reviewTasks.length > 0) && (
        <section className="fm-ai-review">
          <div className="fm-ai-review-header">
            <div>
              <span className="fm-ai-kicker">02 / REVIEW</span>

              <h2>
                Review suggestions
                <span className="fm-ai-total-count">{reviewTasks.length}</span>
              </h2>

              <p>Refine the details before adding tasks to FlowMind.</p>
            </div>

            <span className="fm-ai-review-count">{selectedCount} selected</span>
          </div>

          {analyzedSections > 0 && (
            <p className="fm-ai-analysis-info">
              <Icon name="info" size={15} />
              Analyzed {analyzedSections}{" "}
              {analyzedSections === 1 ? "section" : "sections"}. All suggestions
              are editable.
            </p>
          )}

          <div className="fm-ai-review-toolbar">
            <div className="fm-ai-selection-actions">
              <button
                type="button"
                onClick={selectAll}
                disabled={reviewTasks.length === 0}
              >
                Select all
              </button>

              <button
                type="button"
                onClick={deselectAll}
                disabled={reviewTasks.length === 0}
              >
                Deselect all
              </button>
            </div>

            <button
              type="button"
              className="fm-ai-manual-add"
              onClick={addManualReviewTask}
            >
              <Icon name="plus" size={15} />
              Add task
            </button>
          </div>

          {reviewSummary.exact + reviewSummary.similar > 0 && (
            <div className="fm-ai-duplicate-summary">
              <Icon name="warning" size={17} />

              <span>
                Possible duplicates:{" "}
                <strong>{reviewSummary.exact} exact</strong>,{" "}
                <strong>{reviewSummary.similar} similar</strong>. Review before
                saving.
              </span>
            </div>
          )}

          {reviewTasks.length === 0 ? (
            <div className="fm-ai-review-empty">
              <Icon name="list" size={24} />
              <h3>No suggestions to review</h3>
              <p>Add a task manually or analyze another note.</p>
            </div>
          ) : (
            <div className="fm-ai-review-list">
              {reviewTasks.map((task, index) => {
                const duplicate = duplicateInfo(task);

                const firstMatchingTask = duplicate.matches[0]?.task;

                const originalExists = firstMatchingTask
                  ? existingTaskIds.has(firstMatchingTask.id)
                  : false;

                const sourceOpen = expandedSources.includes(task.id);

                return (
                  <article
                    key={task.id}
                    className={`fm-ai-review-item ${
                      task.selected ? "selected" : ""
                    }`}
                  >
                    <div className="fm-ai-review-item-top">
                      <label className="fm-ai-select-task">
                        <input
                          type="checkbox"
                          checked={task.selected}
                          onChange={(event) =>
                            updateReviewTask(task.id, {
                              selected: event.target.checked,
                            })
                          }
                        />

                        <span className="fm-ai-checkbox-mark">
                          <Icon name="check" size={13} />
                        </span>

                        <span>Task {index + 1}</span>
                      </label>

                      <div className="fm-ai-item-actions">
                        <span className="fm-ai-origin">
                          {task.origin === "ai" ? "AI extracted" : "Fallback"}
                        </span>

                        <button
                          type="button"
                          className="fm-ai-remove"
                          aria-label={`Remove task ${index + 1}`}
                          title="Remove suggestion"
                          onClick={() => removeReviewTask(task.id)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="fm-ai-review-fields">
                      <div className="fm-ai-field fm-ai-title-field">
                        <label htmlFor={`fm-ai-title-${task.id}`}>
                          Task name
                        </label>

                        <input
                          id={`fm-ai-title-${task.id}`}
                          type="text"
                          maxLength={200}
                          value={task.title}
                          placeholder="Task title"
                          onChange={(event) =>
                            updateReviewTask(task.id, {
                              title: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="fm-ai-field">
                        <span className="fm-ai-field-label">Project</span>

                        <CustomSelect
                          label={`Project for task ${index + 1}`}
                          value={task.projectId || ""}
                          options={projectOptions}
                          onChange={(value) =>
                            updateReviewTask(task.id, {
                              projectId: value,
                            })
                          }
                        />
                      </div>

                      <div className="fm-ai-field">
                        <span className="fm-ai-field-label">Priority</span>

                        <CustomSelect
                          label={`Priority for task ${index + 1}`}
                          value={task.priority}
                          options={PRIORITY_OPTIONS}
                          priority
                          onChange={(value) =>
                            updateReviewTask(task.id, {
                              priority: value as Priority,
                            })
                          }
                        />
                      </div>

                      <div className="fm-ai-field">
                        <span className="fm-ai-field-label">Due date</span>

                        <CustomDatePicker
                          label={`Due date for task ${index + 1}`}
                          value={task.dueDate || ""}
                          onChange={(value) =>
                            updateReviewTask(task.id, {
                              dueDate: value,
                            })
                          }
                        />
                      </div>
                    </div>

                    {task.sourceText && (
                      <div className="fm-ai-source">
                        <button
                          type="button"
                          className="fm-ai-source-toggle"
                          aria-expanded={sourceOpen}
                          onClick={() => toggleSource(task.id)}
                        >
                          <span>
                            <Icon name="file" size={15} />
                            Original text
                          </span>

                          <span className={sourceOpen ? "is-open" : ""}>
                            <Icon name="chevron" size={15} />
                          </span>
                        </button>

                        {sourceOpen && <p>{task.sourceText}</p>}
                      </div>
                    )}

                    {duplicate.level && (
                      <div className={`fm-ai-duplicate ${duplicate.level}`}>
                        <div className="fm-ai-duplicate-heading">
                          <Icon name="warning" size={16} />

                          <strong>
                            {duplicate.level === "exact"
                              ? "Exact duplicate"
                              : "Possible duplicate"}
                          </strong>
                        </div>

                        <p>
                          {firstMatchingTask && originalExists
                            ? `Similar existing task: "${firstMatchingTask.title}".`
                            : duplicate.batchMatches.length > 0
                              ? "A similar task appears elsewhere in this batch."
                              : `A similar task already exists in ${getProjectName(
                                  task.projectId,
                                )}.`}
                        </p>

                        <label className="fm-ai-allow-duplicate">
                          <input
                            type="checkbox"
                            checked={task.allowDuplicate}
                            onChange={(event) =>
                              updateReviewTask(task.id, {
                                allowDuplicate: event.target.checked,
                              })
                            }
                          />
                          Save anyway
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {reviewTasks.length > 0 && (
            <div className="fm-ai-review-footer">
              <div>
                <strong>
                  {selectedCount}{" "}
                  {selectedCount === 1 ? "task selected" : "tasks selected"}
                </strong>

                <span>
                  Possible duplicates are skipped unless you allow them.
                </span>
              </div>

              <button
                type="button"
                className="fm-ai-primary"
                disabled={selectedCount === 0 || loading}
                onClick={saveSelectedTasks}
              >
                <Icon name="check" size={17} />
                Save selected tasks
                <Icon name="arrow" size={16} />
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default AIAssistant;
