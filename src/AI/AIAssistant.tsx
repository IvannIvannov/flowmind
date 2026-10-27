import { useState } from "react";
import type { FormEvent } from "react";

import type { Priority, Project } from "../types";
import { extractTasksWithOllama } from "../services/ollama";
import type { SuggestedTask } from "../services/ollama";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCount = suggestions.filter(
    (task) => task.selected && task.title.trim(),
  ).length;

  async function analyzeNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim() || loading) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setSuggestions([]);

    try {
      const result = await extractTasksWithOllama(input, projects);

      setSuggestions(result);
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

  function saveSelectedTasks() {
    const selected = suggestions.filter(
      (task) => task.selected && task.title.trim(),
    );

    if (selected.length === 0) return;

    for (const task of selected) {
      onCreateTask({
        title: task.title.trim(),
        priority: task.priority,
        dueDate: task.dueDate || undefined,
        projectId: task.projectId || undefined,
      });
    }

    setSuggestions([]);
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
    setError("");
    setSuccess("");
  }

  return (
    <div className="fm-ai">
      <header className="fm-ai-header">
        <p className="fm-ai-eyebrow">LOCAL AI WORKSPACE</p>

        <h1>AI Assistant 🧠</h1>

        <p>
          Turn your notes into multiple organized tasks using your local AI
          model.
        </p>
      </header>

      <div className="fm-ai-layout">
        <div className="fm-ai-main">
          <section className="fm-ai-intro">
            <div className="fm-ai-intro-icon">✨</div>

            <h2>What's on your mind?</h2>

            <p>
              Write your tasks naturally in Bulgarian. FlowMind will ask Ollama
              to identify individual actions and suggest deadlines.
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
              placeholder="Утре да изпратя имейл на Юлия, в петък да монтирам видеото за Mazu и в понеделник да подготвя контент план."
              maxLength={5000}
              rows={6}
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
                {loading ? "Analyzing..." : "✨ Analyze with AI"}
              </button>
            </div>

            {loading && (
              <p
                role="status"
                style={{
                  marginTop: 15,
                  color: "#c4b5fd",
                  fontSize: 13,
                }}
              >
                Gemma 3 is analyzing your note locally...
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

          {suggestions.length > 0 && (
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
                AI can make mistakes. Check every task, especially its deadline,
                before saving.
              </p>

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
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 18,
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
                  disabled={selectedCount === 0}
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
              Model: Gemma 3 1B. Your text is sent to the Ollama server running
              on this computer.
            </p>

            <div className="fm-ai-steps">
              <div>
                <span>01</span>
                <p>Write your notes</p>
              </div>

              <div>
                <span>02</span>
                <p>Analyze with local AI</p>
              </div>

              <div>
                <span>03</span>
                <p>Review proposed tasks</p>
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

            <p>AI requests use the local Ollama address 127.0.0.1:11434.</p>

            <p className="fm-ai-info-note">
              No external paid AI API is required. Review AI-generated details
              before saving.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AIAssistant;
