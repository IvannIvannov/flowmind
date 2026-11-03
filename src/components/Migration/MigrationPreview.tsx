import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties } from "react";

import { previewLocalMigration } from "../../services/localMigrationPreview";

import type { LocalMigrationPreview } from "../../services/localMigrationPreview";

import { buildMigrationPlan } from "../../services/migrationPlan";

import type {
  MigrationCloudData,
  MigrationKind,
  MigrationPlanItem,
  MigrationStatus,
} from "../../services/migrationPlan";

import { loadWorkspace } from "../../services/workspace";
import { loadCloudInbox } from "../../services/cloudInbox";
import { loadCloudFocusHistory } from "../../services/cloudFocusHistory";

interface MigrationPreviewProps {
  userId: string;
  onClose: () => void;
}

interface GroupDefinition {
  key: MigrationKind;
  title: string;
  description: string;
}

interface CategorySummary {
  total: number;
  invalid: number;
  duplicateIds: number;
  readError: string | null;
}

const GROUPS: GroupDefinition[] = [
  {
    key: "project",
    title: "Projects",
    description:
      "Project relationships must be resolved before importing linked tasks.",
  },
  {
    key: "task",
    title: "Tasks",
    description:
      "Existing tasks and possible duplicates must not be overwritten.",
  },
  {
    key: "inbox",
    title: "Inbox",
    description: "Review repeated notes before importing them.",
  },
  {
    key: "focus",
    title: "Focus History",
    description: "Sessions may depend on existing tasks and projects.",
  },
];

const STATUS_LABEL: Record<MigrationStatus, string> = {
  ready: "Ready for selection",
  review: "Needs review",
  existing: "Already in cloud",
  conflict: "ID conflict",
  blocked: "Blocked",
};

const STATUS_SYMBOL: Record<MigrationStatus, string> = {
  ready: "✓",
  review: "?",
  existing: "✓",
  conflict: "!",
  blocked: "×",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--fm-border)",
  borderRadius: 12,
  padding: 16,
  background: "var(--fm-surface)",
};

const buttonStyle: CSSProperties = {
  border: "1px solid var(--fm-border)",
  borderRadius: 9,
  padding: "10px 14px",
  color: "var(--fm-text)",
  background: "var(--fm-surface)",
  cursor: "pointer",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not load migration data.";
}

function countByStatus(
  items: MigrationPlanItem[],
  status: MigrationStatus,
): number {
  return items.filter((item: MigrationPlanItem) => item.status === status)
    .length;
}

function localCount(local: LocalMigrationPreview): number {
  return (
    local.projects.total +
    local.tasks.total +
    local.inbox.total +
    local.focusHistory.total
  );
}

function cloudCount(cloud: MigrationCloudData): number {
  return (
    cloud.projects.length +
    cloud.tasks.length +
    cloud.inbox.length +
    cloud.focusHistory.length
  );
}

function invalidCount(local: LocalMigrationPreview): number {
  return (
    local.projects.invalid +
    local.tasks.invalid +
    local.inbox.invalid +
    local.focusHistory.invalid
  );
}

function duplicateCount(local: LocalMigrationPreview): number {
  return (
    local.projects.duplicateIds +
    local.tasks.duplicateIds +
    local.inbox.duplicateIds +
    local.focusHistory.duplicateIds
  );
}

function getLocalCategory(
  local: LocalMigrationPreview,
  kind: MigrationKind,
): CategorySummary {
  if (kind === "project") {
    return local.projects;
  }

  if (kind === "task") {
    return local.tasks;
  }

  if (kind === "inbox") {
    return local.inbox;
  }

  return local.focusHistory;
}

function getCloudCount(cloud: MigrationCloudData, kind: MigrationKind): number {
  if (kind === "project") {
    return cloud.projects.length;
  }

  if (kind === "task") {
    return cloud.tasks.length;
  }

  if (kind === "inbox") {
    return cloud.inbox.length;
  }

  return cloud.focusHistory.length;
}

function getPlanItems(
  plan: ReturnType<typeof buildMigrationPlan>,
  kind: MigrationKind,
): MigrationPlanItem[] {
  if (kind === "project") {
    return plan.projects;
  }

  if (kind === "task") {
    return plan.tasks;
  }

  if (kind === "inbox") {
    return plan.inbox;
  }

  return plan.focusHistory;
}

