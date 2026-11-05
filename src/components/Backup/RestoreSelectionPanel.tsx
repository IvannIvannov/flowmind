import { useMemo, useRef, useState } from "react";

import type { FlowMindBackup } from "../../services/cloudBackup";

import {
  buildRestorePlan,
  expandRestoreSelection,
  removeRestoreSelection,
} from "../../services/restorePlan";

import type {
  RestorePlanItem,
  RestoreStatus,
} from "../../services/restorePlan";

import { executeSafeRestore } from "../../services/restoreExecution";

import type { RestoreExecutionResult } from "../../services/restoreExecution";

interface Props {
  archive: FlowMindBackup;
  cloud: FlowMindBackup;
}

const LABELS: Record<RestoreStatus, string> = {
  available: "Available",
  existing: "Already in cloud",
  conflict: "ID conflict",
  "possible-duplicate": "Possible duplicate",
  "missing-dependency": "Missing dependency",
};

const GROUPS = [
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "inbox", label: "Inbox" },
  { key: "focusHistory", label: "Focus History" },
  { key: "dayPriorities", label: "Daily Priorities" },
] as const;

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Restore failed.";
}

export default function RestoreSelectionPanel({ archive, cloud }: Props) {
  const plan = useMemo(
    () => buildRestorePlan(archive, cloud),
    [archive, cloud],
  );

  const [selected, setSelected] = useState<string[]>([]);

  const [showAll, setShowAll] = useState(true);

  const [confirming, setConfirming] = useState(false);

  const [confirmation, setConfirmation] = useState("");

  const [acknowledged, setAcknowledged] = useState(false);

  const [busy, setBusy] = useState(false);

  const [attempted, setAttempted] = useState(false);

  const [error, setError] = useState("");

  const [result, setResult] = useState<RestoreExecutionResult | null>(null);

  const busyRef = useRef(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const locked = busy || attempted;

  const selectedItems = plan.items.filter((item) => selectedSet.has(item.key));

  const selectedCounts = {
    projects: selectedItems.filter((item) => item.category === "projects")
      .length,

    tasks: selectedItems.filter((item) => item.category === "tasks").length,

    inbox: selectedItems.filter((item) => item.category === "inbox").length,

    focusHistory: selectedItems.filter(
      (item) => item.category === "focusHistory",
    ).length,

    dayPriorities: selectedItems.filter(
      (item) => item.category === "dayPriorities",
    ).length,
  };

  function resetConfirmation(): void {
    setConfirming(false);
    setConfirmation("");
    setAcknowledged(false);
    setError("");
  }

  function toggle(item: RestorePlanItem): void {
    if (locked || item.status !== "available") {
      return;
    }

    if (selectedSet.has(item.key)) {
      setSelected((previous) =>
        removeRestoreSelection(plan, previous, item.key),
      );
    } else {
      setSelected((previous) =>
        expandRestoreSelection(plan, [...previous, item.key]),
      );
    }

    resetConfirmation();
  }

  function selectAll(): void {
    if (locked) return;

    setSelected(
      expandRestoreSelection(
        plan,
        plan.items
          .filter((item) => item.status === "available")
          .map((item) => item.key),
      ),
    );

    resetConfirmation();
  }

  async function runRestore(): Promise<void> {
    if (
      busyRef.current ||
      attempted ||
      !confirming ||
      !acknowledged ||
      confirmation !== "RESTORE" ||
      selected.length === 0
    ) {
      return;
    }

    const validItems = plan.items.filter((item) => selectedSet.has(item.key));

    if (
      validItems.length !== selected.length ||
      validItems.some((item) => item.status !== "available")
    ) {
      setError(
        "Your selection is no longer valid. " +
          "Clear the preview and select the archive again.",
      );
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setAttempted(true);
    setError("");
    setResult(null);

    try {
      const completed = await executeSafeRestore({
        archive,
        cloudAtReview: cloud,
        selectedKeys: selected,
      });

      setResult(completed);
      setSelected([]);
      setConfirming(false);
      setConfirmation("");
      setAcknowledged(false);
    } catch (cause) {
      setError(errorText(cause));
      setConfirming(false);
      setConfirmation("");
      setAcknowledged(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="fm-migration-panel">
      <p className="fm-migration-eyebrow">RESTORE · FINAL STEP</p>

      <h3>Safe Restore Selection</h3>

      <p className="fm-migration-muted">
        Select records from the archive. Existing records, ID conflicts and
        possible duplicates are not selectable.
      </p>

      <div className="fm-migration-stats">
        {[
          ["Available", plan.available],
          ["Existing", plan.existing],
          ["Conflicts", plan.conflicts],
          ["Possible duplicates", plan.possibleDuplicates],
          ["Missing dependencies", plan.missingDependencies],
          ["Selected", selected.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="fm-migration-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="fm-migration-actions">
        <button
          type="button"
          className="fm-migration-button"
          disabled={locked || plan.available === 0}
          onClick={selectAll}
        >
          Select all available
        </button>

        <button
          type="button"
          className="fm-migration-button"
          disabled={locked || selected.length === 0}
          onClick={() => {
            setSelected([]);
            resetConfirmation();
          }}
        >
          Clear selection
        </button>

        <button
          type="button"
          className="fm-migration-button"
          onClick={() => setShowAll((previous) => !previous)}
        >
          {showAll ? "Show first 5" : "Show all"}
        </button>
      </div>

      {GROUPS.map((group) => {
        const items = plan.items.filter((item) => item.category === group.key);

        const displayed = showAll ? items : items.slice(0, 5);

        return (
          <div key={group.key} className="fm-migration-group">
            <h4>{group.label}</h4>

            <p className="fm-migration-small">
              {items.length} archived records
            </p>

            {items.length === 0 && (
              <p className="fm-migration-muted">No records in this category.</p>
            )}

            {displayed.map((item) => (
              <label
                key={item.key}
                className={
                  "fm-migration-record" +
                  (item.status !== "available"
                    ? " fm-migration-record-disabled"
                    : "")
                }
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(item.key)}
                  disabled={locked || item.status !== "available"}
                  onChange={() => toggle(item)}
                />

                <div>
                  <strong>{item.title || "(Untitled)"}</strong>

                  <span className="fm-migration-tag">
                    {LABELS[item.status]}
                  </span>

                  <p className="fm-migration-small">{item.reason}</p>

                  {item.dependencies.length > 0 && (
                    <p className="fm-migration-small">
                      Dependencies: {item.dependencies.length}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );
      })}

      <section className="fm-migration-panel">
        <h3>Selection summary</h3>

        <p className="fm-migration-muted">
          {selected.length} records selected for restoration.
        </p>

        <div className="fm-migration-stats">
          {[
            ["Projects", selectedCounts.projects],
            ["Tasks", selectedCounts.tasks],
            ["Inbox", selectedCounts.inbox],
            ["Focus", selectedCounts.focusHistory],
            ["Day priorities", selectedCounts.dayPriorities],
          ].map(([label, count]) => (
            <div key={String(label)} className="fm-migration-stat">
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>

        {selectedItems.length > 0 && (
          <ul className="fm-migration-selected">
            {selectedItems.map((item) => (
              <li key={item.key}>
                {item.title}
                <span>{item.category}</span>
              </li>
            ))}
          </ul>
        )}

        {result && (
          <div role="status" className="fm-migration-panel">
            <h3>Restore completed</h3>

            <p>{result.total} records restored.</p>

            <p className="fm-migration-small">
              Projects: {result.projects} · Tasks: {result.tasks} · Inbox:{" "}
              {result.inbox} · Focus: {result.focusHistory} · Day priorities:{" "}
              {result.dayPriorities}
            </p>

            <p className="fm-migration-small">
              Clear the preview, then reload the workspace to see the updated
              data.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="fm-migration-panel fm-migration-error">
            <strong>Restore stopped</strong>

            <p>{error}</p>

            <p className="fm-migration-small">
              Do not retry from this preview. Check the current cloud data, then
              clear and load the archive again.
            </p>
          </div>
        )}

        {attempted && (
          <p className="fm-migration-small">
            This restore preview is locked after the first execution attempt.
          </p>
        )}

        {!attempted && !confirming && (
          <button
            type="button"
            className="fm-migration-button"
            disabled={locked || selected.length === 0}
            onClick={() => {
              setConfirming(true);
              setError("");
            }}
          >
            Review final restore
          </button>
        )}

        {!attempted && confirming && (
          <div className="fm-migration-panel">
            <p className="fm-migration-eyebrow">FINAL CONFIRMATION</p>

            <h3>Confirm cloud restore</h3>

            <p>
              You are about to insert <strong>{selected.length} records</strong>{" "}
              into your FlowMind account.
            </p>

            <p className="fm-migration-small">
              Existing records will not be intentionally overwritten or deleted.
              This operation cannot be rolled back automatically.
            </p>

            <p className="fm-migration-small">
              If a later database request fails, some earlier records may
              already have been restored.
            </p>

            <label className="fm-migration-check">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={busy}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />

              <span>
                I understand the selected records will be inserted into Supabase
                and that a partial restore is possible.
              </span>
            </label>

            <label className="fm-migration-field">
              <span>Type RESTORE to confirm</span>

              <input
                type="text"
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <div className="fm-migration-actions">
              <button
                type="button"
                className="fm-migration-button"
                disabled={busy || !acknowledged || confirmation !== "RESTORE"}
                onClick={() => {
                  void runRestore();
                }}
              >
                {busy ? "Restoring..." : "Confirm safe restore"}
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

        <p className="fm-migration-small">
          Every restore requires a fresh cloud comparison and account
          verification. No automatic overwrite or deletion is performed.
        </p>
      </section>
    </section>
  );
}
