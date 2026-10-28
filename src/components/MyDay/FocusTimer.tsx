import { useEffect, useRef, useState } from "react";

import type { Task } from "../../types";

import "./FocusTimer.css";

interface FocusTimerProps {
  tasks: Task[];
}

type SessionDuration = 15 | 25 | 45;

const DEFAULT_DURATION: SessionDuration = 25;

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return (
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0")
  );
}

function FocusTimer({ tasks }: FocusTimerProps) {
  const [duration, setDuration] = useState<SessionDuration>(DEFAULT_DURATION);

  const [selectedTaskId, setSelectedTaskId] = useState("");

  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_DURATION * 60,
  );

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const endTimeRef = useRef<number | null>(null);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;

  const activeTaskId = selectedTask?.id ?? "";

  const totalSeconds = duration * 60;

  const progress =
    totalSeconds > 0
      ? Math.min(
          100,
          Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100),
        )
      : 0;

  // Keep the countdown accurate even when the app
  // is not actively rendering every second.

  useEffect(() => {
    if (!running) {
      return;
    }

    const updateTimer = () => {
      if (endTimeRef.current === null) {
        return;
      }

      const secondsLeft = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      );

      setRemainingSeconds(secondsLeft);

      if (secondsLeft === 0) {
        endTimeRef.current = null;
        setRunning(false);
        setFinished(true);
      }
    };

    const interval = window.setInterval(updateTimer, 250);

    updateTimer();

    return () => {
      window.clearInterval(interval);
    };
  }, [running]);

  // If a selected task is completed and disappears
  // from today's focus list, stop its session.

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
      endTimeRef.current = null;
      setRunning(false);
      setFinished(false);
      setRemainingSeconds(duration * 60);
      setSelectedTaskId("");
    }
  }, [tasks, selectedTaskId, duration]);

  function startTimer() {
    if (!selectedTask || running) {
      return;
    }

    const secondsToStart =
      remainingSeconds > 0 ? remainingSeconds : totalSeconds;

    setRemainingSeconds(secondsToStart);
    setFinished(false);

    endTimeRef.current = Date.now() + secondsToStart * 1000;

    setRunning(true);
  }

  function pauseTimer() {
    if (!running) {
      return;
    }

    if (endTimeRef.current !== null) {
      const secondsLeft = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      );

      setRemainingSeconds(secondsLeft);
    }

    endTimeRef.current = null;
    setRunning(false);
  }

  function resetTimer() {
    endTimeRef.current = null;
    setRunning(false);
    setFinished(false);
    setRemainingSeconds(totalSeconds);
  }

  function changeDuration(newDuration: SessionDuration) {
    endTimeRef.current = null;
    setRunning(false);
    setFinished(false);

    setDuration(newDuration);
    setRemainingSeconds(newDuration * 60);
  }

  function changeTask(taskId: string) {
    endTimeRef.current = null;
    setRunning(false);
    setFinished(false);

    setSelectedTaskId(taskId);
    setRemainingSeconds(totalSeconds);
  }

  const statusText = finished
    ? "Session complete!"
    : running
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
          className={`fm-focus-timer-status ${running ? "running" : ""} ${
            finished ? "finished" : ""
          }`}
          role="status"
        >
          {statusText}
        </span>
      </div>

      <p className="fm-focus-timer-description">
        Work on one task at a time. Start a distraction-free focus session.
      </p>

      <div className="fm-focus-timer-settings">
        <div className="fm-focus-timer-field">
          <label htmlFor="fm-focus-task">Focus Task</label>

          <select
            id="fm-focus-task"
            value={activeTaskId}
            disabled={running || tasks.length === 0}
            onChange={(event) => changeTask(event.target.value)}
          >
            {tasks.length === 0 ? (
              <option value="">Choose focus tasks first</option>
            ) : (
              tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="fm-focus-timer-field">
          <label htmlFor="fm-focus-duration">Duration</label>

          <select
            id="fm-focus-duration"
            value={duration}
            disabled={running}
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
          className={`fm-focus-timer-time ${running ? "active" : ""}`}
          role="timer"
          aria-label="Time remaining"
        >
          {formatTime(remainingSeconds)}
        </div>

        <p className="fm-focus-timer-subtitle">
          {finished
            ? "You completed your focus session!"
            : running
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

      {finished && (
        <div className="fm-focus-timer-complete" role="status">
          🎉 Great work! Your focus session is complete. You can start another
          session or mark the task as completed in My Day.
        </div>
      )}

      <div className="fm-focus-timer-actions">
        {running ? (
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
            disabled={!selectedTask}
            onClick={startTimer}
          >
            ▶{" "}
            {finished
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
        Your timer runs while My Day stays open. Switching away from this page
        resets the session.
      </p>
    </section>
  );
}

export default FocusTimer;
