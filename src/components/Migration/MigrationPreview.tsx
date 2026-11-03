import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Project } from "../../types";

import { previewLocalMigration } from "../../services/localMigrationPreview";

import type { LocalMigrationPreview } from "../../services/localMigrationPreview";

import { buildMigrationPlan } from "../../services/migrationPlan";

import type {
  MigrationCloudData,
  MigrationPlanItem,
  MigrationKind,
} from "../../services/migrationPlan";

import { executeWorkspaceMigration } from "../../services/migrationExecution";

import type { ImportResult } from "../../services/migrationExecution";

import { loadWorkspace } from "../../services/workspace";
import { loadCloudInbox } from "../../services/cloudInbox";
import { loadCloudFocusHistory } from "../../services/cloudFocusHistory";

import InboxImportPanel from "./InboxImportPanel";
import FocusImportPanel from "./FocusImportPanel";
import BackupExportPanel from "../Backup/BackupExportPanel";

import "./MigrationPreview.css";

interface Props {
  userId: string;
  onClose: () => void;
}

type ProjectDecisions = Record<string, string>;

const GROUPS: {
  kind: MigrationKind;
  title: string;
}[] = [
  { kind: "project", title: "Projects" },
  { kind: "task", title: "Tasks" },
];

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "An unexpected error occurred.";
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function getItems(
  plan: ReturnType<typeof buildMigrationPlan>,
  kind: MigrationKind,
): MigrationPlanItem[] {
  if (kind === "project") return plan.projects;
  if (kind === "task") return plan.tasks;
  if (kind === "inbox") return plan.inbox;
  return plan.focusHistory;
}

