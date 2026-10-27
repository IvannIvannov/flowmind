import { useState } from "react";
import type { FormEvent } from "react";

import type { Priority, Project } from "../types";
import { extractTasksWithOllama } from "../services/ollama";
import type { ExtractionResult, SuggestedTask } from "../services/ollama";

import "./AIAssistant.css";

export interface AssistantTaskDraft {
  title: string;
  priority: Priority;
  dueDate?: string;
  projectId?: string;
}

interface AIAssistantProps {
  projects: Project[];
  onCreateTask: (task: AssistantTaskDraft) => void;
  onOpenTasks: () => void;
}

function AIAssistant({
  projects,
  onCreateTask,
  onOpenTasks,
}: AIAssistantProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [reviewedWarnings, setReviewedWarnings] = useState(false);

  const [analyzedSections, setAnalyzedSections] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAllSources, setShowAllSources] = useState(true);

  const selectedCount = suggestions.filter(
    (task) => task.selected && task.title.trim(),
  ).length;

  const fallbackCount = suggestions.filter(
    (task) => task.origin === "fallback",
  ).length;

  const canSave =
    selectedCount > 0 && (warnings.length === 0 || reviewedWarnings);

  async function analyzeNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim() || loading) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setSuggestions([]);
    setWarnings([]);
    setReviewedWarnings(false);
    setAnalyzedSections(0);
    setShowAllSources(true);

    try {
      const result: ExtractionResult = await extractTasksWithOllama(
        input,
        projects,
      );

      setSuggestions(result.tasks);
      setWarnings(result.warnings);
      setAnalyzedSections(result.analyzedSections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateSuggestion(id: string, changes: Partial<SuggestedTask>) {
    setSuggestions((previous) =>
      previous.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );
  }

  function selectAll(selected: boolean) {
    setSuggestions((previous) =>
      previous.map((task) => ({
        ...task,
        selected,
      })),
    );
  }

  function removeSuggestion(id: string) {
    setSuggestions((previous) => previous.filter((task) => task.id !== id));
  }

  function resetResults() {
    setSuggestions([]);
    setWarnings([]);
    setReviewedWarnings(false);
    setAnalyzedSections(0);
    setError("");
    setSuccess("");
    setShowAllSources(true);
  }

  function saveSelectedTasks() {
    if (!canSave) return;

    const selected = suggestions.filter(
      (task) => task.selected && task.title.trim(),
    );

    for (const task of selected) {
      onCreateTask({
        title: task.title.trim(),
        priority: task.priority,
        dueDate: task.dueDate || undefined,
        projectId: task.projectId || undefined,
      });
    }

    resetResults();
    setInput("");

    setSuccess(
      `${selected.length} task${
        selected.length === 1 ? "" : "s"
      } added successfully!`,
    );
  }

  function formatDate(value: string): string {
    if (!value) return "No deadline";

    const parts = value.split("-");

    if (parts.length !== 3) return value;

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  return (
    <div className="fm-ai">
      <header className="fm-ai-header">
        <p className="fm-ai-eyebrow">LOCAL AI WORKSPACE</p>

        <h1>AI Assistant 🧠</h1>

        <p>Turn meeting notes into organized, editable tasks with local AI.</p>
      </header>

      <div className="fm-ai-layout">
        <div className="fm-ai-main">
          <section className="fm-ai-intro">
            <div className="fm-ai-intro-icon">✨</div>

            <h2>What's on your mind?</h2>

            <p>
              Paste your meeting notes in Bulgarian. FlowMind will identify
              pending actions and prepare suggestions for review.
            </p>
          </section>

          <form className="fm-ai-compose" onSubmit={analyzeNote}>
            <label htmlFor="fm-ai-input">Your note</label>

            <textarea
              id="fm-ai-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError("");
              }}
              placeholder="До петък трябва да изпратя предложенията на Юлия. Следващия понеделник да подготвя списък с брандове..."
              maxLength={5000}
              rows={7}
              required
              disabled={loading}
            />

            <div className="fm-ai-compose-footer">
              <span>{input.length}/5000 characters</span>

              <button
                type="submit"
                className="fm-ai-primary"
                disabled={loading || !input.trim()}
              >
                {loading ? "Analyzing notes..." : "✨ Analyze with AI"}
              </button>
            </div>

            {loading && (
              <p
                role="status"
                style={{
                  marginTop: 16,
                  color: "#c4b5fd",
                  fontSize: 13,
                }}
              >
                Ollama is analyzing your notes locally...
              </p>
            )}
          </form>

          {error && (
            <div
              role="alert"
              className="fm-ai-success"
              style={{
                background: "#3a2530",
                borderColor: "#69313e",
                color: "#fda4af",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="fm-ai-success">
              <span>✓ {success}</span>

              <button type="button" onClick={onOpenTasks}>
                View Tasks →
              </button>
            </div>
          )}

          {analyzedSections > 0 && (
            <section className="fm-ai-draft">
              <div className="fm-ai-draft-header">
                <div>
                  <p className="fm-ai-eyebrow">REVIEW BEFORE SAVING</p>

                  <h2>{suggestions.length} Suggested Tasks</h2>
                </div>

                <span className="fm-ai-draft-status">Not saved</span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  margin: "0 0 18px",
                }}
              >
                <span
                  style={{
                    color: "#c4b5fd",
                    fontSize: 13,
                  }}
                >
                  ✓ {selectedCount} selected
                </span>

                <span
                  style={{
                    color: "#a6abba",
                    fontSize: 13,
                  }}
                >
                  {analyzedSections} sections analyzed
                </span>

                {fallbackCount > 0 && (
                  <span
                    style={{
                      color: "#f9d89a",
                      fontSize: 13,
                    }}
                  >
                    ⚠ {fallbackCount} fallback drafts
                  </span>
                )}
              </div>

              <p
                style={{
                  color: "#a6abba",
                  fontSize: 13,
                  lineHeight: 1.7,
                  marginBottom: 20,
                }}
              >
                Review every task and its original text before saving.
              </p>

              {warnings.length > 0 && (
                <div
                  role="alert"
                  style={{
                    border: "1px solid #8a6231",
                    background: "#332b21",
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 22,
                    color: "#f9d89a",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 10px",
                      fontSize: 16,
                    }}
                  >
                    ⚠ {warnings.length} Review Warning
                    {warnings.length === 1 ? "" : "s"}
                  </h3>

                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Some suggestions may need manual correction.
                  </p>

                  <ul
                    style={{
                      paddingLeft: 22,
                      marginTop: 14,
                      marginBottom: 16,
                      fontSize: 13,
                      lineHeight: 1.8,
                    }}
                  >
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reviewedWarnings}
                      onChange={(event) =>
                        setReviewedWarnings(event.target.checked)
                      }
                    />
                    I reviewed the warnings and checked the original note.
                  </label>
                </div>
              )}

              {suggestions.length === 0 && (
                <div
                  style={{
                    padding: 20,
                    border: "1px solid #383b4d",
                    borderRadius: 12,
                    background: "#242633",
                    color: "#c3c6d2",
                  }}
                >
                  No tasks were extracted. Review your original note.
                </div>
              )}

              {suggestions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <button
                    type="button"
                    className="fm-ai-secondary"
                    onClick={() => selectAll(true)}
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    className="fm-ai-secondary"
                    onClick={() => selectAll(false)}
                  >
                    Deselect All
                  </button>

                  <button
                    type="button"
                    className="fm-ai-secondary"
                    onClick={() => setShowAllSources((previous) => !previous)}
                  >
                    {showAllSources ? "Hide Sources" : "Show Sources"}
                  </button>
                </div>
              )}

              {suggestions.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    padding: 18,
                    marginBottom: 14,
                    border: "1px solid #383b4d",
                    borderRadius: 12,
                    background: "#242633",
                    opacity: task.selected ? 1 : 0.55,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "#c4b5fd",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={(event) =>
                          updateSuggestion(task.id, {
                            selected: event.target.checked,
                          })
                        }
                      />
                      Task {index + 1} — Include
                    </label>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "6px 10px",
                        borderRadius: 20,
                        background:
                          task.origin === "fallback" ? "#54401f" : "#37305b",
                        color:
                          task.origin === "fallback" ? "#f9d89a" : "#c4b5fd",
                      }}
                    >
                      {task.origin === "fallback"
                        ? "⚠ Needs review"
                        : "✨ AI extracted"}
                    </span>
                  </div>

                  {showAllSources && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        marginBottom: 18,
                        background: "#191b26",
                        border: "1px solid #383b4d",
                      }}
                    >
                      <p
                        style={{
                          color: "#a6abba",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 1,
                          marginBottom: 8,
                        }}
                      >
                        ORIGINAL NOTE
                      </p>

                      <p
                        style={{
                          color: "#e2e3ea",
                          fontSize: 13,
                          lineHeight: 1.7,
                          margin: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {task.sourceText}
                      </p>
                    </div>
                  )}

                  <div className="fm-ai-fields">
                    <div className="fm-ai-field fm-ai-full">
                      <label htmlFor={`fm-ai-title-${task.id}`}>
                        Task Name
                      </label>

                      <input
                        id={`fm-ai-title-${task.id}`}
                        type="text"
                        maxLength={200}
                        value={task.title}
                        onChange={(event) =>
                          updateSuggestion(task.id, {
                            title: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="fm-ai-field">
                      <label htmlFor={`fm-ai-priority-${task.id}`}>
                        Priority
                      </label>

                      <select
                        id={`fm-ai-priority-${task.id}`}
                        value={task.priority}
                        onChange={(event) =>
                          updateSuggestion(task.id, {
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
                          updateSuggestion(task.id, {
                            dueDate: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="fm-ai-field fm-ai-full">
                      <label htmlFor={`fm-ai-project-${task.id}`}>
                        Project
                      </label>

                      <select
                        id={`fm-ai-project-${task.id}`}
                        value={task.projectId}
                        onChange={(event) =>
                          updateSuggestion(task.id, {
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
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "#a6abba",
                      }}
                    >
                      📅 {formatDate(task.dueDate)}
                    </span>

                    <button
                      type="button"
                      className="fm-ai-secondary"
                      onClick={() => removeSuggestion(task.id)}
                      aria-label={`Remove task ${index + 1}`}
                    >
                      Remove Task
                    </button>
                  </div>
                </div>
              ))}

              <div className="fm-ai-draft-actions">
                <button
                  type="button"
                  className="fm-ai-primary"
                  disabled={!canSave}
                  onClick={saveSelectedTasks}
                >
                  ✓ Save Selected Tasks ({selectedCount})
                </button>

                <button
                  type="button"
                  className="fm-ai-secondary"
                  onClick={resetResults}
                >
                  Discard
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="fm-ai-side">
          <div className="fm-ai-info">
            <span className="fm-ai-info-icon">🧠</span>

            <h3>Powered by Ollama</h3>

            <p>Model: Gemma 3 1B. Each note section is analyzed separately.</p>

            <div className="fm-ai-steps">
              <div>
                <span>01</span>
                <p>Paste your notes</p>
              </div>
              <div>
                <span>02</span>
                <p>Extract pending actions</p>
              </div>
              <div>
                <span>03</span>
                <p>Compare with original text</p>
              </div>
              <div>
                <span>04</span>
                <p>Confirm and save tasks</p>
              </div>
            </div>
          </div>

          <div className="fm-ai-info">
            <span className="fm-ai-info-icon">🔒</span>

            <h3>Local processing</h3>

            <p>AI requests use Ollama at 127.0.0.1:11434.</p>

            <p className="fm-ai-info-note">
              AI suggestions and fallback drafts require your review before
              saving.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AIAssistant;
