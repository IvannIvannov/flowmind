import { useMemo, useRef, useState } from "react";

import type { Project, Task } from "../../types";
import type { FocusHistoryEntry } from "../../utils/focusHistory";

import { executeFocusMigration } from "../../services/focusMigrationExecution";

interface Props {
  userId: string;
  localEntries: FocusHistoryEntry[];
  cloudEntries: FocusHistoryEntry[];
  localTasks: Task[];
  cloudTasks: Task[];
  cloudProjects: Project[];
  onImported: () => Promise<void>;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function sameSession(a: FocusHistoryEntry, b: FocusHistoryEntry): boolean {
  return (
    normalize(a.taskTitle) === normalize(b.taskTitle) &&
    a.durationMinutes === b.durationMinutes &&
    Date.parse(a.completedAt) === Date.parse(b.completedAt)
  );
}

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Could not import Focus session.";
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : value;
}

export default function FocusImportPanel({
  userId,
  localEntries,
  cloudEntries,
  localTasks,
  cloudTasks,
  cloudProjects,
  onImported,
}: Props) {
  const [selectedEntryId, setSelectedEntryId] = useState("");

  const [targetTaskId, setTargetTaskId] = useState("");

  const [confirming, setConfirming] = useState(false);

  const [confirmation, setConfirmation] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const busyRef = useRef(false);

  const selectedEntry = localEntries.find(
    (entry) => entry.id === selectedEntryId,
  );

  const destinationTask = cloudTasks.find((task) => task.id === targetTaskId);

  const destinationProject = destinationTask?.projectId
    ? cloudProjects.find((project) => project.id === destinationTask.projectId)
    : undefined;

  const suggestions = useMemo(() => {
    if (!selectedEntry) return [];

    const original = localTasks.find(
      (task) => task.id === selectedEntry.taskId,
    );

    const title = normalize(original?.title ?? selectedEntry.taskTitle);

    return cloudTasks.filter((task) => normalize(task.title) === title);
  }, [selectedEntry, localTasks, cloudTasks]);

  function blockedReason(entry: FocusHistoryEntry): string | null {
    if (
      !entry.id.trim() ||
      !entry.taskId.trim() ||
      !entry.taskTitle.trim() ||
      !Number.isFinite(entry.durationMinutes) ||
      entry.durationMinutes <= 0 ||
      !Number.isFinite(Date.parse(entry.completedAt))
    ) {
      return "Invalid session data";
    }

    if (
      cloudEntries.some(
        (cloud) => cloud.id === entry.id || sameSession(cloud, entry),
      )
    ) {
      return "Already imported or possible duplicate";
    }

    if (localEntries.filter((other) => sameSession(other, entry)).length > 1) {
      return "Repeated legacy session — manual review required";
    }

    return null;
  }

  function resetConfirmation(): void {
    setConfirming(false);
    setConfirmation("");
    setError("");
  }

  function chooseEntry(id: string): void {
    if (busy) return;

    setSelectedEntryId(id);
    setTargetTaskId("");
    setSuccess("");
    resetConfirmation();
  }

  async function runImport(): Promise<void> {
    if (
      busyRef.current ||
      confirmation !== "IMPORT" ||
      !selectedEntry ||
      !destinationTask ||
      blockedReason(selectedEntry)
    ) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await executeFocusMigration({
        userId,
        localAtReview: localEntries,
        cloudAtReview: cloudEntries,
        selectedEntryId: selectedEntry.id,
        targetTaskId: destinationTask.id,
        cloudTasksAtReview: cloudTasks,
        cloudProjectsAtReview: cloudProjects,
      });

      setSuccess(`${result.created} Focus session imported successfully.`);

      setSelectedEntryId("");
      setTargetTaskId("");
      setConfirming(false);
      setConfirmation("");

      try {
        await onImported();
      } catch (cause) {
        setError(
          "The session was imported, but refreshing failed: " +
            errorText(cause),
        );
      }
    } catch (cause) {
      setError(errorText(cause));

      // No blind retry after a possibly completed
      // request; a new comparison is required.
      setSelectedEntryId("");
      setTargetTaskId("");
      setConfirming(false);
      setConfirmation("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="fm-migration-panel">
      <p className="fm-migration-eyebrow">STEP 8 · FOCUS HISTORY</p>

      <h3>Import legacy Focus History</h3>

      <p className="fm-migration-muted">
        Choose one historical session and link it to an existing cloud task.
        Your original local history will remain unchanged.
      </p>

      <p className="fm-migration-small">
        {localEntries.length} local sessions · {cloudEntries.length} cloud
        sessions
      </p>

      {success && <p role="status">{success}</p>}

      {error && (
        <div role="alert" className="fm-migration-error fm-migration-panel">
          <strong>Focus import issue</strong>
          <p>{error}</p>

          <p className="fm-migration-small">
            Refresh the main comparison before retrying an uncertain import.
          </p>
        </div>
      )}

      {localEntries.map((entry) => {
        const reason = blockedReason(entry);
        const selected = selectedEntryId === entry.id;

        return (
          <label
            className={
              "fm-migration-record" +
              (reason ? " fm-migration-record-disabled" : "")
            }
            key={entry.id}
          >
            <input
              type="radio"
              name="legacy-focus-session"
              checked={selected}
              disabled={busy || reason !== null}
              onChange={() => chooseEntry(entry.id)}
            />

            <div>
              <strong>{entry.taskTitle}</strong>

              <p className="fm-migration-small">
                {entry.durationMinutes} minutes ·{" "}
                {formatDate(entry.completedAt)}
              </p>

              <p className="fm-migration-small">
                {reason ?? "Available for manual mapping"}
              </p>
            </div>
          </label>
        );
      })}

      {selectedEntry && (
        <div className="fm-migration-panel" style={{ marginTop: 20 }}>
          <h3>Task mapping</h3>

          <p className="fm-migration-small">
            Original task: {selectedEntry.taskTitle}
          </p>

          {suggestions.length > 0 && (
            <p className="fm-migration-small">
              Suggested matches:{" "}
              {suggestions.map((task) => task.title).join(", ")}
            </p>
          )}

          <label className="fm-migration-field">
            <span>Select destination cloud task</span>

            <select
              value={targetTaskId}
              disabled={busy}
              onChange={(event) => {
                setTargetTaskId(event.target.value);
                resetConfirmation();
              }}
            >
              <option value="">Choose a cloud task...</option>

              {cloudTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>

          {destinationTask && (
            <div className="fm-migration-panel">
              <strong>Selected destination</strong>

              <p>{destinationTask.title}</p>

              <p className="fm-migration-small">
                Project: {destinationProject?.name ?? "No assigned project"}
              </p>

              <p className="fm-migration-small">
                The historical session title remains unchanged, but its task and
                project references will use this destination.
              </p>

              {normalize(destinationTask.title) !==
                normalize(selectedEntry.taskTitle) && (
                <p role="alert">
                  Warning: the destination task has a different title. Verify
                  that it represents the same work.
                </p>
              )}
            </div>
          )}

          {!confirming ? (
            <button
              type="button"
              className="fm-migration-button"
              disabled={busy || !destinationTask}
              onClick={() => setConfirming(true)}
            >
              Review Focus import
            </button>
          ) : (
            <div className="fm-migration-panel">
              <h3>Final confirmation</h3>

              <p className="fm-migration-small">
                Import one Focus session: {selectedEntry.taskTitle}
              </p>

              <p className="fm-migration-small">
                Duration: {selectedEntry.durationMinutes} minutes
              </p>

              <p className="fm-migration-small">
                Destination task: {destinationTask?.title}
              </p>

              <p className="fm-migration-small">Type IMPORT to confirm.</p>

              <input
                type="text"
                value={confirmation}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                placeholder="IMPORT"
                aria-label="Confirm Focus import"
                onChange={(event) => setConfirmation(event.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 240,
                  padding: 10,
                  borderRadius: 8,
                  color: "var(--fm-text)",
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-border)",
                }}
              />

              <div className="fm-migration-actions">
                <button
                  type="button"
                  className="fm-migration-button"
                  disabled={
                    busy || confirmation !== "IMPORT" || !destinationTask
                  }
                  onClick={() => {
                    void runImport();
                  }}
                >
                  {busy ? "Importing..." : "Confirm Focus import"}
                </button>

                <button
                  type="button"
                  className="fm-migration-button"
                  disabled={busy}
                  onClick={resetConfirmation}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="fm-migration-small">
        Import uses a new unique session ID, preserves the historical completion
        time and never overwrites existing cloud sessions.
      </p>
    </section>
  );
}