export default function MigrationPreview({ userId, onClose }: Props) {
  const [local, setLocal] = useState<LocalMigrationPreview>(() =>
    previewLocalMigration(),
  );

  const [cloud, setCloud] = useState<MigrationCloudData | null>(null);

  const [decisions, setDecisions] = useState<ProjectDecisions>({});

  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const [success, setSuccess] = useState<ImportResult | null>(null);

  const [showAll, setShowAll] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const [confirmationText, setConfirmationText] = useState("");

  const requestId = useRef(0);
  const importBusy = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (importBusy.current) return;

    const request = ++requestId.current;

    setLoading(true);
    setError("");
    setCloud(null);
    setSelected([]);
    setDecisions({});
    setConfirming(false);
    setConfirmationText("");

    try {
      const freshLocal = previewLocalMigration();

      if (freshLocal.hasReadErrors) {
        throw new Error("Some local data could not be read.");
      }

      const [workspace, inbox, focusHistory] = await Promise.all([
        loadWorkspace(userId),
        loadCloudInbox(userId),
        loadCloudFocusHistory(userId),
      ]);

      if (requestId.current !== request) {
        return;
      }

      setLocal(freshLocal);

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

      setError(errorText(cause));
      throw cause;
    } finally {
      if (requestId.current === request) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void refresh().catch(() => {});

    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const plan = useMemo(() => {
    if (!cloud) return null;

    return buildMigrationPlan(local, cloud);
  }, [local, cloud]);

  const allItems = useMemo<MigrationPlanItem[]>(
    () => (plan ? [...plan.projects, ...plan.tasks] : []),
    [plan],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function projectChoice(id: string): string {
    if (!cloud) return "";

    const existing = cloud.projects.find(
      (project: Project) => project.id === id,
    );

    return existing?.id ?? decisions[id] ?? "";
  }

  function canSelect(item: MigrationPlanItem): boolean {
    if (!cloud || !plan || importing) {
      return false;
    }

    if (item.kind === "project") {
      return (
        item.status === "ready" && projectChoice(item.sourceId) === "create"
      );
    }

    if (item.kind === "task") {
      const mappingOnlyReview =
        item.status === "review" &&
        item.reason === "The task's project mapping requires confirmation.";

      if (item.status !== "ready" && !mappingOnlyReview) {
        return false;
      }

      if (!item.originalProjectId) {
        return true;
      }

      const choice = projectChoice(item.originalProjectId);

      if (choice === "create") {
        return plan.projects.some(
          (project) =>
            project.sourceId === item.originalProjectId &&
            project.status === "ready",
        );
      }

      return cloud.projects.some((project: Project) => project.id === choice);
    }

    return false;
  }

  function resetConfirmation(): void {
    setConfirming(false);
    setConfirmationText("");
    setSuccess(null);
  }

  function changeProject(id: string, choice: string): void {
    if (importing) return;

    setDecisions((previous) => ({
      ...previous,
      [id]: choice,
    }));

    setSelected((previous) =>
      previous.filter((key) => {
        if (key === `project:${id}`) {
          return false;
        }

        return !plan?.tasks.some(
          (task) => task.key === key && task.originalProjectId === id,
        );
      }),
    );

    resetConfirmation();
  }

  function toggleItem(item: MigrationPlanItem): void {
    if (!plan || !canSelect(item)) return;

    setSelected((previous) => {
      const next = new Set(previous);

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

        if (
          item.kind === "task" &&
          item.originalProjectId &&
          projectChoice(item.originalProjectId) === "create"
        ) {
          next.add(`project:${item.originalProjectId}`);
        }
      }

      return [...next];
    });

    resetConfirmation();
  }

  function selectAllAvailable(): void {
    if (importing || !plan) return;

    const next = new Set<string>();

    for (const item of allItems) {
      if (!canSelect(item)) continue;

      next.add(item.key);

      if (
        item.kind === "task" &&
        item.originalProjectId &&
        projectChoice(item.originalProjectId) === "create"
      ) {
        next.add(`project:${item.originalProjectId}`);
      }
    }

    setSelected([...next]);
    resetConfirmation();
  }

  const selectedItems = allItems.filter((item) => selectedSet.has(item.key));

  const selectedProjects = selectedItems.filter(
    (item) => item.kind === "project",
  ).length;

  const selectedTasks = selectedItems.filter(
    (item) => item.kind === "task",
  ).length;

  const selectableCount = allItems.filter((item) => canSelect(item)).length;

  async function runImport(): Promise<void> {
    if (
      importBusy.current ||
      !cloud ||
      !plan ||
      selected.length === 0 ||
      confirmationText !== "IMPORT"
    ) {
      return;
    }

    if (
      selectedItems.length !== selected.length ||
      selectedItems.some((item) => !canSelect(item))
    ) {
      setError("Selection changed. Refresh and review again.");
      return;
    }

    importBusy.current = true;
    setImporting(true);
    setError("");
    setSuccess(null);

    try {
      const result = await executeWorkspaceMigration({
        userId,
        local,
        cloudAtReview: cloud,
        selectedKeys: selected,
        projectDecisions: decisions,
      });

      setSuccess(result);
      setSelected([]);
      setConfirming(false);
      setConfirmationText("");
      setDecisions({});

      const [workspace, inbox, focusHistory] = await Promise.all([
        loadWorkspace(userId),
        loadCloudInbox(userId),
        loadCloudFocusHistory(userId),
      ]);

      setCloud({
        projects: workspace.projects,
        tasks: workspace.tasks,
        inbox,
        focusHistory,
      });
    } catch (cause) {
      setError(errorText(cause));
      setCloud(null);
      setSelected([]);
      setConfirming(false);
      setConfirmationText("");
    } finally {
      importBusy.current = false;
      setImporting(false);
    }
  }

  return (
    <section className="fm-migration" aria-label="Data migration and backup">
      <header className="fm-migration-header">
        <div>
          <p className="fm-migration-eyebrow">DATA SAFETY</p>

          <h2>Data Migration & Backup</h2>

          <p className="fm-migration-muted">
            Back up your cloud workspace or import selected legacy records.
          </p>
        </div>

        <button
          type="button"
          className="fm-migration-button"
          disabled={importing}
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <BackupExportPanel userId={userId} />

      <div className="fm-migration-panel">
        <strong>Migration destination account</strong>

        <p className="fm-migration-id">{userId}</p>

        <p className="fm-migration-small">
          Original local records remain unchanged.
        </p>
      </div>

      {success && (
        <div className="fm-migration-panel" role="status">
          <h3>Workspace import completed</h3>

          <p>
            {success.projectsCreated} projects and {success.tasksCreated} tasks
            created.
          </p>

          <p className="fm-migration-small">
            Reload the workspace to update the Dashboard.
          </p>
        </div>
      )}

      {loading && <p role="status">Loading migration comparison...</p>}

      {importing && <p role="status">Importing workspace records...</p>}

      {error && (
        <div className="fm-migration-panel fm-migration-error" role="alert">
          <strong>Migration issue</strong>
          <p>{error}</p>

          {!importing && (
            <button
              type="button"
              className="fm-migration-button"
              onClick={() => {
                setSuccess(null);

                void refresh().catch(() => {});
              }}
            >
              Refresh comparison
            </button>
          )}
        </div>
      )}

      {cloud && plan && !loading && (
        <>
          <div className="fm-migration-stats">
            {[
              ["Local records", plan.total],
              [
                "Cloud records",
                cloud.projects.length +
                  cloud.tasks.length +
                  cloud.inbox.length +
                  cloud.focusHistory.length,
              ],
              ["Ready", plan.ready],
              ["Needs review", plan.needsReview],
              ["Blocked", plan.blocked],
              ["Selected workspace", selected.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="fm-migration-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <section className="fm-migration-panel">
            <p className="fm-migration-eyebrow">WORKSPACE · PROJECT MAPPING</p>

            <h3>Project Mapping</h3>

            <div className="fm-migration-projects">
              {plan.projects.map((item) => {
                const source = local.projects.items.find(
                  (project) => project.id === item.sourceId,
                );

                const existingId = cloud.projects.find(
                  (project: Project) => project.id === item.sourceId,
                );

                const choice = projectChoice(item.sourceId);

                const localNames = [
                  source?.name ?? "",
                  ...(source?.aliases ?? []),
                ].map(normalize);

                const nameConflict = cloud.projects.some((project: Project) =>
                  [project.name, ...(project.aliases ?? [])]
                    .map(normalize)
                    .some((name) => localNames.includes(name)),
                );

                const allowCreate = item.status === "ready" && !nameConflict;

                return (
                  <div key={item.key} className="fm-migration-project">
                    <strong>{item.title}</strong>

                    <label className="fm-migration-field">
                      <span>Project action</span>

                      <select
                        value={choice}
                        disabled={importing || !!existingId}
                        onChange={(event) =>
                          changeProject(item.sourceId, event.target.value)
                        }
                      >
                        <option value="">Choose an action...</option>

                        {allowCreate && (
                          <option value="create">Create as new project</option>
                        )}

                        {cloud.projects.map((project: Project) => (
                          <option key={project.id} value={project.id}>
                            Link to: {project.name}
                          </option>
                        ))}

                        {!existingId && (
                          <option value="skip">Skip this project</option>
                        )}
                      </select>
                    </label>

                    <p className="fm-migration-small">
                      {choice === "create"
                        ? "New project proposed"
                        : choice === "skip"
                          ? "Project excluded"
                          : choice
                            ? "Mapped to cloud project"
                            : "Mapping not selected"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="fm-migration-panel">
            <p className="fm-migration-eyebrow">WORKSPACE · TASK SELECTION</p>

            <h3>Import projects and tasks</h3>

            <div className="fm-migration-actions">
              <button
                type="button"
                className="fm-migration-button"
                disabled={importing || selectableCount === 0}
                onClick={selectAllAvailable}
              >
                Select all available ({selectableCount})
              </button>

              <button
                type="button"
                className="fm-migration-button"
                disabled={importing || selected.length === 0}
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
                disabled={importing}
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? "Show first 5" : "Show all"}
              </button>
            </div>

            {GROUPS.map((group) => {
              const items = getItems(plan, group.kind);

              return (
                <div key={group.kind} className="fm-migration-group">
                  <h4>{group.title}</h4>

                  {(showAll ? items : items.slice(0, 5)).map((item) => (
                    <label
                      key={item.key}
                      className={
                        "fm-migration-record" +
                        (!canSelect(item)
                          ? " fm-migration-record-disabled"
                          : "")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.key)}
                        disabled={importing || !canSelect(item)}
                        onChange={() => toggleItem(item)}
                      />

                      <div>
                        <strong>{item.title}</strong>

                        <span className="fm-migration-tag">{item.status}</span>

                        <p className="fm-migration-small">{item.reason}</p>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}

            <div className="fm-migration-stats">
              <div className="fm-migration-stat">
                <span>Projects selected</span>
                <strong>{selectedProjects}</strong>
              </div>

              <div className="fm-migration-stat">
                <span>Tasks selected</span>
                <strong>{selectedTasks}</strong>
              </div>
            </div>

            {selectedItems.length > 0 && (
              <ul className="fm-migration-selected">
                {selectedItems.map((item) => (
                  <li key={item.key}>
                    {item.title}
                    <span>{item.kind}</span>
                  </li>
                ))}
              </ul>
            )}

            {!confirming ? (
              <button
                type="button"
                className="fm-migration-button"
                disabled={importing || selected.length === 0}
                onClick={() => setConfirming(true)}
              >
                Review workspace import
              </button>
            ) : (
              <div className="fm-migration-panel">
                <h3>Confirm workspace import</h3>

                <p className="fm-migration-small">
                  Create {selectedProjects} projects and {selectedTasks} tasks.
                  Type IMPORT to proceed.
                </p>

                <input
                  type="text"
                  value={confirmationText}
                  disabled={importing}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder="IMPORT"
                  aria-label="Confirm workspace import"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: "100%",
                    maxWidth: 250,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--fm-border)",
                    background: "var(--fm-surface)",
                    color: "var(--fm-text)",
                  }}
                />

                <div className="fm-migration-actions">
                  <button
                    type="button"
                    className="fm-migration-button"
                    disabled={importing || confirmationText !== "IMPORT"}
                    onClick={() => {
                      void runImport();
                    }}
                  >
                    {importing ? "Importing..." : "Confirm workspace import"}
                  </button>

                  <button
                    type="button"
                    className="fm-migration-button"
                    disabled={importing}
                    onClick={() => {
                      setConfirming(false);
                      setConfirmationText("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <InboxImportPanel
            userId={userId}
            localItems={local.inbox.items}
            cloudItems={cloud.inbox}
            onImported={refresh}
          />

          <FocusImportPanel
            userId={userId}
            localEntries={local.focusHistory.items}
            cloudEntries={cloud.focusHistory}
            localTasks={local.tasks.items}
            cloudTasks={cloud.tasks}
            cloudProjects={cloud.projects}
            onImported={refresh}
          />

          <div className="fm-migration-actions">
            <button
              type="button"
              className="fm-migration-button"
              disabled={importing}
              onClick={() => {
                setSuccess(null);

                void refresh().catch(() => {});
              }}
            >
              Refresh comparison
            </button>
          </div>
        </>
      )}
    </section>
  );
}
