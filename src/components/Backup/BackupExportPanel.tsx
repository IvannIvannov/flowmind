import { useState } from "react";

import type { CSSProperties } from "react";

import {
  backupToJson,
  createCloudBackup,
  downloadCloudBackup,
  getBackupCounts,
} from "../../services/cloudBackup";

import type { BackupCounts, FlowMindBackup } from "../../services/cloudBackup";

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

const initialCounts: BackupCounts = {
  projects: 0,
  tasks: 0,
  inbox: 0,
  focusHistory: 0,
  dayPriorities: 0,
  total: 0,
};

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Could not create your backup.";
}

export default function BackupExportPanel({ userId }: Props) {
  const [backup, setBackup] = useState<FlowMindBackup | null>(null);

  const [counts, setCounts] = useState<BackupCounts>(initialCounts);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

      setMessage(
        "Backup prepared. Review the counts, then save the JSON file.",
      );
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
        "Download requested. Check that the JSON file was actually saved on your device.",
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

      setMessage(
        "Backup JSON copied. Paste it into a new .json file and save it securely.",
      );
    } catch (cause) {
      setError("Could not copy backup JSON: " + errorText(cause));
    }
  }

  return (
    <section
      aria-label="Cloud backup export"
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

      <h3 style={{ marginBottom: 8 }}>Cloud Backup</h3>

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

      {error && (
        <p
          role="alert"
          style={{
            borderLeft: "3px solid #dc2626",
            padding: "8px 12px",
          }}
        >
          {error}
        </p>
      )}

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
                  border: "1px solid var(--fm-border)",
                  borderRadius: 10,
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

      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          lineHeight: 1.6,
          marginTop: 18,
        }}
      >
        Your JSON file may contain private task names, notes and activity
        history. Store it securely. This export does not include passwords or
        login tokens. The data is read from several cloud tables, so changes
        made during export may not be captured as one atomic snapshot.
      </p>
    </section>
  );
}
