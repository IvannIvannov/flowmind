import { useEffect, useState } from "react";

import type { Task } from "../../types";

import "./FocusTimer.css";

interface FocusTimerProps {
  tasks: Task[];
}

type SessionDuration = 15 | 25 | 45;

interface SavedFocusSession {
  taskId: string;
  duration: SessionDuration;
  remainingSeconds: number;
  running: boolean;
  endTime: number | null;
  finished: boolean;
}

const STORAGE_KEY = "flowmind-focus-session-v1";

const DEFAULT_DURATION: SessionDuration = 25;

function createDefaultSession(): SavedFocusSession {
  return {
    taskId: "",
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

function isValidDuration(value: unknown): value is SessionDuration {
  return value === 15 || value === 25 || value === 45;
}

function getRemainingSeconds(
  session: SavedFocusSession,
  now: number = Date.now(),
): number {
  if (session.running && session.endTime !== null) {
    return Math.max(0, Math.ceil((session.endTime - now) / 1000));
  }

  return session.remainingSeconds;
}

function synchronizeSession(
  session: SavedFocusSession,
  now: number = Date.now(),
): SavedFocusSession {
  if (!session.running) {
    return session;
  }

  const remaining = getRemainingSeconds(session, now);

  if (remaining > 0) {
    return {
      ...session,
      remainingSeconds: remaining,
    };
  }

  return {
    ...session,
    remainingSeconds: 0,
    running: false,
    endTime: null,
    finished: true,
  };
}

function loadSession(): SavedFocusSession {
  const fallback = createDefaultSession();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return fallback;
    }

    const parsed: unknown = JSON.parse(stored);

    if (!isRecord(parsed)) {
      return fallback;
    }

    if (
      typeof parsed.taskId !== "string" ||
      !isValidDuration(parsed.duration) ||
      typeof parsed.remainingSeconds !== "number" ||
      !Number.isFinite(parsed.remainingSeconds) ||
      typeof parsed.running !== "boolean" ||
      typeof parsed.finished !== "boolean" ||
      !(
        parsed.endTime === null ||
        (typeof parsed.endTime === "number" && Number.isFinite(parsed.endTime))
      )
    ) {
      return fallback;
    }

    const running = parsed.running && typeof parsed.endTime === "number";

    const duration = parsed.duration;

    const session: SavedFocusSession = {
      taskId: parsed.taskId,
      duration,
      remainingSeconds: Math.max(
        0,
        Math.min(duration * 60, Math.ceil(parsed.remainingSeconds)),
      ),
      running,
      endTime: running ? (parsed.endTime as number) : null,
      finished: parsed.finished,
    };

    return synchronizeSession(session);
  } catch (error) {
    console.error("FlowMind: could not restore focus session", error);

    return fallback;
  }
}

function saveSession(session: SavedFocusSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("FlowMind: could not save focus session", error);
  }
}

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));

  const minutes = Math.floor(safeSeconds / 60);

  const seconds = safeSeconds % 60;

  return (
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0")
  );
}

