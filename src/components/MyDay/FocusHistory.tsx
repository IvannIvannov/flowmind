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

function formatSessionDate(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function FocusHistory() {
  const [entries, setEntries] = useState<FocusHistoryEntry[]>(loadFocusHistory);

  useEffect(() => {
    function refreshHistory() {
      setEntries(loadFocusHistory());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === FOCUS_HISTORY_KEY) {
        refreshHistory();
      }
    }

    window.addEventListener(FOCUS_HISTORY_UPDATED, refreshHistory);

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(FOCUS_HISTORY_UPDATED, refreshHistory);

      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const stats = getFocusHistoryStats(entries);

  const recentSessions = entries.slice(0, 8);

  return (
    <section className="fm-focus-history" aria-label="Focus history">
      <div className="fm-focus-history-header">
        <div>
          <p className="fm-focus-history-eyebrow">YOUR PRODUCTIVITY</p>

          <h2>Focus History 📊</h2>
        </div>

        <span className="fm-focus-history-total">
          {formatFocusMinutes(stats.totalMinutes)} total
        </span>
      </div>

      <p className="fm-focus-history-description">
        Track your completed focus sessions and see how much time you have spent
        working on your tasks.
      </p>

      <div className="fm-focus-history-stats">
        <div className="fm-focus-history-stat">
          <span className="fm-focus-history-stat-icon">☀️</span>

          <span className="fm-focus-history-stat-label">Today</span>

          <strong>{formatFocusMinutes(stats.todayMinutes)}</strong>
        </div>

        <div className="fm-focus-history-stat">
          <span className="fm-focus-history-stat-icon">📅</span>

          <span className="fm-focus-history-stat-label">This Week</span>

          <strong>{formatFocusMinutes(stats.weekMinutes)}</strong>
        </div>

        <div className="fm-focus-history-stat">
          <span className="fm-focus-history-stat-icon">🎯</span>

          <span className="fm-focus-history-stat-label">Sessions</span>

          <strong>{stats.totalSessions}</strong>
        </div>
      </div>

      <div className="fm-focus-history-section-heading">
        <h3>Recent Sessions</h3>

        <span>Latest {recentSessions.length}</span>
      </div>

      {recentSessions.length === 0 ? (
        <div className="fm-focus-history-empty">
          <span>⏱️</span>

          <h3>No sessions yet</h3>

          <p>
            Complete your first Focus Session to start tracking your progress.
          </p>
        </div>
      ) : (
        <div className="fm-focus-history-list">
          {recentSessions.map((entry) => (
            <article key={entry.id} className="fm-focus-history-item">
              <span className="fm-focus-history-check">✓</span>

              <div className="fm-focus-history-item-info">
                <h4>{entry.taskTitle}</h4>

                <p>{formatSessionDate(entry.completedAt)}</p>
              </div>

              <span className="fm-focus-history-duration">
                {formatFocusMinutes(entry.durationMinutes)}
              </span>
            </article>
          ))}
        </div>
      )}

      <p className="fm-focus-history-note">
        Completed focus sessions are saved locally on this device. Paused or
        reset sessions are not counted.
      </p>
    </section>
  );
}

export default FocusHistory;
