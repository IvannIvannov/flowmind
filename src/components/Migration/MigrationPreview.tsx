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
  { kind: "inbox", title: "Inbox" },
  { kind: "focus", title: "Focus History" },
];

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
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

function getLocalCount(
  local: LocalMigrationPreview,
  kind: MigrationKind,
): number {
  if (kind === "project") return local.projects.total;
  if (kind === "task") return local.tasks.total;
  if (kind === "inbox") return local.inbox.total;
  return local.focusHistory.total;
}

function getCloudCount(cloud: MigrationCloudData, kind: MigrationKind): number {
  if (kind === "project") return cloud.projects.length;
  if (kind === "task") return cloud.tasks.length;
  if (kind === "inbox") return cloud.inbox.length;
  return cloud.focusHistory.length;
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

  const refresh = useCallback(async () => {
    if (importBusy.current) return;

    const currentRequest = ++requestId.current;

    setLoading(true);
    setCloud(null);
    setError("");
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

      if (requestId.current !== currentRequest) {
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
      if (requestId.current !== currentRequest) {
        return;
      }

      setError(message(cause));
    } finally {
      if (requestId.current === currentRequest) {
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
    if (cloud === null) return null;

    return buildMigrationPlan(local, cloud);
  }, [local, cloud]);

  const allItems = useMemo<MigrationPlanItem[]>(
    () =>
      plan
        ? [...plan.projects, ...plan.tasks, ...plan.inbox, ...plan.focusHistory]
        : [],
    [plan],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function projectChoice(id: string): string {
    if (!cloud) return "";

    const existing = cloud.projects.find(
      (project: Project) => project.id === id,
    );

    if (existing) return existing.id;

    return decisions[id] ?? "";
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
        const parent = plan.projects.find(
          (project) => project.sourceId === item.originalProjectId,
        );

        return parent?.status === "ready";
      }

      return cloud.projects.some((project: Project) => project.id === choice);
    }

    // Inbox and Focus History are not writable
    // in this migration version.
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

        const dependentTask = plan?.tasks.find(
          (task) => task.key === key && task.originalProjectId === id,
        );

        return !dependentTask;
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

  function clearSelection(): void {
    if (importing) return;

    setSelected([]);
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

    // Never import records that became disabled
    // after changes to mapping or selection.
    const invalidSelection = selectedItems.some((item) => !canSelect(item));

    if (invalidSelection || selectedItems.length !== selected.length) {
      setError(
        "The selection is no longer valid. Refresh and select the records again.",
      );
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

      // Fetch fresh cloud data and clear the
      // old selection after successful import.
      setSelected([]);
      setConfirming(false);
      setConfirmationText("");
      setDecisions({});
      setCloud(null);
      setLoading(true);

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
      setError(message(cause));

      // A failed request may have partially
      // succeeded, so force a fresh comparison.
      setCloud(null);
      setSelected([]);
      setConfirming(false);
      setConfirmationText("");
    } finally {
      importBusy.current = false;
      setImporting(false);
      setLoading(false);
    }
  }

  return (
    <section
      className="fm-migration"
      aria-label="Migration planning and execution"
    >
      <header className="fm-migration-header">
        <div>
          <p className="fm-migration-eyebrow">DATA SAFETY · STEP 5</p>

          <h2>Smart Import</h2>

          <p className="fm-migration-muted">
            Map local projects, select records and confirm before importing.
          </p>
        </div>

        <button
          type="button"
          className="fm-migration-button"
          onClick={onClose}
          disabled={importing}
        >
          Close
        </button>
      </header>

      <div className="fm-migration-panel">
        <strong>Destination account</strong>

        <p className="fm-migration-id">{userId}</p>

        <p className="fm-migration-small">
          Only selected projects and tasks can be imported at this stage. Local
          records will not be deleted.
        </p>
      </div>

      {success && (
        <div className="fm-migration-panel" role="status">
          <h3>Import completed</h3>

          <p>
            Projects created: <strong>{success.projectsCreated}</strong>
          </p>

          <p>
            Tasks created: <strong>{success.tasksCreated}</strong>
          </p>

          <p className="fm-migration-small">
            These records are now in Supabase. Close this screen to return to
            the workspace, then reload the workspace to see the updated data.
          </p>
        </div>
      )}

      {loading && (
        <p role="status">
          {importing ? "Importing records..." : "Loading comparison..."}
        </p>
      )}

      {error && (
        <div className="fm-migration-panel fm-migration-error" role="alert">
          <strong>Import or comparison error</strong>

          <p>{error}</p>

          {!importing && (
            <button
              type="button"
              className="fm-migration-button"
              onClick={() => {
                setSuccess(null);
                void refresh();
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
              ["Selected", selected.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="fm-migration-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <section className="fm-migration-panel">
            <p className="fm-migration-eyebrow">STEP 5.1</p>

            <h3>Project Mapping</h3>

            <p className="fm-migration-muted">
              Choose whether to create a new project, link to an existing cloud
              project or skip it.
            </p>

            <div className="fm-migration-projects">
              {plan.projects.map((item) => {
                const source = local.projects.items.find(
                  (project) => project.id === item.sourceId,
                );

                const fixedCloudProject = cloud.projects.find(
                  (project: Project) => project.id === item.sourceId,
                );

                const choice = projectChoice(item.sourceId);

                const hasNameConflict = cloud.projects.some(
                  (project: Project) => {
                    const localNames = [
                      source?.name ?? "",
                      ...(source?.aliases ?? []),
                    ].map(normalize);

                    const cloudNames = [
                      project.name,
                      ...(project.aliases ?? []),
                    ].map(normalize);

                    return localNames.some((name) => cloudNames.includes(name));
                  },
                );

                const allowCreate = item.status === "ready" && !hasNameConflict;

                const linkedTasks = local.tasks.items.filter(
                  (task) => task.projectId === item.sourceId,
                ).length;

                return (
                  <div key={item.key} className="fm-migration-project">
                    <div className="fm-migration-project-top">
                      <div>
                        <strong>{item.title}</strong>

                        <p className="fm-migration-small">
                          {linkedTasks} linked local tasks
                        </p>
                      </div>

                      <span className="fm-migration-tag">{item.status}</span>
                    </div>

                    <label className="fm-migration-field">
                      <span>Project action</span>

                      <select
                        value={choice}
                        disabled={importing || !!fixedCloudProject}
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

                        {!fixedCloudProject && (
                          <option value="skip">Skip this project</option>
                        )}
                      </select>
                    </label>

                    <p className="fm-migration-small">
                      {choice === "create"
                        ? "A new cloud project will be created if it is selected."
                        : choice === "skip"
                          ? "This project and its dependent tasks will not be imported."
                          : cloud.projects.some(
                                (project) => project.id === choice,
                              )
                            ? "Tasks can be linked to this existing cloud project."
                            : "Choose a mapping before selecting linked tasks."}
                    </p>

                    {choice === "create" && canSelect(item) && (
                      <label className="fm-migration-check">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(item.key)}
                          disabled={importing}
                          onChange={() => toggleItem(item)}
                        />
                        Include this project
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="fm-migration-panel">
            <p className="fm-migration-eyebrow">STEP 5.2</p>

            <h3>Select records</h3>

            <p className="fm-migration-muted">
              Only projects and tasks are available for import. Inbox and Focus
              History remain protected until their import logic is completed.
            </p>

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
                onClick={clearSelection}
              >
                Clear selection
              </button>

              <button
                type="button"
                className="fm-migration-button"
                disabled={importing}
                onClick={() => setShowAll((previous) => !previous)}
              >
                {showAll ? "Show first 5" : "Show all"}
              </button>
            </div>

            {GROUPS.map((group) => {
              const items = getItems(plan, group.kind);

              return (
                <div key={group.kind} className="fm-migration-group">
                  <h4>{group.title}</h4>

                  <p className="fm-migration-small">
                    {getLocalCount(local, group.kind)} local ·{" "}
                    {getCloudCount(cloud, group.kind)} cloud
                  </p>

                  {(showAll ? items : items.slice(0, 5)).map((item) => {
                    const allowed = canSelect(item);

                    return (
                      <label
                        key={item.key}
                        className={
                          "fm-migration-record" +
                          (!allowed ? " fm-migration-record-disabled" : "")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedSet.has(item.key)}
                          disabled={!allowed || importing}
                          onChange={() => toggleItem(item)}
                        />

                        <div>
                          <strong>{item.title || "(Untitled)"}</strong>

                          <span className="fm-migration-tag">
                            {item.status}
                          </span>

                          <p className="fm-migration-small">{item.reason}</p>

                          {item.originalProjectId && (
                            <p className="fm-migration-small">
                              Project:{" "}
                              {projectChoice(item.originalProjectId) ||
                                "Not mapped"}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </section>

          <section className="fm-migration-panel">
            <p className="fm-migration-eyebrow">STEP 5.3</p>

            <h3>Final Confirmation</h3>

            <div className="fm-migration-stats">
              <div className="fm-migration-stat">
                <span>Selected projects</span>
                <strong>{selectedProjects}</strong>
              </div>

              <div className="fm-migration-stat">
                <span>Selected tasks</span>
                <strong>{selectedTasks}</strong>
              </div>
            </div>

            <p className="fm-migration-muted">
              Original local records will stay on this device. Existing cloud
              projects and tasks will not be overwritten.
            </p>

            <p className="fm-migration-small">
              Imported projects and tasks will get new creation timestamps
              because the current cloud creation functions do not preserve their
              original createdAt values.
            </p>

            {selected.length > 0 && (
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
                Review and confirm import
              </button>
            ) : (
              <div className="fm-migration-panel">
                <strong>Confirm cloud import</strong>

                <p className="fm-migration-small">
                  You are about to import {selectedProjects} projects and{" "}
                  {selectedTasks} tasks into the signed-in account.
                </p>

                <p className="fm-migration-small">Type IMPORT to confirm.</p>

                <input
                  type="text"
                  value={confirmationText}
                  disabled={importing}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder="IMPORT"
                  aria-label="Import confirmation"
                  style={{
                    width: "100%",
                    maxWidth: 260,
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
                    {importing ? "Importing..." : "Confirm import"}
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

          <div className="fm-migration-actions">
            <button
              type="button"
              className="fm-migration-button"
              disabled={importing}
              onClick={() => {
                setSuccess(null);
                void refresh();
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