function FocusTimer({ tasks }: FocusTimerProps) {
  const [session, setSession] = useState<SavedFocusSession>(loadSession);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // The saved end timestamp is authoritative.
  // It lets us restore the correct remaining time
  // after navigating away or reopening the app.

  useEffect(() => {
    if (!session.running) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [session.running]);

  useEffect(() => {
    if (!session.running) {
      return;
    }

    if (getRemainingSeconds(session, currentTime) > 0) {
      return;
    }

    const completed = synchronizeSession(session, currentTime);

    setSession(completed);
    saveSession(completed);
  }, [session, currentTime]);

  const selectedTask =
    tasks.find((task) => task.id === session.taskId) ??
    (session.taskId === "" ? tasks[0] : null);

  const activeTaskId = selectedTask?.id ?? "";

  const totalSeconds = session.duration * 60;

  const remainingSeconds = getRemainingSeconds(session, currentTime);

  const progress =
    totalSeconds > 0
      ? Math.min(
          100,
          Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100),
        )
      : 0;

  const hasSavedTask = session.taskId !== "";

  const selectedTaskAvailable =
    selectedTask !== null && selectedTask !== undefined;

  function updateSession(nextSession: SavedFocusSession) {
    setSession(nextSession);
    setCurrentTime(Date.now());
    saveSession(nextSession);
  }

  function startTimer() {
    if (!selectedTaskAvailable || session.running) {
      return;
    }

    const remaining =
      session.finished || remainingSeconds <= 0
        ? totalSeconds
        : remainingSeconds;

    const now = Date.now();

    updateSession({
      ...session,
      taskId: activeTaskId,
      remainingSeconds: remaining,
      running: true,
      endTime: now + remaining * 1000,
      finished: false,
    });
  }

  function pauseTimer() {
    if (!session.running) {
      return;
    }

    const remaining = getRemainingSeconds(session, Date.now());

    updateSession({
      ...session,
      remainingSeconds: remaining,
      running: false,
      endTime: null,
      finished: remaining === 0,
    });
  }

  function resetTimer() {
    updateSession({
      ...session,
      taskId: activeTaskId,
      remainingSeconds: totalSeconds,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  function changeDuration(duration: SessionDuration) {
    if (session.running) {
      return;
    }

    updateSession({
      ...session,
      duration,
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

    updateSession({
      ...session,
      taskId,
      remainingSeconds: totalSeconds,
      running: false,
      endTime: null,
      finished: false,
    });
  }

  const statusText = session.finished
    ? "Session complete!"
    : session.running
      ? "Stay focused"
      : remainingSeconds < totalSeconds
        ? "Session paused"
        : "Ready to focus";

  return (
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
          {statusText}
        </span>
      </div>

      <p className="fm-focus-timer-description">
        Work on one task at a time. Your session is saved automatically, even
        when you leave this page.
      </p>

      <div className="fm-focus-timer-settings">
        <div className="fm-focus-timer-field">
          <label htmlFor="fm-focus-task">Focus Task</label>

          <select
            id="fm-focus-task"
            value={activeTaskId}
            disabled={session.running || tasks.length === 0}
            onChange={(event) => changeTask(event.target.value)}
          >
            {tasks.length === 0 ? (
              <option value="">Choose focus tasks first</option>
            ) : (
              <>
                {hasSavedTask && !selectedTaskAvailable && (
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
          {formatTime(remainingSeconds)}
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
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <span className="fm-focus-timer-progress-label">
          {Math.round(progress)}% completed
        </span>
      </div>

      {session.finished && (
        <div className="fm-focus-timer-complete" role="status">
          🎉 Great work! Your focus session is complete. You can start another
          session or mark your task as done.
        </div>
      )}

      {!selectedTaskAvailable && hasSavedTask && (
        <div className="fm-focus-timer-complete" role="status">
          Your previous focus task is no longer in today's focus list. Select
          another task or reset your focus selection.
        </div>
      )}

      <div className="fm-focus-timer-actions">
        {session.running ? (
          <button
            type="button"
            className="fm-focus-timer-primary"
            onClick={pauseTimer}
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            type="button"
            className="fm-focus-timer-primary"
            disabled={!selectedTaskAvailable}
            onClick={startTimer}
          >
            ▶{" "}
            {session.finished
              ? "Start Again"
              : remainingSeconds < totalSeconds
                ? "Resume Focus"
                : "Start Focus"}
          </button>
        )}

        <button
          type="button"
          className="fm-focus-timer-secondary"
          onClick={resetTimer}
        >
          ↺ Reset
        </button>
      </div>

      <p className="fm-focus-timer-hint">
        The session continues in real time when you switch pages or reopen
        FlowMind. No internet connection is required.
      </p>
    </section>
  );
}

export default FocusTimer;
