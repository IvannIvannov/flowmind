import { useEffect, useRef, useState } from "react";
import type { Project, Task } from "../../types";
import type { FocusHistoryEntry } from "../../utils/focusHistory";
import "./FocusTimer.css";

interface FocusTimerProps {
  tasks: Task[];
  projects: Project[];
  userId: string;
  onComplete: (entry: FocusHistoryEntry) => Promise<void>;
}

type Duration = 15 | 25 | 45;

interface FocusSession {
  taskId: string;
  taskTitle: string;
  projectId?: string;
  projectName?: string;
  sessionId: string;
  duration: Duration;
  remainingSeconds: number;
  running: boolean;
  endTime: number | null;
  finished: boolean;
}

const STORAGE_PREFIX = "flowmind-focus-session-v2";
const DURATIONS: Duration[] = [15, 25, 45];

function sessionKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function initialSession(): FocusSession {
  return {
    taskId: "",
    taskTitle: "",
    sessionId: "",
    duration: 25,
    remainingSeconds: 25 * 60,
    running: false,
    endTime: null,
    finished: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDuration(value: unknown): value is Duration {
  return value === 15 || value === 25 || value === 45;
}

function remainingTime(session: FocusSession, now: number): number {
  if (session.running && session.endTime !== null) {
    return Math.max(0, Math.ceil((session.endTime - now) / 1000));
  }

  return session.remainingSeconds;
}

function loadSession(userId: string): FocusSession {
  try {
    const raw = localStorage.getItem(sessionKey(userId));

    if (!raw) return initialSession();

    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return initialSession();
    }

    if (
      typeof parsed.taskId !== "string" ||
      !isDuration(parsed.duration) ||
      typeof parsed.remainingSeconds !== "number" ||
      !Number.isFinite(parsed.remainingSeconds) ||
      typeof parsed.running !== "boolean" ||
      typeof parsed.finished !== "boolean" ||
      !(
        parsed.endTime === null ||
        (typeof parsed.endTime === "number" && Number.isFinite(parsed.endTime))
      )
    ) {
      return initialSession();
    }

    const running = parsed.running && typeof parsed.endTime === "number";

    const endTime = running ? (parsed.endTime as number) : null;

    return {
      taskId: parsed.taskId,
      taskTitle: typeof parsed.taskTitle === "string" ? parsed.taskTitle : "",
      projectId:
        typeof parsed.projectId === "string" ? parsed.projectId : undefined,
      projectName:
        typeof parsed.projectName === "string" ? parsed.projectName : undefined,
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : "",
      duration: parsed.duration,
      remainingSeconds: Math.max(
        0,
        Math.min(parsed.duration * 60, Math.ceil(parsed.remainingSeconds)),
      ),
      running,
      endTime,
      finished: parsed.finished,
    };
  } catch (error) {
    console.error("FlowMind: cannot load focus session", error);

    return initialSession();
  }
}

function saveSession(userId: string, session: FocusSession): void {
  try {
    localStorage.setItem(sessionKey(userId), JSON.stringify(session));
  } catch (error) {
    console.error("FlowMind: cannot save focus session", error);
  }
}

function timeDisplay(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));

  const minutes = String(Math.floor(value / 60)).padStart(2, "0");

  const remaining = String(value % 60).padStart(2, "0");

  return `${minutes}:${remaining}`;
}

function projectSnapshot(task: Task, projects: Project[]) {
  const project = projects.find((item) => item.id === task.projectId);

  return {
    projectId: project?.id,
    projectName: project?.name,
  };
}

