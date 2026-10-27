import { useState } from "react";
import type { FormEvent } from "react";

import type { Priority, Project } from "../types";

import { extractTasksWithOllama } from "../services/ollama";

import type { SuggestedTask, ExtractionResult } from "../services/ollama";

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

  const selectedCount = suggestions.filter(
    (task) => task.selected && task.title.trim(),
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

  function selectAll(value: boolean) {
    setSuggestions((previous) =>
      previous.map((task) => ({
        ...task,
        selected: value,
      })),
    );
  }

  function removeSuggestion(id: string) {
    setSuggestions((previous) => previous.filter((task) => task.id !== id));
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

    setSuggestions([]);
    setWarnings([]);
    setReviewedWarnings(false);
    setAnalyzedSections(0);
    setInput("");
    setError("");

    setSuccess(
      `${selected.length} task${
        selected.length === 1 ? "" : "s"
      } added successfully!`,
    );
  }

  function clearResults() {
    setSuggestions([]);
    setWarnings([]);
    setReviewedWarnings(false);
    setAnalyzedSections(0);
    setError("");
    setSuccess("");
  }

  return (
    <div className="fm-ai">
      <header className="fm-ai-header">
        <p className="fm-ai-eyebrow">LOCAL AI WORKSPACE</p>

        <h1>AI Assistant 🧠</h1>

        <p>
          Turn your notes and meeting summaries into organized tasks using local
          AI.
        </p>
      </header>

      <div className="fm-ai-layout">
        <div className="fm-ai-main">
          <section className="fm-ai-intro">
            <div className="fm-ai-intro-icon">✨</div>

            <h2>What's on your mind?</h2>

            <p>
              Paste meeting notes or describe your tasks in Bulgarian. FlowMind
              will analyze each section separately.
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
              placeholder="Днес проведохме среща. До петък трябва да изпратя предложенията. Следващия понеделник да подготвя списък с брандове."
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
                {loading ? "Analyzing sections..." : "✨ Analyze with AI"}
              </button>
            </div>

            {loading && (
              <p
                role="status"
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  color: "#c4b5fd",
                }}
              >
                Ollama is processing your note section by section...
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
            <div className="fm-ai-success" role="status">
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

              <p
                style={{
                  color: "#a6abba",
                  fontSize: 13,
                  lineHeight: 1.7,
                  marginBottom: 20,
                }}
              >
                {analyzedSections} note section
                {analyzedSections === 1 ? "" : "s"} analyzed. Check every
                suggestion before saving.
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
                      lineHeight: 1.6,
                    }}
                  >
                    Some sections may contain missing or uncertain information.
                    Review the original note before saving.
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
                    lineHeight: 1.7,
                  }}
                >
                  No tasks were extracted. Review the note or try shorter,
                  clearer instructions.
                </div>
              )}

              {suggestions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 18,
                    flexWrap: "wrap",
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

                    <button
                      type="button"
                      className="fm-ai-secondary"
                      onClick={() => removeSuggestion(task.id)}
                      aria-label={`Remove task ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>

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
                  onClick={clearResults}
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

            <p>
              Model: Gemma 3 1B. FlowMind processes sections of your note
              separately.
            </p>

            <div className="fm-ai-steps">
              <div>
                <span>01</span>
                <p>Paste meeting notes</p>
              </div>

              <div>
                <span>02</span>
                <p>Extract pending actions</p>
              </div>

              <div>
                <span>03</span>
                <p>Review tasks and warnings</p>
              </div>

              <div>
                <span>04</span>
                <p>Save selected tasks</p>
              </div>
            </div>
          </div>

          <div className="fm-ai-info">
            <span className="fm-ai-info-icon">🔒</span>

            <h3>Local processing</h3>

            <p>
              Requests are sent to your local Ollama server at 127.0.0.1:11434.
            </p>

            <p className="fm-ai-info-note">
              No paid AI API is required. Always check AI-generated tasks before
              saving.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AIAssistant;
