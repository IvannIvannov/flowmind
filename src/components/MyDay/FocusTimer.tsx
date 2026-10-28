import { useEffect, useState } from "react";

import type { Task } from "../../types";
import { loadProjects } from "../../utils/storage";
import { addFocusHistoryEntry } from "../../utils/focusHistory";

import FocusHistory from "./FocusHistory";
import "./FocusTimer.css";

interface FocusTimerProps {
  tasks: Task[];
}

type SessionDuration = 15 | 25 | 45;

interface SavedFocusSession {
  taskId: string;
  taskTitle: string;
  projectId?: string;
  projectName?: string;
  sessionId: string;
  duration: SessionDuration;
  remainingSeconds: number;
  running: boolean;
  endTime: number | null;
  finished: boolean;
}

const STORAGE_KEY = "flowmind-focus-session-v1";
const DEFAULT_DURATION: SessionDuration = 25;

function defaultSession(): SavedFocusSession {
  return {
    taskId: "",
    taskTitle: "",
    sessionId: "",
    duration: DEFAULT_DURATION,
    remainingSeconds: DEFAULT_DURATION * 60,
    running: false,
    endTime: null,
    finished: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDuration(value: unknown): value is SessionDuration {
  return value === 15 || value === 25 || value === 45;
}

function remainingTime(session: SavedFocusSession, now = Date.now()): number {
  if (session.running && session.endTime !== null) {
    return Math.max(0, Math.ceil((session.endTime - now) / 1000));
  }

  return session.remainingSeconds;
}

function loadSession(): SavedFocusSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSession();

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return defaultSession();

    if (
      typeof parsed.taskId !== "string" ||
      !validDuration(parsed.duration) ||
      typeof parsed.remainingSeconds !== "number" ||
      !Number.isFinite(parsed.remainingSeconds) ||
      typeof parsed.running !== "boolean" ||
      typeof parsed.finished !== "boolean" ||
      !(
        parsed.endTime === null ||
        (typeof parsed.endTime === "number" && Number.isFinite(parsed.endTime))
      )
    ) {
      return defaultSession();
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
    console.error("Could not load focus session", error);
    return defaultSession();
  }
}

function saveSession(session: SavedFocusSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Could not save focus session", error);
  }
}

function displayTime(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));

  return (
    String(Math.floor(safe / 60)).padStart(2, "0") +
    ":" +
    String(safe % 60).padStart(2, "0")
  );
}

function projectSnapshot(task: Task) {
  const project = loadProjects().find((item) => item.id === task.projectId);

  return {
    projectId: project?.id,
    projectName: project?.name,
  };
}