export default function FocusTimer({
  tasks,
  projects,
  userId,
  onComplete,
}: FocusTimerProps) {
  const [session, setSession] = useState<FocusSession>(() =>
    loadSession(userId),
  );

  const [now, setNow] = useState(Date.now);
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");

  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session.running) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [session.running]);

  const totalSeconds = session.duration * 60;
  const remaining = remainingTime(session, now);

  const selectedTask =
    tasks.find((task) => task.id === session.taskId) ??
    (session.taskId === "" ? (tasks[0] ?? null) : null);

  const taskMissing = Boolean(session.taskId) && !selectedTask;

  const progress = Math.min(
    100,
    Math.max(0, ((totalSeconds - remaining) / totalSeconds) * 100),
  );

  const isPaused =
    !session.running && !session.finished && remaining < totalSeconds;

  const status = session.finished
    ? "Completed"
    : session.running
      ? "Focusing"
      : isPaused
        ? "Paused"
        : "Ready";

  const visibleTasks = tasks.filter((task) =>
    task.title
      .toLocaleLowerCase("bg-BG")
      .includes(taskSearch.toLocaleLowerCase("bg-BG")),
  );

  function commit(next: FocusSession) {
    saveSession(userId, next);
    setSession(next);
    setNow(Date.now());
    setSaveError("");
  }

  async function finishSession(current: FocusSession) {
    if (savingRef.current || current.finished || current.endTime === null) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError("");

    const matchingTask = tasks.find((task) => task.id === current.taskId);

    const snapshot =
      current.projectId || current.projectName
        ? {
            projectId: current.projectId,
            projectName: current.projectName,
          }
        : matchingTask
          ? projectSnapshot(matchingTask, projects)
          : {};

    const entry: FocusHistoryEntry = {
      id: current.sessionId || crypto.randomUUID(),
      taskId: current.taskId,
      taskTitle: current.taskTitle || matchingTask?.title || "Focus Task",
      durationMinutes: current.duration,
      completedAt: new Date(current.endTime).toISOString(),
      ...snapshot,
    };

    try {
      await onComplete(entry);

      const finished: FocusSession = {
        ...current,
        remainingSeconds: 0,
        running: false,
        endTime: null,
        finished: true,
      };

      saveSession(userId, finished);
      setSession(finished);
      setSaveError("");
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : "Focus history could not be saved.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (
      !session.running ||
      session.endTime === null ||
      remaining > 0 ||
      savingRef.current ||
      saveError
    ) {
      return;
    }

    void finishSession(session);
    // Completion is determined by the active session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, remaining, saveError]);

  useEffect(() => {
    if (!taskMenuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setTaskMenuOpen(false);
        setTaskSearch("");
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTaskMenuOpen(false);
        setTaskSearch("");
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);

      document.removeEventListener("keydown", onKeyDown);
    };
  }, [taskMenuOpen]);

  useEffect(() => {
    if (taskMenuOpen && tasks.length > 4) {
      searchRef.current?.focus();
    }
  }, [taskMenuOpen, tasks.length]);

  function start() {
    if (
      !selectedTask ||
      session.running ||
      savingRef.current ||
      (session.running && remaining === 0)
    ) {
      return;
    }

    const seconds =
      session.finished || remaining <= 0 ? totalSeconds : remaining;

    const resume =
      !session.finished &&
      remaining > 0 &&
      remaining < totalSeconds &&
      Boolean(session.sessionId) &&
      session.taskId === selectedTask.id;

    const snapshot = resume
      ? {
          projectId: session.projectId,
          projectName: session.projectName,
        }
      : projectSnapshot(selectedTask, projects);

    commit({
      ...session,
      taskId: selectedTask.id,
      taskTitle: selectedTask.title,
      ...snapshot,
      sessionId: resume ? session.sessionId : crypto.randomUUID(),
      remainingSeconds: seconds,
      running: true,
      endTime: Date.now() + seconds * 1000,
      finished: false,
    });
  }

  function pause() {
    if (!session.running || savingRef.current) {
      return;
    }

    const seconds = remainingTime(session, Date.now());

    if (seconds <= 0) {
      setNow(Date.now());
      return;
    }

    commit({
      ...session,
      remainingSeconds: seconds,
      running: false,
      endTime: null,
    });
  }

  function reset() {
    if (
      savingRef.current ||
      (session.running && remainingTime(session, Date.now()) === 0)
    ) {
      return;
    }

    commit({
      ...session,
      taskId: selectedTask?.id ?? "",
      taskTitle: selectedTask?.title ?? "",
      sessionId: "",
      remainingSeconds: totalSeconds,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  function changeDuration(duration: Duration) {
    if (session.running || savingRef.current) {
      return;
    }

    commit({
      ...session,
      duration,
      sessionId: "",
      remainingSeconds: duration * 60,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  function changeTask(taskId: string) {
    if (session.running || savingRef.current) {
      return;
    }

    const task = tasks.find((item) => item.id === taskId);

    if (!task) return;

    commit({
      ...session,
      taskId: task.id,
      taskTitle: task.title,
      ...projectSnapshot(task, projects),
      sessionId: "",
      remainingSeconds: totalSeconds,
      running: false,
      endTime: null,
      finished: false,
    });

    setTaskMenuOpen(false);
    setTaskSearch("");
  }

  function toggleTaskMenu() {
    if (session.running || tasks.length === 0 || saving) {
      return;
    }

    setTaskMenuOpen((previous) => !previous);
    setTaskSearch("");
  }

  return (
    <section className="fm-focus-timer" aria-label="Focus timer">
      <header className="fm-focus-timer-header">
        <div className="fm-focus-timer-heading">
          <span className="fm-focus-timer-kicker">DEEP WORK</span>

          <h2>Focus Studio</h2>

          <p>One task. One moment. Full attention.</p>
        </div>

        <span
          className={`fm-focus-timer-status ${
            session.running ? "is-running" : ""
          }`}
          role="status"
        >
          <span className="fm-focus-timer-status-dot" aria-hidden="true" />

          {saving ? "Saving" : status}
        </span>
      </header>

      <div className="fm-focus-timer-workspace">
        <div className="fm-focus-timer-clock">
          <div className="fm-focus-timer-clock-top">
            <span>FOCUS TIME</span>
            <span>{session.duration} MIN</span>
          </div>

          <div className="fm-focus-timer-time-wrap">
            <span
              className="fm-focus-timer-time"
              role="timer"
              aria-label={`${timeDisplay(remaining)} remaining`}
            >
              {timeDisplay(remaining)}
            </span>

            <span className="fm-focus-timer-caption">
              {session.finished
                ? "Beautiful work."
                : session.running
                  ? "Stay in your flow."
                  : isPaused
                    ? "Your time is saved."
                    : "Make every minute count."}
            </span>
          </div>

          <div
            className="fm-focus-timer-track"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="fm-focus-timer-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div
            className="fm-focus-timer-durations"
            role="group"
            aria-label="Session duration"
          >
            {DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                className={`fm-focus-timer-duration ${
                  session.duration === duration ? "active" : ""
                }`}
                aria-pressed={session.duration === duration}
                disabled={session.running || saving}
                onClick={() => changeDuration(duration)}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>

        <div className="fm-focus-timer-control-area">
          <div className="fm-focus-timer-task-area" ref={menuRef}>
            <span className="fm-focus-timer-field-label">WORKING ON</span>

            <button
              type="button"
              className={`fm-focus-timer-task-button ${
                taskMenuOpen ? "is-open" : ""
              }`}
              onClick={toggleTaskMenu}
              disabled={session.running || tasks.length === 0 || saving}
              aria-expanded={taskMenuOpen}
              aria-haspopup="listbox"
              aria-controls="fm-focus-task-options"
            >
              <span className="fm-focus-timer-task-symbol">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="8.5" />

                  <path d="m8.5 12 2.5 2.5 4.5-5" />
                </svg>
              </span>

              <span className="fm-focus-timer-task-text">
                <strong>
                  {selectedTask?.title ??
                    (taskMissing
                      ? "Choose another priority"
                      : "Select a focus task")}
                </strong>

                <small>
                  {tasks.length} focus{" "}
                  {tasks.length === 1 ? "priority" : "priorities"} available
                </small>
              </span>

              <svg
                className="fm-focus-timer-chevron"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {taskMenuOpen && (
              <div
                className="fm-focus-timer-task-menu"
                id="fm-focus-task-options"
              >
                <div className="fm-focus-timer-task-menu-head">
                  <strong>Choose a task</strong>
                  <span>{tasks.length} available</span>
                </div>

                {tasks.length > 4 && (
                  <div className="fm-focus-timer-search">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />

                      <path d="m20 20-4-4" />
                    </svg>

                    <input
                      ref={searchRef}
                      type="text"
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                      placeholder="Search tasks..."
                      aria-label="Search focus tasks"
                    />
                  </div>
                )}

                <div className="fm-focus-timer-task-list">
                  {visibleTasks.length === 0 ? (
                    <p className="fm-focus-timer-no-results">
                      No matching tasks.
                    </p>
                  ) : (
                    visibleTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`fm-focus-timer-task-option ${
                          selectedTask?.id === task.id ? "selected" : ""
                        }`}
                        onClick={() => changeTask(task.id)}
                      >
                        <span className="fm-focus-timer-option-circle">
                          {selectedTask?.id === task.id ? "✓" : ""}
                        </span>

                        <span>{task.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="fm-focus-timer-helper">
            {saving
              ? "Saving your completed session..."
              : session.running
                ? "Your session is running. Stay with this task."
                : session.finished
                  ? "Session complete. Your time has been saved."
                  : isPaused
                    ? "Pick up exactly where you left off."
                    : "Choose your task, then press Start."}
          </p>

          <div className="fm-focus-timer-actions">
            {session.running ? (
              <button
                type="button"
                className="fm-focus-timer-primary"
                onClick={pause}
                disabled={saving}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 5v14M15 5v14" />
                </svg>
                Pause focus
              </button>
            ) : (
              <button
                type="button"
                className="fm-focus-timer-primary"
                disabled={!selectedTask || saving}
                onClick={start}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5.5v13l10-6.5z" />
                </svg>

                {session.finished
                  ? "Start again"
                  : isPaused
                    ? "Resume focus"
                    : "Start focus"}
              </button>
            )}

            <button
              type="button"
              className="fm-focus-timer-secondary"
              onClick={reset}
              disabled={saving}
              title="Reset session"
              aria-label="Reset timer"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {taskMissing && (
        <p className="fm-focus-timer-notice">
          Your previous task is no longer among today's priorities. Select
          another task to start a new focus session.
        </p>
      )}

      {saveError && (
        <div className="fm-focus-timer-notice" role="alert">
          <p>{saveError}</p>

          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void finishSession(session);
            }}
          >
            Retry saving session
          </button>
        </div>
      )}

      {session.finished && (
        <p className="fm-focus-timer-notice" role="status">
          ✓ Session completed and saved to Focus History.
        </p>
      )}
    </section>
  );
}
