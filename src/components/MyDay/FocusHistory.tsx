import { useEffect, useState } from "react";

import {
  FOCUS_HISTORY_KEY,
  FOCUS_HISTORY_UPDATED,
  formatFocusMinutes,
  getFocusHistoryStats,
  loadFocusHistory,
} from "../../utils/focusHistory";

import type { FocusHistoryEntry } from "../../utils/focusHistory";

import "./FocusHistory.css";

function sessionDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function FocusHistory() {
  const [entries, setEntries] = useState<FocusHistoryEntry[]>(loadFocusHistory);

  const [expanded, setExpanded] = useState(false);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    function refresh() {
      setEntries(loadFocusHistory());
      setNow(new Date());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === FOCUS_HISTORY_KEY) {
        refresh();
      }
    }

    window.addEventListener(FOCUS_HISTORY_UPDATED, refresh);

    window.addEventListener("storage", handleStorage);

    const interval = window.setInterval(() => setNow(new Date()), 60000);

    return () => {
      window.removeEventListener(FOCUS_HISTORY_UPDATED, refresh);

      window.removeEventListener("storage", handleStorage);

      window.clearInterval(interval);
    };
  }, []);

  const stats = getFocusHistoryStats(entries, now);

  const recentSessions = entries.slice(0, 8);

  return (
    <section className="fm-focus-history" aria-label="Focus history">
      <button
        type="button"
        className="fm-focus-history-toggle"
        aria-expanded={expanded}
        aria-controls="fm-focus-history-details"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="fm-focus-history-toggle-copy">
          <span className="fm-focus-history-eyebrow">YOUR PROGRESS</span>

          <strong>Focus History</strong>

          <small>
            {stats.totalSessions} completed sessions
            {" · "}
            {formatFocusMinutes(stats.totalMinutes)} total
          </small>
        </span>

        <span
          className={`fm-focus-history-chevron ${expanded ? "expanded" : ""}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {expanded && (
        <div id="fm-focus-history-details" className="fm-focus-history-details">
          <div className="fm-focus-history-stats">
            <div className="fm-focus-history-stat">
              <span>Today</span>
              <strong>{formatFocusMinutes(stats.todayMinutes)}</strong>
            </div>

            <div className="fm-focus-history-stat">
              <span>This week</span>
              <strong>{formatFocusMinutes(stats.weekMinutes)}</strong>
            </div>

            <div className="fm-focus-history-stat">
              <span>All sessions</span>
              <strong>{stats.totalSessions}</strong>
            </div>
          </div>

          <div className="fm-focus-history-section-heading">
            <h3>Recent sessions</h3>
            <span>Latest {recentSessions.length}</span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="fm-focus-history-empty">
              <h3>No sessions yet</h3>
              <p>Complete a focus session to see your progress here.</p>
            </div>
          ) : (
            <div className="fm-focus-history-list">
              {recentSessions.map((entry) => (
                <article className="fm-focus-history-item" key={entry.id}>
                  <div className="fm-focus-history-item-info">
                    <h4>{entry.taskTitle}</h4>

                    <p>{sessionDate(entry.completedAt)}</p>
                  </div>

                  <span className="fm-focus-history-duration">
                    {formatFocusMinutes(entry.durationMinutes)}
                  </span>
                </article>
              ))}
            </div>
          )}

          <p className="fm-focus-history-note">
            Only completed sessions are counted. History is stored locally on
            your device.
          </p>
        </div>
      )}
    </section>
  );
}

export default FocusHistory;
