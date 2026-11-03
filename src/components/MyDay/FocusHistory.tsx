import { useEffect, useState } from "react";

import {
  formatFocusMinutes,
  getFocusHistoryStats,
} from "../../utils/focusHistory";

import type { FocusHistoryEntry } from "../../utils/focusHistory";

import "./FocusHistory.css";

interface FocusHistoryProps {
  entries: FocusHistoryEntry[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

function sessionDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function FocusHistory({
  entries,
  loading = false,
  error = "",
  onRefresh,
}: FocusHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
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
        onClick={() => {
          setExpanded((value) => !value);
        }}
      >
        <span className="fm-focus-history-toggle-copy">
          <span className="fm-focus-history-eyebrow">YOUR PROGRESS</span>

          <strong>Focus History</strong>

          <small>
            {loading
              ? "Loading sessions..."
              : `${stats.totalSessions} completed sessions`}
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
          {error && (
            <div className="fm-focus-history-note" role="alert">
              <p>{error}</p>

              {onRefresh && (
                <button type="button" onClick={onRefresh}>
                  Retry loading
                </button>
              )}
            </div>
          )}

          {loading && (
            <p className="fm-focus-history-note" role="status">
              Loading your focus history...
            </p>
          )}

          {!loading && !error && (
            <>
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
                Only completed sessions are counted. History is saved to your
                private FlowMind account.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
