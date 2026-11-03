import { useRef, useState } from "react";
import type { CSSProperties } from "react";

import {
  backupToJson,
  createCloudBackup,
  downloadCloudBackup,
  getBackupCounts,
} from "../../services/cloudBackup";

import type { FlowMindBackup } from "../../services/cloudBackup";

import {
  compareBackupWithCloud,
  validateBackupJson,
} from "../../services/backupValidation";

import type { RestorePreview } from "../../services/backupValidation";

import RestoreSelectionPanel from "./RestoreSelectionPanel";

interface Props {
  userId: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const buttonStyle: CSSProperties = {
  border: "1px solid var(--fm-border)",
  background: "var(--fm-surface)",
  color: "var(--fm-text)",
  borderRadius: 9,
  padding: "10px 14px",
  font: "inherit",
  cursor: "pointer",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--fm-border)",
  background: "var(--fm-surface)",
  borderRadius: 12,
  padding: 16,
};

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "An unexpected error occurred.";
}

export default function BackupExportPanel({ userId }: Props) {
  const [backup, setBackup] = useState<FlowMindBackup | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [restoreBusy, setRestoreBusy] = useState(false);

  const [restoreError, setRestoreError] = useState("");

  const [restoreWarnings, setRestoreWarnings] = useState<string[]>([]);

  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(
    null,
  );

  const [restoreArchive, setRestoreArchive] = useState<FlowMindBackup | null>(
    null,
  );

  const [restoreCloud, setRestoreCloud] = useState<FlowMindBackup | null>(null);

  const [restoreFileName, setRestoreFileName] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const restoreRequest = useRef(0);

  async function prepareBackup(): Promise<void> {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    setBackup(null);

    try {
      const result = await createCloudBackup(userId);
      setBackup(result);

      setMessage("Backup prepared. Save the JSON file securely.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  function download(): void {
    if (!backup || busy) return;

    setError("");
    setMessage("");

    try {
      downloadCloudBackup(backup);

      setMessage("Download requested. Verify that the file was saved.");
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function copyJson(): Promise<void> {
    if (!backup || busy) return;

    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(backupToJson(backup));

      setMessage("Backup copied. Save it securely as a JSON file.");
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  function clearRestore(): void {
    restoreRequest.current += 1;

    setRestoreBusy(false);
    setRestoreError("");
    setRestoreWarnings([]);
    setRestorePreview(null);
    setRestoreArchive(null);
    setRestoreCloud(null);
    setRestoreFileName("");

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  async function inspectFile(file: File): Promise<void> {
    const request = ++restoreRequest.current;

    setRestoreBusy(true);
    setRestoreError("");
    setRestoreWarnings([]);
    setRestorePreview(null);
    setRestoreArchive(null);
    setRestoreCloud(null);
    setRestoreFileName(file.name);

    try {
      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        throw new Error("Choose a non-empty backup file under 10 MB.");
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please choose a JSON backup file.");
      }

      const contents = await file.text();

      if (request !== restoreRequest.current) return;

      const result = validateBackupJson(contents, userId);

      if (!result.valid || !result.backup) {
        throw new Error(
          result.errors.join("\n") || "Backup validation failed.",
        );
      }

      const cloudNow = await createCloudBackup(userId);

      if (request !== restoreRequest.current) return;

      const comparison = compareBackupWithCloud(result.backup, cloudNow);

      setRestoreArchive(result.backup);
      setRestoreCloud(cloudNow);
      setRestorePreview(comparison);
      setRestoreWarnings(result.warnings);
    } catch (cause) {
      if (request !== restoreRequest.current) return;
      setRestoreError(errorText(cause));
    } finally {
      if (request === restoreRequest.current) {
        setRestoreBusy(false);
      }
    }
  }

  const counts = backup ? getBackupCounts(backup) : null;

  return (
    <section
      aria-label="Cloud backup and restore"
      style={{
        border: "1px solid var(--fm-border)",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
        background: "var(--fm-surface)",
        color: "var(--fm-text)",
      }}
    >
      <p className="fm-migration-eyebrow">DATA PROTECTION · PART 5</p>

      <h3>Cloud Backup</h3>

      <p className="fm-migration-muted">
        Export all cloud data for the currently signed-in FlowMind account.
      </p>

      <p className="fm-migration-id">Account: {userId}</p>

      <div className="fm-migration-actions">
        <button
          type="button"
          style={buttonStyle}
          disabled={busy}
          onClick={() => {
            void prepareBackup();
          }}
        >
          {busy
            ? "Preparing..."
            : backup
              ? "Prepare fresh backup"
              : "Prepare cloud backup"}
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={!backup || busy}
          onClick={download}
        >
          Download JSON
        </button>

        <button
          type="button"
          style={buttonStyle}
          disabled={!backup || busy}
          onClick={() => {
            void copyJson();
          }}
        >
          Copy JSON
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {counts && backup && (
        <>
          <div className="fm-migration-stats">
            {[
              ["Projects", counts.projects],
              ["Tasks", counts.tasks],
              ["Inbox", counts.inbox],
              ["Focus History", counts.focusHistory],
              ["Daily Priorities", counts.dayPriorities],
              ["Total", counts.total],
            ].map(([label, value]) => (
              <div key={String(label)} className="fm-migration-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <p className="fm-migration-small">
            Created: {new Date(backup.exportedAt).toLocaleString()}
          </p>
        </>
      )}

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--fm-border)",
          margin: "28px 0",
        }}
      />

      <p className="fm-migration-eyebrow">RESTORE · STEP 1</p>

      <h3>Backup Validation & Preview</h3>

      <p className="fm-migration-muted">
        Select a FlowMind JSON archive. The app will check the owner, data
        format and current cloud records.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Choose FlowMind backup JSON"
        disabled={restoreBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void inspectFile(file);
          }
        }}
        style={{
          display: "block",
          maxWidth: "100%",
          margin: "16px 0",
          color: "var(--fm-text)",
        }}
      />

      <button type="button" style={buttonStyle} onClick={clearRestore}>
        Clear preview
      </button>

      {restoreBusy && <p role="status">Validating and comparing backup...</p>}

      {restoreError && (
        <div
          role="alert"
          style={{
            ...panelStyle,
            borderLeft: "3px solid #dc2626",
            marginTop: 16,
          }}
        >
          <strong>Validation failed</strong>

          <p style={{ whiteSpace: "pre-wrap" }}>{restoreError}</p>
        </div>
      )}

      {restorePreview && restoreArchive && restoreCloud && !restoreBusy && (
        <>
          <div
            style={{
              ...panelStyle,
              marginTop: 18,
            }}
          >
            <strong>Valid FlowMind backup</strong>

            <p className="fm-migration-small">File: {restoreFileName}</p>

            <p className="fm-migration-small">
              Exported: {new Date(restoreArchive.exportedAt).toLocaleString()}
            </p>

            <p className="fm-migration-id">
              Owner: {restoreArchive.ownerUserId}
            </p>
          </div>

          <div className="fm-migration-stats">
            {[
              ["Archived", restorePreview.totalArchived],
              ["Existing", restorePreview.totalExisting],
              ["Possible duplicates", restorePreview.totalPossibleDuplicates],
              ["Unmatched", restorePreview.totalUnmatched],
            ].map(([label, value]) => (
              <div key={String(label)} className="fm-migration-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div style={panelStyle}>
            <h4>Comparison by category</h4>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Category",
                      "Archive",
                      "Cloud",
                      "Existing",
                      "Possible",
                      "Unmatched",
                    ].map((label) => (
                      <th
                        key={label}
                        style={{
                          padding: 9,
                          borderBottom: "1px solid var(--fm-border)",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {restorePreview.categories.map((category) => (
                    <tr key={category.category}>
                      <td style={{ padding: 9 }}>{category.label}</td>

                      <td style={{ padding: 9 }}>{category.archived}</td>

                      <td style={{ padding: 9 }}>{category.cloud}</td>

                      <td style={{ padding: 9 }}>{category.existing}</td>

                      <td style={{ padding: 9 }}>
                        {category.possibleDuplicates}
                      </td>

                      <td style={{ padding: 9 }}>{category.unmatched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {restoreWarnings.length > 0 && (
            <div
              style={{
                ...panelStyle,
                marginTop: 16,
              }}
            >
              <strong>Relationship warnings ({restoreWarnings.length})</strong>

              <ul>
                {restoreWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <RestoreSelectionPanel
              key={restoreArchive.exportedAt + ":" + restoreRequest.current}
              archive={restoreArchive}
              cloud={restoreCloud}
            />
          </div>
        </>
      )}

      <p className="fm-migration-small">
        This entire Restore Preview is read-only. No cloud records are inserted,
        changed or deleted. Keep backup JSON files secure.
      </p>
    </section>
  );
}
