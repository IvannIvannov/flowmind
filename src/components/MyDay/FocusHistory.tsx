import { useEffect, useMemo, useState } from "react";

import {
  FOCUS_HISTORY_KEY,
  FOCUS_HISTORY_UPDATED,
  formatFocusMinutes,
  getFocusHistoryStats,
  loadFocusHistory,
} from "../../utils/focusHistory";

import type { FocusHistoryEntry } from "../../utils/focusHistory";

import "./FocusHistory.css";

type WeekOffset = 0 | -1;

interface DayActivity {
  key: string;
  label: string;
  dateLabel: string;
  minutes: number;
  sessions: number;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const mondayOffset = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - mondayOffset);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  result.setDate(result.getDate() + days);

  return result;
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });

  return formatter.format(start) + " – " + formatter.format(end);
}

function buildWeekActivity(
  entries: FocusHistoryEntry[],
  today: Date,
  weekOffset: WeekOffset,
): DayActivity[] {
  const weekStart = startOfWeek(today);

  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const days: DayActivity[] = WEEKDAY_LABELS.map((label, index) => {
    const date = addDays(weekStart, index);

    return {
      key: dateKey(date),
      label,
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(date),
      minutes: 0,
      sessions: 0,
    };
  });

  const byDate = new Map(days.map((day) => [day.key, day]));

  for (const entry of entries) {
    const completed = new Date(entry.completedAt);

    if (
      Number.isNaN(completed.getTime()) ||
      completed.getTime() > today.getTime()
    ) {
      continue;
    }

    const day = byDate.get(dateKey(completed));

    if (!day) {
      continue;
    }

    day.minutes += entry.durationMinutes;
    day.sessions += 1;
  }

  return days;
}

function FocusHistory() {
  const [entries, setEntries] = useState<FocusHistoryEntry[]>(loadFocusHistory);

  const [weekOffset, setWeekOffset] = useState<WeekOffset>(0);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    function refreshHistory() {
      setEntries(loadFocusHistory());
      setNow(new Date());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === FOCUS_HISTORY_KEY) {
        refreshHistory();
      }
    }

    window.addEventListener(FOCUS_HISTORY_UPDATED, refreshHistory);

    window.addEventListener("storage", handleStorage);

    const refreshTime = window.setInterval(() => setNow(new Date()), 60000);

    return () => {
      window.removeEventListener(FOCUS_HISTORY_UPDATED, refreshHistory);

      window.removeEventListener("storage", handleStorage);

      window.clearInterval(refreshTime);
    };
  }, []);

  const stats = useMemo(
    () => getFocusHistoryStats(entries, now),
    [entries, now],
  );

  const days = useMemo(
    () => buildWeekActivity(entries, now, weekOffset),
    [entries, now, weekOffset],
  );

  const weekStart = startOfWeek(now);

  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekMinutes = days.reduce((sum, day) => sum + day.minutes, 0);

  const weekSessions = days.reduce((sum, day) => sum + day.sessions, 0);

  const activeDays = days.filter((day) => day.sessions > 0).length;

  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));

  const recentSessions = entries.slice(0, 8);

  const selectedWeekLabel = weekOffset === 0 ? "This Week" : "Last Week";

  return (
    <section
      className="fm-focus-history"
      aria-label="Focus history and productivity analytics"
    >
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
        Understand your focus habits and track completed work sessions over
        time.
      </p>

      {/* OVERALL STATISTICS */}

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

          <span className="fm-focus-history-stat-label">Total Sessions</span>

          <strong>{stats.totalSessions}</strong>
        </div>
      </div>

      {/* WEEKLY ANALYTICS */}

      <div className="fm-focus-analytics">
        <div className="fm-focus-analytics-heading">
          <div>
            <p className="fm-focus-history-eyebrow">FOCUS ANALYTICS</p>

            <h3>Weekly Activity</h3>

            <p className="fm-focus-analytics-range">
              {formatWeekRange(weekStart)}
            </p>
          </div>

          <div
            className="fm-focus-analytics-switch"
            role="group"
            aria-label="Choose week"
          >
            <button
              type="button"
              className={weekOffset === -1 ? "active" : ""}
              aria-pressed={weekOffset === -1}
              onClick={() => setWeekOffset(-1)}
            >
              Last Week
            </button>

            <button
              type="button"
              className={weekOffset === 0 ? "active" : ""}
              aria-pressed={weekOffset === 0}
              onClick={() => setWeekOffset(0)}
            >
              This Week
            </button>
          </div>
        </div>

        <div className="fm-focus-analytics-summary">
          <div>
            <span>Focus Time</span>

            <strong>{formatFocusMinutes(weekMinutes)}</strong>
          </div>

          <div>
            <span>Sessions</span>

            <strong>{weekSessions}</strong>
          </div>

          <div>
            <span>Active Days</span>

            <strong>{activeDays}/7</strong>
          </div>
        </div>

        <div
          className="fm-focus-analytics-chart"
          role="img"
          aria-label={
            `${selectedWeekLabel}: ` +
            days.map((day) => `${day.label} ${day.minutes} minutes`).join(", ")
          }
        >
          {days.map((day) => {
            const height =
              day.minutes > 0
                ? Math.max(6, (day.minutes / maxMinutes) * 100)
                : 0;

            const isToday = day.key === dateKey(now);

            return (
              <div key={day.key} className="fm-focus-analytics-day">
                <span className="fm-focus-analytics-value">
                  {day.minutes > 0 ? formatFocusMinutes(day.minutes) : "—"}
                </span>

                <div className="fm-focus-analytics-bar-track">
                  <div
                    className={`fm-focus-analytics-bar ${
                      isToday ? "today" : ""
                    }`}
                    style={{
                      height: `${height}%`,
                    }}
                    title={
                      `${day.dateLabel}: ` +
                      `${day.minutes} minutes, ` +
                      `${day.sessions} sessions`
                    }
                  />
                </div>

                <span
                  className={`fm-focus-analytics-day-name ${
                    isToday ? "today" : ""
                  }`}
                >
                  {day.label}
                </span>

                <span className="fm-focus-analytics-day-date">
                  {day.dateLabel}
                </span>
              </div>
            );
          })}
        </div>

        {weekSessions === 0 && (
          <p className="fm-focus-analytics-empty">
            No completed focus sessions recorded for{" "}
            {selectedWeekLabel.toLowerCase()}.
          </p>
        )}

        <p className="fm-focus-analytics-footnote">
          Activity is grouped by the local date when each focus session was
          completed.
        </p>
      </div>

      {/* RECENT SESSIONS */}

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
        Only fully completed focus sessions are counted. Data is stored locally
        on this device.
      </p>
    </section>
  );
}

export default FocusHistory;
