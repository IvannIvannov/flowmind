import { useState } from "react";
import type { FormEvent } from "react";

import type { Priority, Project } from "../types";

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
  const [draft, setDraft] = useState<AssistantTaskDraft | null>(null);

  const [message, setMessage] = useState("");

  function prepareDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text) return;

    setDraft({
      title: text,
      priority: "medium",
      dueDate: undefined,
      projectId: undefined,
    });

    setMessage("");
  }

  function updateDraft(changes: Partial<AssistantTaskDraft>) {
    setDraft((previous) => (previous ? { ...previous, ...changes } : null));

    setMessage("");
  }

  function saveDraft() {
    if (!draft || !draft.title.trim()) return;

    onCreateTask({
      ...draft,
      title: draft.title.trim(),
    });

    setDraft(null);
    setInput("");
    setMessage("Task added successfully!");
  }

  function resetDraft() {
    setDraft(null);
    setMessage("");
  }

  return (
    <div className="fm-ai">
      <header className="fm-ai-header">
        <p className="fm-ai-eyebrow">YOUR PERSONAL ASSISTANT</p>

        <h1>AI Assistant 🧠</h1>

        <p>Turn your ideas and notes into organized tasks.</p>
      </header>

      <div className="fm-ai-layout">
        <section className="fm-ai-main">
          <div className="fm-ai-intro">
            <div className="fm-ai-intro-icon">✨</div>

            <h2>What's on your mind?</h2>

            <p>
              Write down something you need to do. Prepare a task draft, review
              its details, and save it to FlowMind.
            </p>
          </div>

          <form className="fm-ai-compose" onSubmit={prepareDraft}>
            <label htmlFor="fm-ai-input">Your note</label>

            <textarea
              id="fm-ai-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setMessage("");
              }}
              placeholder={"Например: Монтирай видеото за клиента до петък."}
              rows={6}
              maxLength={5000}
              required
            />

            <div className="fm-ai-compose-footer">
              <span>{input.length}/5000 characters</span>

              <button
                type="submit"
                className="fm-ai-primary"
                disabled={!input.trim()}
              >
                Prepare Draft →
              </button>
            </div>
          </form>

          {message && (
            <div className="fm-ai-success" role="status">
              <span>✓ {message}</span>

              <button type="button" onClick={onOpenTasks}>
                View Tasks →
              </button>
            </div>
          )}

          {draft && (
            <section className="fm-ai-draft">
              <div className="fm-ai-draft-header">
                <div>
                  <p className="fm-ai-eyebrow">REVIEW BEFORE SAVING</p>

                  <h2>Task Draft</h2>
                </div>

                <span className="fm-ai-draft-status">Not saved</span>
              </div>

              <div className="fm-ai-fields">
                <div className="fm-ai-field fm-ai-full">
                  <label htmlFor="fm-ai-title">Task Name</label>

                  <input
                    id="fm-ai-title"
                    type="text"
                    value={draft.title}
                    maxLength={200}
                    onChange={(event) =>
                      updateDraft({
                        title: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="fm-ai-field">
                  <label htmlFor="fm-ai-priority">Priority</label>

                  <select
                    id="fm-ai-priority"
                    value={draft.priority}
                    onChange={(event) =>
                      updateDraft({
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
                  <label htmlFor="fm-ai-date">Due Date</label>

                  <input
                    id="fm-ai-date"
                    type="date"
                    value={draft.dueDate || ""}
                    onChange={(event) =>
                      updateDraft({
                        dueDate: event.target.value || undefined,
                      })
                    }
                  />
                </div>

                <div className="fm-ai-field fm-ai-full">
                  <label htmlFor="fm-ai-project">Project</label>

                  <select
                    id="fm-ai-project"
                    value={draft.projectId || ""}
                    onChange={(event) =>
                      updateDraft({
                        projectId: event.target.value || undefined,
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

              <div className="fm-ai-draft-actions">
                <button
                  type="button"
                  className="fm-ai-primary"
                  disabled={!draft.title.trim()}
                  onClick={saveDraft}
                >
                  ✓ Save Task
                </button>

                <button
                  type="button"
                  className="fm-ai-secondary"
                  onClick={resetDraft}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </section>

        <aside className="fm-ai-side">
          <div className="fm-ai-info">
            <span className="fm-ai-info-icon">🧩</span>

            <h3>How it works</h3>

            <p>
              Enter your note, prepare a draft, adjust its details and save it.
            </p>

            <div className="fm-ai-steps">
              <div>
                <span>01</span>
                <p>Write your task</p>
              </div>

              <div>
                <span>02</span>
                <p>Review the draft</p>
              </div>

              <div>
                <span>03</span>
                <p>Save to FlowMind</p>
              </div>
            </div>
          </div>

          <div className="fm-ai-info">
            <span className="fm-ai-info-icon">🔒</span>

            <h3>Local workspace</h3>

            <p>
              This draft tool works locally. No AI service is connected yet.
            </p>

            <p className="fm-ai-info-note">
              Next: connect Ollama for automatic task extraction and
              natural-language understanding.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AIAssistant;
