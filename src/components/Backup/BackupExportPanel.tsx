import { useRef, useState } from "react";

import type { CSSProperties } from "react";

import {
  backupToJson,
  createCloudBackup,
  downloadCloudBackup,
  getBackupCounts,
} from "../../services/cloudBackup";

import type { BackupCounts, FlowMindBackup } from "../../services/cloudBackup";

import {
  compareBackupWithCloud,
  validateBackupJson,
} from "../../services/backupValidation";

import type { RestorePreview } from "../../services/backupValidation";

interface Props {
  userId: string;
}

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

const initialCounts: BackupCounts = {
  projects: 0,
  tasks: 0,
  inbox: 0,
  focusHistory: 0,
  dayPriorities: 0,
  total: 0,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "An unexpected error occurred.";
}

export default function BackupExportPanel({ userId }: Props) {
  const [backup, setBackup] = useState<FlowMindBackup | null>(null);

  const [counts, setCounts] = useState<BackupCounts>(initialCounts);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [restoreBusy, setRestoreBusy] = useState(false);

  const [restoreError, setRestoreError] = useState("");

  const [restoreWarnings, setRestoreWarnings] = useState<string[]>([]);

  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(
    null,
  );

  const [restoreFileName, setRestoreFileName] = useState("");

  const [restoreExportDate, setRestoreExportDate] = useState("");

  const [previewAccount, setPreviewAccount] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const restoreRequest = useRef(0);

  async function prepareBackup(): Promise<void> {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    setBackup(null);
    setCounts(initialCounts);

    try {
      const result = await createCloudBackup(userId);

      setBackup(result);
      setCounts(getBackupCounts(result));

      setMessage("Backup prepared. Review the counts and save the JSON file.");
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

      setMessage(
        "Download requested. Check that the JSON file was saved on your device.",
      );
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

      setMessage("Backup JSON copied. Save it securely in a .json file.");
    } catch (cause) {
      setError("Could not copy backup JSON: " + errorText(cause));
    }
  }

  function clearRestorePreview(): void {
    restoreRequest.current += 1;

    setRestoreBusy(false);
    setRestorePreview(null);
    setRestoreWarnings([]);
    setRestoreError("");
    setRestoreFileName("");
    setRestoreExportDate("");
    setPreviewAccount("");

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  async function inspectFile(file: File): Promise<void> {
    const request = ++restoreRequest.current;

    setRestoreBusy(true);
    setRestoreError("");
    setRestorePreview(null);
    setRestoreWarnings([]);
    setRestoreFileName(file.name);
    setRestoreExportDate("");
    setPreviewAccount("");

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Backup file exceeds the 10 MB preview limit.");
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please select a .json backup file.");
      }

      const contents = await file.text();

      if (restoreRequest.current !== request) {
        return;
      }

      const validation = validateBackupJson(contents, userId);

      if (!validation.valid || !validation.backup) {
        throw new Error(
          validation.errors.join("\n") || "Invalid FlowMind backup.",
        );
      }

      const archive = validation.backup;

      // Fetch current account data for a
      // read-only comparison.
      const cloudNow = await createCloudBackup(userId);

      if (restoreRequest.current !== request) {
        return;
      }

      const comparison = compareBackupWithCloud(archive, cloudNow);

      setRestorePreview(comparison);
      setRestoreWarnings(validation.warnings);
      setRestoreExportDate(archive.exportedAt);
      setPreviewAccount(archive.ownerUserId);
    } catch (cause) {
      if (restoreRequest.current !== request) {
        return;
      }

      setRestoreError(errorText(cause));
    } finally {
      if (restoreRequest.current === request) {
        setRestoreBusy(false);
      }
    }
  }

  return (
    <section
      aria-label="Cloud backup and restore preview"
      style={{
        border: "1px solid var(--fm-border)",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
        background: "var(--fm-surface)",
        color: "var(--fm-text)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.7,
          opacity: 0.65,
          marginTop: 0,
        }}
      >
        DATA PROTECTION · PART 5
      </p>

      <h3>Cloud Backup</h3>

      <p
        style={{
          fontSize: 13,
          opacity: 0.75,
          lineHeight: 1.6,
        }}
      >
        Export a personal JSON backup of your current FlowMind cloud data.
        Nothing will be changed in Supabase.
      </p>

      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          overflowWrap: "anywhere",
        }}
      >
        Account: {userId}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          margin: "18px 0",
        }}
      >
        <button
          type="button"
          style={buttonStyle}
          disabled={busy}
          onClick={() => {
            void prepareBackup();
          }}
        >
          {busy
            ? "Preparing backup..."
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

      {backup && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
              gap: 10,
              marginTop: 20,
            }}
          >
            {[
              ["Projects", counts.projects],
              ["Tasks", counts.tasks],
              ["Inbox", counts.inbox],
              ["Focus History", counts.focusHistory],
              ["Daily Priorities", counts.dayPriorities],
              ["Total records", counts.total],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  ...panelStyle,
                  padding: 12,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  {label}
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 23,
                    marginTop: 6,
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
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

      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.7,
          opacity: 0.65,
        }}
      >
        RESTORE · STEP 1
      </p>

      <h3>Restore Preview</h3>

      <p
        style={{
          fontSize: 13,
          opacity: 0.75,
          lineHeight: 1.6,
        }}
      >
        Select an existing FlowMind JSON backup. We will validate the file and
        compare its contents against your current cloud data.
      </p>

      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        No data will be restored, overwritten or deleted.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Select FlowMind backup JSON"
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

      <button
        type="button"
        style={buttonStyle}
        onClick={clearRestorePreview}
        disabled={restoreBusy && !restoreFileName}
      >
        Clear preview
      </button>

      {restoreBusy && (
        <p role="status">Validating backup and comparing with Supabase...</p>
      )}

      {restoreError && (
        <div
          role="alert"
          style={{
            ...panelStyle,
            borderLeft: "3px solid #dc2626",
            marginTop: 16,
          }}
        >
          <strong>Backup validation failed</strong>

          <p style={{ whiteSpace: "pre-wrap" }}>{restoreError}</p>
        </div>
      )}

      {restorePreview && !restoreBusy && (
        <>
          <div
            style={{
              ...panelStyle,
              marginTop: 18,
            }}
          >
            <strong>Valid FlowMind backup</strong>

            <p
              style={{
                fontSize: 12,
                overflowWrap: "anywhere",
              }}
            >
              File: {restoreFileName}
            </p>

            <p style={{ fontSize: 12 }}>
              Exported: {new Date(restoreExportDate).toLocaleString()}
            </p>

            <p
              style={{
                fontSize: 12,
                overflowWrap: "anywhere",
              }}
            >
              Owner: {previewAccount}
            </p>

            <p style={{ fontSize: 12 }}>
              The owner matches the currently signed-in account.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
              gap: 10,
              margin: "18px 0",
            }}
          >
            {[
              ["Archived", restorePreview.totalArchived],
              ["Already in cloud", restorePreview.totalExisting],
              ["Possible duplicates", restorePreview.totalPossibleDuplicates],
              ["Unmatched", restorePreview.totalUnmatched],
            ].map(([label, value]) => (
              <div key={String(label)} style={panelStyle}>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  {label}
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: 24,
                    marginTop: 7,
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>

          <div style={panelStyle}>
            <h4 style={{ marginTop: 0 }}>Comparison by category</h4>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
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
                  <li key={index}>
                    <span style={{ fontSize: 12 }}>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              ...panelStyle,
              marginTop: 18,
            }}
          >
            <strong>Restore is not enabled yet.</strong>

            <p
              style={{
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              This preview is read-only. Before restoring, we will add selection
              by individual record, relationship validation, a fresh cloud
              comparison and explicit confirmation.
            </p>
          </div>
        </>
      )}

      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          lineHeight: 1.6,
          marginTop: 18,
        }}
      >
        JSON backups may contain private task names and notes. Keep the files
        secure. The backup contains no login credentials. Validation and
        comparison do not modify your cloud workspace.
      </p>
    </section>
  );
}
