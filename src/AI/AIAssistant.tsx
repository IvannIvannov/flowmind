import { useMemo, useState } from "react";

import type { Priority, Project, Task } from "../types";

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

type CaptureMode = "quick" | "assistant";

interface ReviewTask extends SuggestedTask {
  allowDuplicate: boolean;
}

const EXAMPLE_TEXT = `Да монтирам рийла за Мазу до петък
Да изпратя имейлите за Radapola утре
Да подготвя контент план за следващата седмица`;

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function makeReviewTask(task: SuggestedTask): ReviewTask {
  return {
    ...task,
    allowDuplicate: false,
  };
}

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

  const selectedCount = reviewTasks.filter((task) => task.selected).length;

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
  }

  function resetReview() {
    setReviewTasks([]);
    setWarnings([]);
    setAnalyzedSections(0);
    setHasAnalyzed(false);
    setError("");
    setSuccessCount(0);
  }

  function changeMode(next: CaptureMode) {
    setMode(next);
    resetReview();
  }

  function useExample() {
    setInput(EXAMPLE_TEXT);
    resetReview();
  }

  function clearInput() {
    setInput("");
    resetReview();
  }

  async function analyzeTasks() {
    const source = input.trim();

    if (!source || loading) {
      return;
    }

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
          "No tasks could be extracted. Try writing " + "one action per line.",
        );
      }
    } catch (cause) {
      console.error("FlowMind: task extraction failed", cause);

      setError(
        "Could not analyze your text. " +
          "Check the local AI service and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function getProjectName(projectId: string): string {
    return (
      projects.find((project) => project.id === projectId)?.name ?? "No Project"
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
      if (!task.selected) {
        continue;
      }

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
        exact++;
      } else if (hasSimilar) {
        similar++;
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
        "No tasks were saved. Review the " +
          "duplicate warnings or allow specific duplicates.",
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
        `${skipped.length} possible duplicate(s) ` +
          "were left in the review list.",
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

  return (
    <div className="fm-ai">
      <header className="fm-ai-header">
        <p className="fm-ai-eyebrow">SMART TASK CAPTURE</p>

        <h1>AI Assistant ✨</h1>

        <p className="fm-ai-description">
          Turn your notes, ideas and task lists into organized, actionable
          tasks.
        </p>
      </header>

      <section className="fm-ai-panel">
        <div className="fm-ai-tabs" role="group" aria-label="Task capture mode">
          <button
            type="button"
            className={mode === "quick" ? "active" : ""}
            aria-pressed={mode === "quick"}
            onClick={() => changeMode("quick")}
          >
            📥 Smart Task Inbox
          </button>

          <button
            type="button"
            className={mode === "assistant" ? "active" : ""}
            aria-pressed={mode === "assistant"}
            onClick={() => changeMode("assistant")}
          >
            ✨ AI Assistant
          </button>
        </div>

        <div className="fm-ai-panel-heading">
          <div>
            <h2>{mode === "quick" ? "Quick Capture" : "Analyze Your Notes"}</h2>

            <p>
              {mode === "quick"
                ? "Paste multiple tasks at once. One task per line works best."
                : "Describe your work naturally and let local AI extract the actions."}
            </p>
          </div>

          <span className="fm-ai-local-badge">Local AI</span>
        </div>

        <label className="fm-ai-input-label" htmlFor="fm-ai-input">
          {mode === "quick" ? "Your task list" : "Your notes or instructions"}
        </label>

        <textarea
          id="fm-ai-input"
          className="fm-ai-textarea"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);

            if (hasAnalyzed) {
              setHasAnalyzed(false);
              setReviewTasks([]);
              setSuccessCount(0);
              setError("");
            }
          }}
          rows={mode === "quick" ? 9 : 7}
          placeholder={
            mode === "quick"
              ? "Write or paste tasks here...\n\nPrepare content plan for Mazu\nSend brand emails tomorrow\nEdit three reels by Friday"
              : "Write your notes, meeting summary or work instructions..."
          }
          disabled={loading}
        />

        <div className="fm-ai-input-footer">
          <span>
            {input.trim()
              ? `${
                  input
                    .trim()
                    .split(/\r?\n/)
                    .filter((line) => line.trim()).length
                } non-empty line(s)`
              : "Everything stays on your device."}
          </span>

          <span>{input.length} characters</span>
        </div>

        <div className="fm-ai-actions">
          <button
            type="button"
            className="fm-ai-primary"
            disabled={loading || input.trim().length === 0}
            onClick={analyzeTasks}
          >
            {loading
              ? "Analyzing..."
              : mode === "quick"
                ? "✨ Organize Tasks"
                : "✨ Extract Tasks"}
          </button>

          <button
            type="button"
            className="fm-ai-secondary"
            disabled={loading}
            onClick={useExample}
          >
            Use Example
          </button>

          <button
            type="button"
            className="fm-ai-secondary"
            disabled={loading}
            onClick={clearInput}
          >
            Clear
          </button>
        </div>
      </section>

      {loading && (
        <div className="fm-ai-message" role="status">
          ✨ Analyzing your text and preparing an editable task list...
        </div>
      )}

      {warnings.length > 0 && (
        <section className="fm-ai-warnings">
          <h3>Analysis Notes</h3>

          {warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      )}

      {error && (
        <div className="fm-ai-error" role="alert">
          {error}
        </div>
      )}

      {successCount > 0 && (
        <div className="fm-ai-success" role="status">
          ✓ {successCount} task(s) saved successfully.
          <button type="button" onClick={onOpenTasks}>
            View Tasks
          </button>
        </div>
      )}

      {(hasAnalyzed || reviewTasks.length > 0) && (
        <section className="fm-ai-panel">
          <div className="fm-ai-review-header">
            <div>
              <p className="fm-ai-eyebrow">REVIEW BEFORE SAVING</p>

              <h2>Task Review ({reviewTasks.length})</h2>

              <p>Check titles, projects, priorities and deadlines.</p>
            </div>

            <span className="fm-ai-review-count">{selectedCount} selected</span>
          </div>

          {analyzedSections > 0 && (
            <p className="fm-ai-analysis-info">
              Analyzed {analyzedSections} section(s). You can edit every
              suggestion.
            </p>
          )}

          {reviewTasks.length > 0 && (
            <div className="fm-ai-review-toolbar">
              <button type="button" onClick={selectAll}>
                Select All
              </button>

              <button type="button" onClick={deselectAll}>
                Deselect All
              </button>

              <button type="button" onClick={addManualReviewTask}>
                + Add Task
              </button>
            </div>
          )}

          {reviewSummary.exact + reviewSummary.similar > 0 && (
            <div className="fm-ai-duplicate-summary">
              ⚠️ Possible duplicates: {reviewSummary.exact} exact,{" "}
              {reviewSummary.similar} similar. Review them before saving.
            </div>
          )}

          <div className="fm-ai-review-list">
            {reviewTasks.map((task, index) => {
              const duplicate = duplicateInfo(task);

              const firstMatchingTask = duplicate.matches[0]?.task;

              const originalExists = firstMatchingTask
                ? existingTaskIds.has(firstMatchingTask.id)
                : false;

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

                      <span>Task {index + 1}</span>
                    </label>

                    <div className="fm-ai-item-actions">
                      <span
                        className={`fm-ai-origin ${
                          task.origin === "ai" ? "ai" : ""
                        }`}
                      >
                        {task.origin === "ai" ? "AI" : "Fallback"}
                      </span>

                      <button
                        type="button"
                        className="fm-ai-remove"
                        aria-label={`Remove task ${index + 1}`}
                        onClick={() => removeReviewTask(task.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="fm-ai-review-fields">
                    <div className="fm-ai-field fm-ai-title-field">
                      <label htmlFor={`fm-ai-title-${task.id}`}>
                        Task Title
                      </label>

                      <input
                        id={`fm-ai-title-${task.id}`}
                        type="text"
                        maxLength={200}
                        value={task.title}
                        onChange={(event) =>
                          updateReviewTask(task.id, {
                            title: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="fm-ai-field">
                      <label htmlFor={`fm-ai-project-${task.id}`}>
                        Project
                      </label>

                      <select
                        id={`fm-ai-project-${task.id}`}
                        value={task.projectId}
                        onChange={(event) =>
                          updateReviewTask(task.id, {
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

                    <div className="fm-ai-field">
                      <label htmlFor={`fm-ai-priority-${task.id}`}>
                        Priority
                      </label>

                      <select
                        id={`fm-ai-priority-${task.id}`}
                        value={task.priority}
                        onChange={(event) =>
                          updateReviewTask(task.id, {
                            priority: event.target.value as Priority,
                          })
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div className="fm-ai-field">
                      <label htmlFor={`fm-ai-date-${task.id}`}>Due Date</label>

                      <input
                        id={`fm-ai-date-${task.id}`}
                        type="date"
                        value={task.dueDate}
                        onChange={(event) =>
                          updateReviewTask(task.id, {
                            dueDate: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {task.sourceText && (
                    <div className="fm-ai-source">
                      <span>Original text</span>
                      <p>{task.sourceText}</p>
                    </div>
                  )}

                  {duplicate.level && (
                    <div className={`fm-ai-duplicate ${duplicate.level}`}>
                      <strong>
                        {duplicate.level === "exact"
                          ? "⚠️ Exact duplicate"
                          : "⚠️ Possible duplicate"}
                      </strong>

                      <p>
                        {firstMatchingTask && originalExists
                          ? `Similar existing task: "${firstMatchingTask.title}".`
                          : duplicate.batchMatches.length > 0
                            ? "A similar task appears elsewhere in this batch."
                            : `A similar task already exists in ${getProjectName(task.projectId)}.`}
                      </p>

                      <label>
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

          <div className="fm-ai-review-footer">
            <div>
              <strong>{selectedCount} task(s) selected</strong>

              <span>Duplicates are skipped unless you allow them.</span>
            </div>

            <button
              type="button"
              className="fm-ai-primary"
              disabled={selectedCount === 0 || loading}
              onClick={saveSelectedTasks}
            >
              ✓ Save Selected Tasks
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default AIAssistant;
