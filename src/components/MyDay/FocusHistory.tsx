import { useEffect, useMemo, useState } from "react";

import {
  FOCUS_HISTORY_KEY,
  FOCUS_HISTORY_UPDATED,
  filterFocusEntries,
  focusWeekStart,
  formatFocusMinutes,
  getFocusHistoryStats,
  getProjectFocusStats,
  loadFocusHistory,
  localFocusDateKey,
} from "../../utils/focusHistory";

import type { FocusHistoryEntry, FocusPeriod } from "../../utils/focusHistory";

import { loadProjects } from "../../utils/storage";

import "./FocusHistory.css";

type WeekOffset = 0 | -1;

interface DayActivity {
  key: string;
  label: string;
  dateLabel: string;
  minutes: number;
  sessions: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PROJECT_COLORS = [
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#f472b6",
];

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
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

function weekRange(start: Date): string {
  const format = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });

  return format.format(start) + " – " + format.format(addDays(start, 6));
}

function weeklyActivity(
  entries: FocusHistoryEntry[],
  now: Date,
  offset: WeekOffset,
): DayActivity[] {
  const monday = focusWeekStart(now);
  const start = addDays(monday, offset * 7);

  const days: DayActivity[] = WEEKDAYS.map((label, index) => {
    const date = addDays(start, index);

    return {
      key: localFocusDateKey(date),
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

  const period = offset === 0 ? "this-week" : "last-week";

  const matching = filterFocusEntries(entries, period, now);

  for (const entry of matching) {
    const day = byDate.get(localFocusDateKey(new Date(entry.completedAt)));

    if (day) {
      day.minutes += entry.durationMinutes;
      day.sessions += 1;
    }
  }

  return days;
}

function FocusHistory() {
  const [entries, setEntries] = useState<FocusHistoryEntry[]>(loadFocusHistory);

  const [now, setNow] = useState(() => new Date());

  const [weekOffset, setWeekOffset] = useState<WeekOffset>(0);

  const [projectPeriod, setProjectPeriod] = useState<FocusPeriod>("this-week");

  useEffect(() => {
    function refresh() {
      setEntries(loadFocusHistory());
      setNow(new Date());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === FOCUS_HISTORY_KEY) {
        refresh();
      }
    }

    window.addEventListener(FOCUS_HISTORY_UPDATED, refresh);

    window.addEventListener("storage", onStorage);

    const interval = window.setInterval(() => setNow(new Date()), 60000);

    return () => {
      window.removeEventListener(FOCUS_HISTORY_UPDATED, refresh);

      window.removeEventListener("storage", onStorage);

      window.clearInterval(interval);
    };
  }, []);

  const stats = useMemo(
    () => getFocusHistoryStats(entries, now),
    [entries, now],
  );

  const days = useMemo(
    () => weeklyActivity(entries, now, weekOffset),
    [entries, now, weekOffset],
  );

  const projectEntries = useMemo(
    () => filterFocusEntries(entries, projectPeriod, now),
    [entries, projectPeriod, now],
  );

  const projects = useMemo(
    () => getProjectFocusStats(projectEntries),
    [projectEntries],
  );

  const savedProjects = useMemo(() => loadProjects(), [entries]);

  const totalProjectMinutes = projects.reduce(
    (sum, item) => sum + item.minutes,
    0,
  );

  const weekMinutes = days.reduce((sum, day) => sum + day.minutes, 0);

  const weekSessions = days.reduce((sum, day) => sum + day.sessions, 0);

  const activeDays = days.filter((day) => day.sessions > 0).length;

  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));

  const monday = focusWeekStart(now);
  const weekStart = addDays(monday, weekOffset * 7);

  const recentSessions = entries.slice(0, 8);

  function projectColor(projectId: string | undefined, index: number): string {
    const project = savedProjects.find((item) => item.id === projectId);

    return project?.color || PROJECT_COLORS[index % PROJECT_COLORS.length];
  }

  return (
    <section className="fm-focus-history" aria-label="Productivity analytics">
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
        Track your completed work sessions, weekly activity and time by project.
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

            <p className="fm-focus-analytics-range">{weekRange(weekStart)}</p>
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
          aria-label={days
            .map((day) => `${day.label}: ${day.minutes} minutes`)
            .join(", ")}
        >
          {days.map((day) => {
            const height =
              day.minutes > 0
                ? Math.max(6, (day.minutes / maxMinutes) * 100)
                : 0;

            const isToday = day.key === localFocusDateKey(now);

            return (
              <div key={day.key} className="fm-focus-analytics-day">
                <span className="fm-focus-analytics-value">
                  {day.minutes ? formatFocusMinutes(day.minutes) : "—"}
                </span>

                <div className="fm-focus-analytics-bar-track">
                  <div
                    className={`fm-focus-analytics-bar ${
                      isToday ? "today" : ""
                    }`}
                    style={{
                      height: `${height}%`,
                    }}
                    title={`${day.dateLabel}: ` + `${day.sessions} sessions`}
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
            No sessions recorded for this period.
          </p>
        )}

        <p className="fm-focus-analytics-footnote">
          Activity is grouped by the local date when each session finished.
        </p>
      </div>

      {/* PROJECT ANALYTICS */}

      <div className="fm-project-analytics">
        <div className="fm-project-analytics-heading">
          <div>
            <p className="fm-focus-history-eyebrow">PROJECT ANALYTICS</p>

            <h3>Time by Project</h3>

            <p>See where your focused work time goes.</p>
          </div>

          <select
            className="fm-project-analytics-period"
            aria-label="Project analytics period"
            value={projectPeriod}
            onChange={(event) =>
              setProjectPeriod(event.target.value as FocusPeriod)
            }
          >
            <option value="this-week">This Week</option>
            <option value="last-week">Last Week</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div className="fm-project-analytics-summary">
          <div>
            <span>Tracked Time</span>
            <strong>{formatFocusMinutes(totalProjectMinutes)}</strong>
          </div>

          <div>
            <span>Sessions</span>
            <strong>{projectEntries.length}</strong>
          </div>

          <div>
            <span>Groups</span>
            <strong>{projects.length}</strong>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="fm-focus-history-empty">
            <span>📁</span>
            <h3>No project activity yet</h3>
            <p>Complete a focus session to start tracking time by project.</p>
          </div>
        ) : (
          <div className="fm-project-analytics-list">
            {projects.map((project, index) => {
              const percentage =
                totalProjectMinutes > 0
                  ? (project.minutes / totalProjectMinutes) * 100
                  : 0;

              const color = projectColor(project.projectId, index);

              return (
                <div className="fm-project-analytics-item" key={project.key}>
                  <div className="fm-project-analytics-item-top">
                    <div className="fm-project-analytics-name">
                      <span
                        className="fm-project-analytics-dot"
                        style={{
                          backgroundColor: color,
                        }}
                      />

                      <strong>{project.name}</strong>
                    </div>

                    <span>{formatFocusMinutes(project.minutes)}</span>
                  </div>

                  <div className="fm-project-analytics-track">
                    <div
                      className="fm-project-analytics-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>

                  <div className="fm-project-analytics-item-bottom">
                    <span>{project.sessions} session(s)</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="fm-focus-analytics-footnote">
          Earlier sessions without project information are grouped separately.
          New sessions record their project automatically.
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

                <p>
                  {entry.projectName ? `${entry.projectName} · ` : ""}
                  {formatSessionDate(entry.completedAt)}
                </p>
              </div>

              <span className="fm-focus-history-duration">
                {formatFocusMinutes(entry.durationMinutes)}
              </span>
            </article>
          ))}
        </div>
      )}

      <p className="fm-focus-history-note">
        Only fully completed sessions are included. Data is stored locally on
        this device.
      </p>
    </section>
  );
}

export default FocusHistory;
