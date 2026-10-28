import { useMemo, useRef, useState } from "react";

import type { Priority, Project, Task } from "../types";

import { extractTasksWithOllama } from "../services/ollama";

import type { SuggestedTask } from "../services/ollama";

import { findTaskDuplicates } from "../services/taskDuplicates";

import type { DuplicateMatch } from "../services/taskDuplicates";

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

interface ReviewedTask extends SuggestedTask {
  duplicateOverride: boolean;
}

function getBestMatch(
  task: ReviewedTask,
  existingTasks: Task[],
): DuplicateMatch | null {
  return (
    findTaskDuplicates(
      {
        title: task.title,
        projectId: task.projectId,
        dueDate: task.dueDate,
      },
      existingTasks,
    )[0] ?? null
  );
}

function AIAssistant({
  projects,
  tasks,
  onCreateTask,
  onOpenTasks,
}: AIAssistantProps) {
  const [note, setNote] = useState("");
  const [suggestions, setSuggestions] = useState<ReviewedTask[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyzedSections, setAnalyzedSections] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const savingRef = useRef(false);

  const review = useMemo(
    () =>
      suggestions.map((suggestion) => ({
        suggestion,
        duplicate: getBestMatch(suggestion, tasks),
      })),
    [suggestions, tasks],
  );

  const selectedCount = review.filter(
    ({ suggestion, duplicate }) =>
      suggestion.selected &&
      (!duplicate ||
        duplicate.level !== "exact" ||
        suggestion.duplicateOverride),
  ).length;

  const duplicateCount = review.filter(
    ({ duplicate }) => duplicate !== null,
  ).length;

  function updateSuggestion(id: string, changes: Partial<ReviewedTask>) {
    setSuggestions((previous) =>
      previous.map((task) =>
        task.id === id
          ? {
              ...task,
              ...changes,
            }
          : task,
      ),
    );

    setSuccess("");
  }

  function removeSuggestion(id: string) {
    setSuggestions((previous) => previous.filter((task) => task.id !== id));
  }

  async function analyzeNote() {
    if (!note.trim() || analyzing) {
      return;
    }

    setAnalyzing(true);
    setError("");
    setSuccess("");
    setSuggestions([]);
    setWarnings([]);
    setAnalyzedSections(0);

    try {
      const result = await extractTasksWithOllama(note, projects);

      const reviewedTasks: ReviewedTask[] = result.tasks.map((task) => {
        const match = findTaskDuplicates(
          {
            title: task.title,
            projectId: task.projectId,
            dueDate: task.dueDate,
          },
          tasks,
        )[0];

        return {
          ...task,
          selected: match?.level === "exact" ? false : task.selected,
          duplicateOverride: false,
        };
      });

      setSuggestions(reviewedTasks);
      setWarnings(result.warnings);
      setAnalyzedSections(result.analyzedSections);

      if (reviewedTasks.length === 0) {
        setSuccess("No pending tasks were found in this note.");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not analyze the note.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function saveSelectedTasks() {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;

    try {
      const existingAndNew: Task[] = [...tasks];
      const savedIds = new Set<string>();
      const skippedIds = new Set<string>();

      for (const suggestion of suggestions) {
        if (!suggestion.selected) {
          continue;
        }

        const duplicate = findTaskDuplicates(
          {
            title: suggestion.title,
            projectId: suggestion.projectId,
            dueDate: suggestion.dueDate,
          },
          existingAndNew,
        )[0];

        if (duplicate?.level === "exact" && !suggestion.duplicateOverride) {
          skippedIds.add(suggestion.id);
          continue;
        }

        const title = suggestion.title.trim();

        if (!title) {
          skippedIds.add(suggestion.id);
          continue;
        }

        const projectId = projects.some(
          (project) => project.id === suggestion.projectId,
        )
          ? suggestion.projectId
          : "";

        const draft: AssistantTaskDraft = {
          title,
          priority: suggestion.priority,
          dueDate: suggestion.dueDate,
          projectId,
        };

        onCreateTask(draft);

        existingAndNew.push({
          id: crypto.randomUUID(),
          title: draft.title,
          priority: draft.priority,
          dueDate: draft.dueDate || undefined,
          projectId: draft.projectId || undefined,
          status: "todo",
          createdAt: new Date().toISOString(),
        });

        savedIds.add(suggestion.id);
      }

      if (savedIds.size > 0) {
        setSuggestions((previous) =>
          previous.filter((task) => !savedIds.has(task.id)),
        );

        setSuccess(
          `${savedIds.size} task(s) saved successfully.` +
            (skippedIds.size > 0
              ? ` ${skippedIds.size} duplicate or empty task(s) skipped.`
              : ""),
        );
      } else {
        setError(
          "No tasks were saved. Select tasks or review duplicate warnings.",
        );
      }
    } finally {
      savingRef.current = false;
    }
  }

  function selectAll() {
    setSuggestions((previous) =>
      previous.map((task) => ({
        ...task,
        selected: true,
      })),
    );
  }

  function deselectAll() {
    setSuggestions((previous) =>
      previous.map((task) => ({
        ...task,
        selected: false,
      })),
    );
  }

  const fieldStyle = {
    width: "100%",
    padding: "12px 14px",
    background: "#12141d",
    border: "1px solid #383b4d",
    borderRadius: "10px",
    color: "#f8fafc",
    fontFamily: "inherit",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  };

  const buttonStyle = {
    border: "none",
    borderRadius: "10px",
    padding: "11px 16px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
  };

  return (
    <div
      className="fm-ai"
      style={{
        width: "100%",
        minWidth: 0,
        color: "#f8fafc",
      }}
    >
      <header style={{ marginBottom: 30 }}>
        <p
          style={{
            color: "#a78bfa",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          YOUR LOCAL AI WORKSPACE
        </p>

        <h1 style={{ fontSize: 34, margin: "0 0 12px" }}>AI Assistant ✨</h1>

        <p
          style={{
            color: "#989eae",
            lineHeight: 1.6,
          }}
        >
          Turn your notes into organized tasks with automatic deadlines, project
          assignment, and duplicate detection.
        </p>
      </header>

      <section
        style={{
          background: "#1b1d28",
          border: "1px solid #2d3040",
          borderRadius: 18,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Analyze Your Notes</h2>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            "Paste your notes here...\n\n" +
            "Mazu Beach:\n" +
            "Утре да монтирам новия рийл.\n\n" +
            "Юлия Салакина:\n" +
            "В петък да изпратя имейл до брандовете."
          }
          rows={9}
          style={{
            ...fieldStyle,
            resize: "vertical",
            lineHeight: 1.7,
          }}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={analyzeNote}
            disabled={analyzing || !note.trim()}
            style={{
              ...buttonStyle,
              background: "#8b5cf6",
              color: "#fff",
              opacity: analyzing || !note.trim() ? 0.6 : 1,
            }}
          >
            {analyzing ? "Analyzing..." : "✨ Analyze Notes"}
          </button>

          <span
            style={{
              color: "#989eae",
              fontSize: 12,
            }}
          >
            Powered locally by Ollama
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            background: "#3a2530",
            color: "#fecdd3",
            padding: 14,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            background: "#203a32",
            color: "#a7f3d0",
            padding: 14,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      )}

      {warnings.length > 0 && (
        <section
          style={{
            background: "#302a21",
            border: "1px solid #695331",
            borderRadius: 12,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 15 }}>⚠️ Review Warnings</h3>

          <ul
            style={{
              paddingLeft: 20,
              color: "#fcd9a0",
              lineHeight: 1.7,
              fontSize: 13,
              marginBottom: 0,
            }}
          >
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 21,
                }}
              >
                Review Tasks ({suggestions.length})
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#989eae",
                  fontSize: 12,
                }}
              >
                {analyzedSections} sections analyzed
                {" · "}
                {selectedCount} ready to save
                {" · "}
                {duplicateCount} possible duplicate(s)
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={selectAll}
                style={{
                  ...buttonStyle,
                  color: "#fff",
                  background: "#343747",
                }}
              >
                Select All
              </button>

              <button
                type="button"
                onClick={deselectAll}
                style={{
                  ...buttonStyle,
                  color: "#fff",
                  background: "#343747",
                }}
              >
                Deselect All
              </button>
            </div>
          </div>

          {review.map(({ suggestion, duplicate }) => {
            const exactBlocked =
              duplicate?.level === "exact" && !suggestion.duplicateOverride;

            return (
              <article
                key={suggestion.id}
                style={{
                  background: "#1b1d28",
                  border: duplicate ? "1px solid #866633" : "1px solid #2d3040",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={suggestion.selected}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, {
                          selected: event.target.checked,
                        })
                      }
                    />
                    Save this task
                  </label>

                  <span
                    style={{
                      fontSize: 11,
                      background: "#302a45",
                      color: "#d4c7ff",
                      padding: "5px 9px",
                      borderRadius: 7,
                    }}
                  >
                    {suggestion.origin === "ai" ? "AI" : "Fallback"}
                  </span>

                  {duplicate && (
                    <span
                      style={{
                        background: "#49351c",
                        color: "#fcd9a0",
                        fontSize: 11,
                        padding: "5px 9px",
                        borderRadius: 7,
                      }}
                    >
                      ⚠️{" "}
                      {duplicate.level === "exact"
                        ? "Exact duplicate"
                        : "Possible duplicate"}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeSuggestion(suggestion.id)}
                    aria-label="Remove suggestion"
                    style={{
                      ...buttonStyle,
                      marginLeft: "auto",
                      background: "#3a2530",
                      color: "#fecdd3",
                      padding: "8px 12px",
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#a3a8b8",
                      marginBottom: 7,
                    }}
                  >
                    Task Title
                  </label>

                  <input
                    type="text"
                    value={suggestion.title}
                    maxLength={200}
                    onChange={(event) =>
                      updateSuggestion(suggestion.id, {
                        title: event.target.value,
                        duplicateOverride: false,
                      })
                    }
                    style={fieldStyle}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#a3a8b8",
                        fontSize: 12,
                        marginBottom: 7,
                      }}
                    >
                      Project
                    </label>

                    <select
                      value={suggestion.projectId}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, {
                          projectId: event.target.value,
                          duplicateOverride: false,
                        })
                      }
                      style={fieldStyle}
                    >
                      <option value="">No Project</option>

                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#a3a8b8",
                        fontSize: 12,
                        marginBottom: 7,
                      }}
                    >
                      Due Date
                    </label>

                    <input
                      type="date"
                      value={suggestion.dueDate}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, {
                          dueDate: event.target.value,
                          duplicateOverride: false,
                        })
                      }
                      style={fieldStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        color: "#a3a8b8",
                        fontSize: 12,
                        marginBottom: 7,
                      }}
                    >
                      Priority
                    </label>

                    <select
                      value={suggestion.priority}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, {
                          priority: event.target.value as Priority,
                        })
                      }
                      style={fieldStyle}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    background: "#12141d",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: duplicate ? 14 : 0,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#a78bfa",
                      margin: "0 0 6px",
                    }}
                  >
                    ORIGINAL NOTE
                  </p>

                  <p
                    style={{
                      fontSize: 13,
                      color: "#a3a8b8",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {suggestion.sourceText}
                  </p>
                </div>

                {duplicate && (
                  <div
                    style={{
                      background: "#302a21",
                      border: "1px solid #695331",
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fcd9a0",
                      }}
                    >
                      {duplicate.level === "exact"
                        ? "This task appears to already exist."
                        : "A similar task already exists."}
                    </p>

                    <p
                      style={{
                        color: "#ddd0bb",
                        fontSize: 13,
                        margin: "0 0 10px",
                      }}
                    >
                      Existing: {duplicate.task.title}
                    </p>

                    {exactBlocked && (
                      <p
                        style={{
                          color: "#fcd9a0",
                          fontSize: 12,
                        }}
                      >
                        This exact match will be skipped unless you allow it
                        explicitly.
                      </p>
                    )}

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        fontSize: 12,
                        color: "#f8fafc",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={suggestion.duplicateOverride}
                        onChange={(event) =>
                          updateSuggestion(suggestion.id, {
                            duplicateOverride: event.target.checked,
                            selected: event.target.checked
                              ? true
                              : suggestion.selected,
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

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={saveSelectedTasks}
              disabled={selectedCount === 0}
              style={{
                ...buttonStyle,
                background: "#8b5cf6",
                color: "#fff",
                opacity: selectedCount === 0 ? 0.6 : 1,
              }}
            >
              Save Selected Tasks ({selectedCount})
            </button>

            <button
              type="button"
              onClick={onOpenTasks}
              style={{
                ...buttonStyle,
                background: "#343747",
                color: "#fff",
              }}
            >
              View Tasks
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default AIAssistant;