function FocusTimer({ tasks }: FocusTimerProps) {
  const [session, setSession] = useState<SavedFocusSession>(loadSession);

  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!session.running) return;

    const interval = window.setInterval(() => setNow(Date.now()), 250);

    return () => window.clearInterval(interval);
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

    if (!saved) return;

    const completed: SavedFocusSession = {
      ...session,
      remainingSeconds: 0,
      running: false,
      endTime: null,
      finished: true,
    };

    setSession(completed);
    saveSession(completed);
  }, [session, now, tasks]);

  const selectedTask =
    tasks.find((task) => task.id === session.taskId) ??
    (session.taskId === "" ? (tasks[0] ?? null) : null);

  const totalSeconds = session.duration * 60;
  const remaining = remainingTime(session, now);

  const progress = Math.min(
    100,
    Math.max(0, ((totalSeconds - remaining) / totalSeconds) * 100),
  );

  function commit(next: SavedFocusSession) {
    setSession(next);
    setNow(Date.now());
    saveSession(next);
  }

  function start() {
    if (!selectedTask || session.running) return;

    const seconds =
      session.finished || remaining <= 0 ? totalSeconds : remaining;

    const resume =
      !session.finished &&
      remaining > 0 &&
      remaining < totalSeconds &&
      Boolean(session.sessionId);

    const snapshot = resume
      ? {
          projectId: session.projectId,
          projectName: session.projectName,
        }
      : projectSnapshot(selectedTask);

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
    if (!session.running) return;

    const seconds = remainingTime(session, Date.now());

    if (seconds === 0) {
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

  function changeDuration(value: SessionDuration) {
    if (session.running) return;

    commit({
      ...session,
      duration: value,
      sessionId: "",
      remainingSeconds: value * 60,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  function changeTask(taskId: string) {
    if (session.running) return;

    const task = tasks.find((item) => item.id === taskId);

    commit({
      ...session,
      taskId,
      taskTitle: task?.title ?? "",
      projectId: task?.projectId,
      projectName: task ? projectSnapshot(task).projectName : undefined,
      sessionId: "",
      remainingSeconds: totalSeconds,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  const status = session.finished
    ? "Session complete!"
    : session.running
      ? "Stay focused"
      : remaining < totalSeconds
        ? "Session paused"
        : "Ready to focus";

  return (
    <>
      <section className="fm-focus-timer" aria-label="Focus session timer">
        <div className="fm-focus-timer-heading">
          <div>
            <p className="fm-focus-timer-eyebrow">DEEP WORK</p>
            <h2>Focus Session ⏱️</h2>
          </div>

          <span
            className={`fm-focus-timer-status ${
              session.running ? "running" : ""
            } ${session.finished ? "finished" : ""}`}
            role="status"
          >
            {status}
          </span>
        </div>

        <p className="fm-focus-timer-description">
          Work on one task at a time. Completed sessions are automatically
          tracked by task and project.
        </p>

        <div className="fm-focus-timer-settings">
          <div className="fm-focus-timer-field">
            <label htmlFor="fm-focus-task">Focus Task</label>

            <select
              id="fm-focus-task"
              value={selectedTask?.id ?? ""}
              disabled={session.running || tasks.length === 0}
              onChange={(event) => changeTask(event.target.value)}
            >
              {tasks.length === 0 ? (
                <option value="">Choose focus tasks first</option>
              ) : (
                <>
                  {session.taskId && !selectedTask && (
                    <option value="">Previous task unavailable</option>
                  )}

                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="fm-focus-timer-field">
            <label htmlFor="fm-focus-duration">Duration</label>

            <select
              id="fm-focus-duration"
              value={session.duration}
              disabled={session.running}
              onChange={(event) =>
                changeDuration(Number(event.target.value) as SessionDuration)
              }
            >
              <option value={15}>15 minutes</option>
              <option value={25}>25 minutes</option>
              <option value={45}>45 minutes</option>
            </select>
          </div>
        </div>

        <div className="fm-focus-timer-clock">
          <div
            className={`fm-focus-timer-time ${session.running ? "active" : ""}`}
            role="timer"
            aria-label="Time remaining"
          >
            {displayTime(remaining)}
          </div>

          <p className="fm-focus-timer-subtitle">
            {session.finished
              ? "You completed your focus session!"
              : session.running
                ? "One task. One step at a time."
                : "Focus time remaining"}
          </p>

          <div
            className="fm-focus-timer-track"
            role="progressbar"
            aria-label="Focus session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="fm-focus-timer-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="fm-focus-timer-progress-label">
            {Math.round(progress)}% completed
          </span>
        </div>

        {session.finished && (
          <div className="fm-focus-timer-complete" role="status">
            🎉 Great work! Your session has been added to Focus History.
          </div>
        )}

        {!selectedTask && session.taskId !== "" && (
          <div className="fm-focus-timer-complete" role="status">
            Your previous task is no longer in today's focus list. Choose
            another focus task.
          </div>
        )}

        <div className="fm-focus-timer-actions">
          {session.running ? (
            <button
              type="button"
              className="fm-focus-timer-primary"
              onClick={pause}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              type="button"
              className="fm-focus-timer-primary"
              disabled={!selectedTask}
              onClick={start}
            >
              ▶{" "}
              {session.finished
                ? "Start Again"
                : remaining < totalSeconds
                  ? "Resume Focus"
                  : "Start Focus"}
            </button>
          )}

          <button
            type="button"
            className="fm-focus-timer-secondary"
            onClick={reset}
          >
            ↺ Reset
          </button>
        </div>

        <p className="fm-focus-timer-hint">
          Sessions are saved locally. Only completed sessions are counted in
          productivity analytics.
        </p>
      </section>

      <FocusHistory />
    </>
  );
}

export default FocusTimer;
