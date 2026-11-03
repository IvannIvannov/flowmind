import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Project } from "../../types";

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

import "./MigrationPreview.css";

interface Props {
  userId: string;
  onClose: () => void;
}

type ProjectDecision = "create" | "skip" | string;
type ProjectDecisions = Record<string, ProjectDecision>;

interface GroupDefinition {
  kind: MigrationKind;
  title: string;
}

const GROUPS: GroupDefinition[] = [
  { kind: "project", title: "Projects" },
  { kind: "task", title: "Tasks" },
  { kind: "inbox", title: "Inbox" },
  { kind: "focus", title: "Focus History" },
];

const STATUS_LABELS: Record<MigrationStatus, string> = {
  ready: "Ready",
  review: "Needs review",
  existing: "Already in cloud",
  conflict: "ID conflict",
  blocked: "Blocked",
};

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not load migration data.";
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

function getProjectChoice(
  projectId: string,
  decisions: ProjectDecisions,
  cloud: MigrationCloudData,
): string {
  if (cloud.projects.some((project: Project) => project.id === projectId)) {
    return projectId;
  }

  return decisions[projectId] ?? "";
}

function isLinkedToCloud(choice: string, cloud: MigrationCloudData): boolean {
  return cloud.projects.some((project: Project) => project.id === choice);
}