export default function MigrationPreview({
  userId,
  onClose,
}: MigrationPreviewProps) {
  const [local, setLocal] = useState<LocalMigrationPreview>(() =>
    previewLocalMigration(),
  );

  const [cloud, setCloud] = useState<MigrationCloudData | null>(null);

  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(true);

  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestId.current;

    setLoading(true);
    setError("");
    setCloud(null);
    setSelected([]);

    try {
      const localData = previewLocalMigration();

      if (localData.hasReadErrors) {
        throw new Error(
          "Some local data could not be read. Review the source data before proceeding.",
        );
      }

      const [workspace, inbox, focusHistory] = await Promise.all([
        loadWorkspace(userId),
        loadCloudInbox(userId),
        loadCloudFocusHistory(userId),
      ]);

      if (requestId.current !== request) {
        return;
      }

      setLocal(localData);

      setCloud({
        projects: workspace.projects,
        tasks: workspace.tasks,
        inbox,
        focusHistory,
      });
    } catch (cause) {
      if (requestId.current !== request) {
        return;
      }

      setError(errorMessage(cause));
    } finally {
      if (requestId.current === request) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void refresh();

    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const plan = useMemo(() => {
    if (cloud === null) {
      return null;
    }

    return buildMigrationPlan(local, cloud);
  }, [local, cloud]);

  const allItems = useMemo<MigrationPlanItem[]>(() => {
    if (plan === null) {
      return [];
    }

    return [
      ...plan.projects,
      ...plan.tasks,
      ...plan.inbox,
      ...plan.focusHistory,
    ];
  }, [plan]);

  const readyItems = useMemo<MigrationPlanItem[]>(
    () => allItems.filter((item: MigrationPlanItem) => item.status === "ready"),
    [allItems],
  );

  const selectedSet = useMemo(() => new Set<string>(selected), [selected]);

  const selectedItems = allItems.filter((item: MigrationPlanItem) =>
    selectedSet.has(item.key),
  );

  function toggleItem(item: MigrationPlanItem): void {
    if (plan === null || item.status !== "ready") {
      return;
    }

    setSelected((previous: string[]) => {
      const next = new Set<string>(previous);

      if (next.has(item.key)) {
        next.delete(item.key);

        if (item.kind === "project") {
          for (const task of plan.tasks) {
            if (task.originalProjectId === item.sourceId) {
              next.delete(task.key);
            }
          }
        }
      } else {
        next.add(item.key);

        if (item.kind === "task" && item.originalProjectId) {
          const parent = plan.projects.find(
            (project: MigrationPlanItem) =>
              project.sourceId === item.originalProjectId,
          );

          if (parent && parent.status === "ready") {
            next.add(parent.key);
          }
        }
      }

      return [...next];
    });
  }

  function selectAllReady(): void {
    setSelected(readyItems.map((item: MigrationPlanItem) => item.key));
  }

  function clearSelection(): void {
    setSelected([]);
  }

  const selectedProjects = selectedItems.filter(
    (item: MigrationPlanItem) => item.kind === "project",
  ).length;

  const selectedTasks = selectedItems.filter(
    (item: MigrationPlanItem) => item.kind === "task",
  ).length;

  const selectedInbox = selectedItems.filter(
    (item: MigrationPlanItem) => item.kind === "inbox",
  ).length;

  const selectedHistory = selectedItems.filter(
    (item: MigrationPlanItem) => item.kind === "focus",
  ).length;

  return (
    <section
      aria-label="Smart import selection"
      style={{
        border: "1px solid var(--fm-border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        background: "var(--fm-surface)",
        color: "var(--fm-text)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            DATA SAFETY · STEP 3
          </p>

          <h2>Smart Import Selection</h2>

          <p style={{ opacity: 0.7 }}>
            Choose which local records should be considered for migration.
          </p>
        </div>

        <button type="button" onClick={onClose} style={buttonStyle}>
          Close
        </button>
      </header>

      <div
        style={{
          ...panelStyle,
          marginBottom: 20,
        }}
      >
        <strong>Destination account</strong>

        <p
          style={{
            fontSize: 12,
            overflowWrap: "anywhere",
            opacity: 0.7,
          }}
        >
          {userId}
        </p>

        <p
          style={{
            fontSize: 12,
            marginBottom: 0,
          }}
        >
          This screen only prepares a selection. No records will be uploaded,
          updated or deleted.
        </p>
      </div>

      {loading && <p role="status">Preparing your migration plan...</p>}

      {error && (
        <div
          role="alert"
          style={{
            ...panelStyle,
            borderLeft: "3px solid #dc2626",
            marginBottom: 20,
          }}
        >
          <strong>Migration plan unavailable</strong>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            style={buttonStyle}
          >
            Retry comparison
          </button>
        </div>
      )}

      {plan !== null && cloud !== null && !loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              ["Local records", localCount(local)],
              ["Cloud records", cloudCount(cloud)],
              ["Ready", plan.ready],
              ["Needs review", plan.needsReview],
              ["Blocked", plan.blocked],
              ["Selected", selectedItems.length],
            ].map(([label, value]) => (
              <div key={String(label)} style={panelStyle}>
                <span
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    display: "block",
                  }}
                >
                  {label}
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 25,
                    marginTop: 8,
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>

          <div
            style={{
              ...panelStyle,
              marginBottom: 20,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Migration safety</h3>

            <p>
              <strong>{plan.existing}</strong> already in cloud ·{" "}
              <strong>{plan.conflicts}</strong> ID conflicts
            </p>

            <p>
              <strong>{invalidCount(local)}</strong> invalid local records ·{" "}
              <strong>{duplicateCount(local)}</strong> duplicate local IDs
            </p>

            <p
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginBottom: 0,
              }}
            >
              Ready means no issue was detected by these checks. It does not
              guarantee that two records describe different real-world work.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              style={buttonStyle}
              onClick={selectAllReady}
              disabled={readyItems.length === 0}
            >
              Select all ready ({readyItems.length})
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={clearSelection}
              disabled={selected.length === 0}
            >
              Clear selection
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => setShowAll((current: boolean) => !current)}
            >
              {showAll ? "Show first 5" : "Show all records"}
            </button>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => {
                void refresh();
              }}
            >
              Refresh comparison
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {GROUPS.map((group: GroupDefinition) => {
              const items = getPlanItems(plan, group.key);

              const localCategory = getLocalCategory(local, group.key);

              const visibleItems = showAll ? items : items.slice(0, 5);

              return (
                <section key={group.key} style={panelStyle}>
                  <header
                    style={{
                      marginBottom: 14,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 6px",
                      }}
                    >
                      {group.title}
                    </h3>

                    <p
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                      }}
                    >
                      {group.description}
                    </p>

                    <p
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 0,
                      }}
                    >
                      {localCategory.total} local ·{" "}
                      {getCloudCount(cloud, group.key)} cloud ·{" "}
                      {countByStatus(items, "ready")} ready ·{" "}
                      {countByStatus(items, "review")} review
                    </p>
                  </header>

                  {localCategory.readError && (
                    <p role="alert">{localCategory.readError}</p>
                  )}

                  {items.length === 0 ? (
                    <p style={{ opacity: 0.6 }}>No valid local records.</p>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      {visibleItems.map((item: MigrationPlanItem) => {
                        const canSelect = item.status === "ready";

                        const checked = selectedSet.has(item.key);

                        return (
                          <label
                            key={item.key}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                              padding: 12,
                              borderRadius: 10,
                              border: "1px solid var(--fm-border)",
                              cursor: canSelect ? "pointer" : "default",
                              opacity: canSelect ? 1 : 0.75,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canSelect}
                              onChange={() => toggleItem(item)}
                              style={{
                                marginTop: 4,
                              }}
                            />

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {item.title || "(Untitled)"}
                              </strong>

                              <span
                                style={{
                                  display: "block",
                                  fontSize: 12,
                                  marginTop: 5,
                                }}
                              >
                                {STATUS_SYMBOL[item.status]}{" "}
                                {STATUS_LABEL[item.status]}
                              </span>

                              <p
                                style={{
                                  fontSize: 12,
                                  opacity: 0.7,
                                  marginBottom: 0,
                                }}
                              >
                                {item.reason}
                              </p>

                              {item.originalProjectId && (
                                <p
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.65,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  Original project: {item.originalProjectId}
                                </p>
                              )}

                              {item.suggestedTargetId && (
                                <p
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.65,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  Suggested cloud ID: {item.suggestedTargetId}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div
            style={{
              ...panelStyle,
              marginTop: 20,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Your current selection</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              {[
                ["Projects", selectedProjects],
                ["Tasks", selectedTasks],
                ["Inbox", selectedInbox],
                ["Focus History", selectedHistory],
              ].map(([label, count]) => (
                <div key={String(label)}>
                  <span
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                      display: "block",
                    }}
                  >
                    {label}
                  </span>

                  <strong
                    style={{
                      fontSize: 24,
                    }}
                  >
                    {count}
                  </strong>
                </div>
              ))}
            </div>

            <p
              style={{
                marginTop: 18,
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              Selected records: {selectedItems.length}. Your selection exists
              only in this preview and will not be saved or imported.
            </p>
          </div>

          <footer
            style={{
              marginTop: 22,
              borderTop: "1px solid var(--fm-border)",
              paddingTop: 18,
            }}
          >
            <strong>Import is not enabled yet.</strong>

            <p
              style={{
                fontSize: 12,
                opacity: 0.75,
              }}
            >
              Records requiring review or ID mapping cannot be selected. Project
              links and cloud data must be revalidated before enabling actual
              import.
            </p>
          </footer>
        </>
      )}
    </section>
  );
}
