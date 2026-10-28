import { useEffect, useRef, useState } from "react";

import type { Task } from "../../types";

import { loadProjects } from "../../utils/storage";

import { addFocusHistoryEntry } from "../../utils/focusHistory";

import "./FocusTimer.css";

interface FocusTimerProps {
  tasks: Task[];
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

const STORAGE_KEY = "flowmind-focus-session-v1";

const DURATIONS: Duration[] = [15, 25, 45];

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

function loadSession(): FocusSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return initialSession();
    }

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
      sessionId:
        typeof parsed.sessionId === "string" && parsed.sessionId
          ? parsed.sessionId
          : running
            ? `legacy-${parsed.taskId}-${endTime}`
            : "",
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

function saveSession(session: FocusSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("FlowMind: cannot save focus session", error);
  }
}

function timeDisplay(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));

  const minutes = String(Math.floor(value / 60)).padStart(2, "0");

  const remainder = String(value % 60).padStart(2, "0");

  return `${minutes}:${remainder}`;
}

function projectSnapshot(task: Task) {
  const project = loadProjects().find((item) => item.id === task.projectId);

  return {
    projectId: project?.id,
    projectName: project?.name,
  };
}

function FocusTimer({ tasks }: FocusTimerProps) {
  const [session, setSession] = useState<FocusSession>(loadSession);

  const [now, setNow] = useState(Date.now);

  const [taskMenuOpen, setTaskMenuOpen] = useState(false);

  const [taskSearch, setTaskSearch] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session.running) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [session.running]);

  useEffect(() => {
    if (
      !session.running ||
      session.endTime === null ||
      remainingTime(session, now) > 0
    ) {
      return;
    }

    const matchingTask = tasks.find((task) => task.id === session.taskId);

    const snapshot =
      session.projectId || session.projectName
        ? {
            projectId: session.projectId,
            projectName: session.projectName,
          }
        : matchingTask
          ? projectSnapshot(matchingTask)
          : {};

    const saved = addFocusHistoryEntry({
      id: session.sessionId || `legacy-${session.taskId}-${session.endTime}`,
      taskId: session.taskId,
      taskTitle: session.taskTitle || matchingTask?.title || "Focus Task",
      durationMinutes: session.duration,
      completedAt: new Date(session.endTime).toISOString(),
      ...snapshot,
    });

    if (!saved) {
      return;
    }

    const finished: FocusSession = {
      ...session,
      remainingSeconds: 0,
      running: false,
      endTime: null,
      finished: true,
    };

    saveSession(finished);
    setSession(finished);
  }, [session, now, tasks]);

  useEffect(() => {
    if (!taskMenuOpen) {
      return;
    }

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

  const selectedTask =
    tasks.find((task) => task.id === session.taskId) ??
    (session.taskId === "" ? (tasks[0] ?? null) : null);

  const taskMissing = Boolean(session.taskId) && !selectedTask;

  const totalSeconds = session.duration * 60;

  const remaining = remainingTime(session, now);

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
    task.title.toLocaleLowerCase().includes(taskSearch.toLocaleLowerCase()),
  );

  function commit(next: FocusSession) {
    saveSession(next);
    setSession(next);
    setNow(Date.now());
  }

  function start() {
    if (!selectedTask || session.running) {
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
      : projectSnapshot(selectedTask);

    const startedAt = Date.now();

    commit({
      ...session,
      taskId: selectedTask.id,
      taskTitle: selectedTask.title,
      ...snapshot,
      sessionId: resume ? session.sessionId : crypto.randomUUID(),
      remainingSeconds: seconds,
      running: true,
      endTime: startedAt + seconds * 1000,
      finished: false,
    });
  }

  function pause() {
    if (!session.running) {
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
    if (session.running) {
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
    if (session.running) {
      return;
    }

    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    commit({
      ...session,
      taskId: task.id,
      taskTitle: task.title,
      ...projectSnapshot(task),
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
    if (session.running || tasks.length === 0) {
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

          {status}
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
                disabled={session.running}
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
              disabled={session.running || tasks.length === 0}
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
            {session.running
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
                disabled={!selectedTask}
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

      {session.finished && (
        <p className="fm-focus-timer-notice" role="status">
          ✓ Session completed and saved to Focus History.
        </p>
      )}
    </section>
  );
}

export default FocusTimer;
