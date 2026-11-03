import { useMemo, useState } from "react";

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

export default function RestoreSelectionPanel({ archive, cloud }: Props) {
  const plan = useMemo(
    () => buildRestorePlan(archive, cloud),
    [archive, cloud],
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(true);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(item: RestorePlanItem): void {
    if (item.status !== "available") return;

    if (selectedSet.has(item.key)) {
      setSelected((previous) =>
        removeRestoreSelection(plan, previous, item.key),
      );
    } else {
      setSelected((previous) =>
        expandRestoreSelection(plan, [...previous, item.key]),
      );
    }
  }

  function selectAll(): void {
    setSelected(
      expandRestoreSelection(
        plan,
        plan.items
          .filter((item) => item.status === "available")
          .map((item) => item.key),
      ),
    );
  }

  return (
    <section className="fm-migration-panel">
      <p className="fm-migration-eyebrow">RESTORE · STEP 2</p>

      <h3>Safe Restore Selection</h3>

      <p className="fm-migration-muted">
        Choose records to consider for restoring. Existing records and conflicts
        cannot be selected automatically.
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
          disabled={plan.available === 0}
          onClick={selectAll}
        >
          Select all available
        </button>

        <button
          type="button"
          className="fm-migration-button"
          disabled={selected.length === 0}
          onClick={() => setSelected([])}
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
                  disabled={item.status !== "available"}
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
          {selected.length} records selected for further review.
        </p>

        {selected.length > 0 && (
          <ul className="fm-migration-selected">
            {plan.items
              .filter((item) => selectedSet.has(item.key))
              .map((item) => (
                <li key={item.key}>
                  {item.title}
                  <span>{item.category}</span>
                </li>
              ))}
          </ul>
        )}

        <strong>Restore is not enabled yet.</strong>

        <p className="fm-migration-small">
          Your choices are temporary and do not change Supabase. Final restore
          will require a new cloud comparison, relationship checks and explicit
          confirmation before writing.
        </p>
      </section>
    </section>
  );
}