export default function MigrationPreview({ userId, onClose }: Props) {
  const [local, setLocal] = useState<LocalMigrationPreview>(() =>
    previewLocalMigration(),
  );

  const [cloud, setCloud] = useState<MigrationCloudData | null>(null);

  const [decisions, setDecisions] = useState<ProjectDecisions>({});

  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(true);

  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;

    setLoading(true);
    setError("");
    setCloud(null);
    setDecisions({});
    setSelected([]);

    try {
      const localData = previewLocalMigration();

      if (localData.hasReadErrors) {
        throw new Error("Some local data could not be read.");
      }

      const [workspace, inbox, focusHistory] = await Promise.all([
        loadWorkspace(userId),
        loadCloudInbox(userId),
        loadCloudFocusHistory(userId),
      ]);

      if (requestId.current !== current) return;

      setLocal(localData);
      setCloud({
        projects: workspace.projects,
        tasks: workspace.tasks,
        inbox,
        focusHistory,
      });
    } catch (cause) {
      if (requestId.current !== current) return;
      setError(errorText(cause));
    } finally {
      if (requestId.current === current) {
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
    if (!cloud) return null;
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

  function projectChoice(projectId: string): string {
    if (!cloud) return "";

    return getProjectChoice(projectId, decisions, cloud);
  }

  function canSelect(item: MigrationPlanItem): boolean {
    if (!cloud || !plan) return false;

    if (item.kind === "project") {
      return (
        item.status === "ready" && projectChoice(item.sourceId) === "create"
      );
    }

    if (item.kind === "task") {
      const regularReady = item.status === "ready";

      // A task held only for confirmation of its
      // project mapping can be unlocked once that
      // mapping is explicit.
      const mappingOnlyReview =
        item.status === "review" &&
        item.reason === "The task's project mapping requires confirmation.";

      if (!regularReady && !mappingOnlyReview) {
        return false;
      }

      if (!item.originalProjectId) return true;

      const choice = projectChoice(item.originalProjectId);

      return choice === "create" || isLinkedToCloud(choice, cloud);
    }

    return item.status === "ready";
  }

  function changeProjectDecision(projectId: string, choice: string): void {
    setDecisions((previous) => ({
      ...previous,
      [projectId]: choice,
    }));

    // A changed project mapping invalidates any
    // previous choices involving that project.
    setSelected((previous) =>
      previous.filter((key) => {
        if (key === `project:${projectId}`) {
          return false;
        }

        const dependentTask = plan?.tasks.find(
          (task: MigrationPlanItem) =>
            task.key === key && task.originalProjectId === projectId,
        );

        return !dependentTask;
      }),
    );
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
  }

  function selectAllReady(): void {
    if (!plan || !cloud) return;

    const next = new Set<string>();

    for (const item of allItems) {
      if (canSelect(item)) {
        next.add(item.key);

        if (
          item.kind === "task" &&
          item.originalProjectId &&
          projectChoice(item.originalProjectId) === "create"
        ) {
          next.add(`project:${item.originalProjectId}`);
        }
      }
    }

    setSelected([...next]);
  }

  function decisionDescription(projectId: string): string {
    if (!cloud) return "";

    const choice = projectChoice(projectId);

    if (!choice) {
      return "Choose how this project should be handled.";
    }

    if (choice === "skip") {
      return "This project and its dependent tasks are excluded from selection.";
    }

    if (choice === "create") {
      return "A new cloud project is proposed. Its tasks will keep this project relationship.";
    }

    const target = cloud.projects.find(
      (project: Project) => project.id === choice,
    );

    return target
      ? `Tasks will use the existing cloud project "${target.name}".`
      : "The selected cloud project is unavailable.";
  }

  const totalLocal =
    local.projects.total +
    local.tasks.total +
    local.inbox.total +
    local.focusHistory.total;

  const totalCloud = cloud
    ? cloud.projects.length +
      cloud.tasks.length +
      cloud.inbox.length +
      cloud.focusHistory.length
    : 0;

  const selectedItems = allItems.filter((item: MigrationPlanItem) =>
    selectedSet.has(item.key),
  );

  const selectableItems = allItems.filter((item: MigrationPlanItem) =>
    canSelect(item),
  );

  const unresolvedProjects = plan
    ? plan.projects.filter(
        (item: MigrationPlanItem) => !projectChoice(item.sourceId),
      ).length
    : 0;

  return (
    <section
      className="fm-migration"
      aria-label="Smart import and project mapping"
    >
      <header className="fm-migration-header">
        <div>
          <p className="fm-migration-eyebrow">DATA SAFETY · STEP 4</p>

          <h2>Smart Import & Project Mapping</h2>

          <p className="fm-migration-muted">
            Choose how local projects relate to cloud projects, then select
            records.
          </p>
        </div>

        <button type="button" className="fm-migration-button" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="fm-migration-panel">
        <strong>Destination account</strong>
        <p className="fm-migration-id">{userId}</p>
        <p className="fm-migration-small">
          Read-only planning. No records will be inserted, updated or deleted.
        </p>
      </div>

      {loading && <p role="status">Loading local and cloud records...</p>}

      {error && (
        <div className="fm-migration-panel fm-migration-error" role="alert">
          <strong>Comparison unavailable</strong>
          <p>{error}</p>

          <button
            type="button"
            className="fm-migration-button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      )}

      {cloud && plan && !loading && (
        <>
          <div className="fm-migration-stats">
            {[
              ["Local records", totalLocal],
              ["Cloud records", totalCloud],
              ["Projects to resolve", unresolvedProjects],
              ["Selectable", selectableItems.length],
              ["Selected", selectedItems.length],
              ["Needs review", plan.needsReview],
            ].map(([label, value]) => (
              <div key={String(label)} className="fm-migration-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <section className="fm-migration-panel">
            <div className="fm-migration-section-heading">
              <div>
                <p className="fm-migration-eyebrow">STEP 4.1</p>
                <h3>Project Mapping</h3>
                <p className="fm-migration-muted">
                  Decide what happens to each local project before selecting
                  tasks that belong to it.
                </p>
              </div>
            </div>

            <div className="fm-migration-projects">
              {plan.projects.map((item: MigrationPlanItem) => {
                const source = local.projects.items.find(
                  (project: Project) => project.id === item.sourceId,
                );

                const choice = projectChoice(item.sourceId);

                const locked = cloud.projects.some(
                  (project: Project) => project.id === item.sourceId,
                );

                const dependentCount = local.tasks.items.filter(
                  (task) => task.projectId === item.sourceId,
                ).length;

                const nameConflict = cloud.projects.some(
                  (project: Project) =>
                    normalize(project.name) === normalize(item.title) ||
                    (source?.aliases ?? []).some(
                      (alias: string) =>
                        normalize(alias) === normalize(project.name),
                    ) ||
                    (project.aliases ?? []).some(
                      (alias: string) =>
                        normalize(alias) === normalize(item.title),
                    ),
                );

                const canCreate = item.status === "ready" && !nameConflict;

                return (
                  <div key={item.key} className="fm-migration-project">
                    <div className="fm-migration-project-top">
                      <div>
                        <strong>{item.title}</strong>
                        <p className="fm-migration-small">
                          {dependentCount} linked local tasks
                        </p>
                      </div>

                      <span className="fm-migration-tag">
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>

                    <label className="fm-migration-field">
                      <span>Project action</span>

                      <select
                        value={choice}
                        disabled={locked}
                        onChange={(event) =>
                          changeProjectDecision(
                            item.sourceId,
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Choose an action...</option>

                        {canCreate && (
                          <option value="create">Create as new project</option>
                        )}

                        {cloud.projects.map((project: Project) => (
                          <option key={project.id} value={project.id}>
                            Link to: {project.name}
                          </option>
                        ))}

                        {!locked && (
                          <option value="skip">Skip this project</option>
                        )}
                      </select>
                    </label>

                    <p className="fm-migration-small">
                      {decisionDescription(item.sourceId)}
                    </p>

                    {locked && (
                      <p className="fm-migration-small">
                        This ID already exists in cloud. Its mapping is fixed
                        and no overwrite is planned.
                      </p>
                    )}

                    {choice === "create" && canSelect(item) && (
                      <label className="fm-migration-check">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(item.key)}
                          onChange={() => toggleItem(item)}
                        />
                        Include this new project in the selection
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="fm-migration-panel">
            <div className="fm-migration-section-heading">
              <div>
                <p className="fm-migration-eyebrow">STEP 4.2</p>
                <h3>Select local records</h3>
                <p className="fm-migration-muted">
                  Tasks linked to skipped or unresolved projects cannot be
                  selected.
                </p>
              </div>
            </div>

            <div className="fm-migration-actions">
              <button
                type="button"
                className="fm-migration-button"
                onClick={selectAllReady}
                disabled={selectableItems.length === 0}
              >
                Select all available ({selectableItems.length})
              </button>

              <button
                type="button"
                className="fm-migration-button"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
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

            {GROUPS.map((group: GroupDefinition) => {
              const items = getItems(plan, group.kind);

              const visible = showAll ? items : items.slice(0, 5);

              return (
                <div key={group.kind} className="fm-migration-group">
                  <h4>{group.title}</h4>

                  <p className="fm-migration-small">
                    {getLocalCount(local, group.kind)} local ·{" "}
                    {getCloudCount(cloud, group.kind)} cloud
                  </p>

                  {visible.length === 0 && (
                    <p className="fm-migration-muted">
                      No valid local records.
                    </p>
                  )}

                  {visible.map((item: MigrationPlanItem) => {
                    const allowed = canSelect(item);

                    const choice = item.originalProjectId
                      ? projectChoice(item.originalProjectId)
                      : "";

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
                          disabled={!allowed}
                          onChange={() => toggleItem(item)}
                        />

                        <div>
                          <strong>{item.title || "(Untitled)"}</strong>

                          <span className="fm-migration-tag">
                            {STATUS_LABELS[item.status]}
                          </span>

                          <p className="fm-migration-small">{item.reason}</p>

                          {item.originalProjectId && (
                            <p className="fm-migration-small">
                              Project mapping:{" "}
                              {choice === "create"
                                ? "Create new"
                                : choice === "skip"
                                  ? "Skipped"
                                  : isLinkedToCloud(choice, cloud)
                                    ? "Existing cloud project"
                                    : "Unresolved"}
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
            <h3>Current migration selection</h3>

            <div className="fm-migration-stats">
              {GROUPS.map((group) => (
                <div key={group.kind} className="fm-migration-stat">
                  <span>{group.title}</span>
                  <strong>
                    {
                      selectedItems.filter(
                        (item: MigrationPlanItem) => item.kind === group.kind,
                      ).length
                    }
                  </strong>
                </div>
              ))}
            </div>

            <p className="fm-migration-muted">
              {selectedItems.length} records selected. Project mapping and
              selection exist only in memory and will be reset when the
              comparison is refreshed or closed.
            </p>

            {selectedItems.length > 0 && (
              <ul className="fm-migration-selected">
                {selectedItems.map((item: MigrationPlanItem) => (
                  <li key={item.key}>
                    {item.title}
                    <span>{item.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="fm-migration-actions">
            <button
              type="button"
              className="fm-migration-button"
              onClick={() => void refresh()}
            >
              Refresh comparison
            </button>
          </div>

          <footer className="fm-migration-footer">
            <strong>Import is not enabled yet.</strong>
            <p>
              This is a read-only migration plan. Before writing data, we will
              add explicit confirmation, validate database identifiers and
              project mappings again, and prevent duplicate imports.
            </p>
          </footer>
        </>
      )}
    </section>
  );
}
