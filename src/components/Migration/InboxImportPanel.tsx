import { useMemo, useRef, useState } from "react";

import type { InboxItem } from "../../utils/inboxStorage";

import { importLegacyInbox } from "../../services/migrationInbox";

interface Props {
  userId: string;
  localItems: InboxItem[];
  cloudItems: InboxItem[];
  onImported: () => Promise<void>;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function errorText(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Could not import Inbox items.";
}

export default function InboxImportPanel({
  userId,
  localItems,
  cloudItems,
  onImported,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busyRef = useRef(false);

  const cloudIds = useMemo(
    () => new Set(cloudItems.map((item) => item.id)),
    [cloudItems],
  );

  const cloudTexts = useMemo(
    () => new Set(cloudItems.map((item) => normalize(item.text))),
    [cloudItems],
  );

  const textCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of localItems) {
      const key = normalize(item.text);

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }, [localItems]);

  function reason(item: InboxItem): string | null {
    if (!item.text.trim()) {
      return "Empty note";
    }

    if (cloudIds.has(item.id)) {
      return "Already in cloud (same ID)";
    }

    if (cloudTexts.has(normalize(item.text))) {
      return "Possible cloud duplicate";
    }

    if ((textCounts.get(normalize(item.text)) ?? 0) > 1) {
      return "Repeated local text — review manually";
    }

    return null;
  }

  const selectable = localItems.filter((item) => reason(item) === null);

  const selectedSet = new Set(selected);

  function changeSelection(id: string): void {
    if (busy) return;

    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );

    setConfirming(false);
    setConfirmation("");
    setError("");
  }

  async function runImport(): Promise<void> {
    if (busyRef.current || confirmation !== "IMPORT" || selected.length === 0) {
      return;
    }

    if (selected.some((id) => !selectable.some((item) => item.id === id))) {
      setError("Selection changed. Review the Inbox items again.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await importLegacyInbox({
        userId,
        localAtReview: localItems,
        cloudAtReview: cloudItems,
        selectedIds: selected,
      });

      setSelected([]);
      setConfirming(false);
      setConfirmation("");

      setSuccess(`${result.created} Inbox item(s) imported successfully.`);

      try {
        await onImported();
      } catch (cause) {
        setError(
          "Import succeeded, but refreshing the " +
            "comparison failed: " +
            errorText(cause),
        );
      }
    } catch (cause) {
      setError(errorText(cause));

      // The server's final result may be uncertain.
      // Never offer a blind retry after failure.
      setSelected([]);
      setConfirming(false);
      setConfirmation("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="fm-migration-panel">
      <p className="fm-migration-eyebrow">STEP 6 · INBOX</p>

      <h3>Import legacy Inbox</h3>

      <p className="fm-migration-muted">
        Import selected notes without modifying your original local Inbox.
      </p>

      {success && <p role="status">{success}</p>}

      {error && <p role="alert">{error}</p>}

      <p className="fm-migration-small">
        {localItems.length} local notes · {cloudItems.length} cloud notes ·{" "}
        {selectable.length} available
      </p>

      <div className="fm-migration-actions">
        <button
          type="button"
          className="fm-migration-button"
          disabled={busy || selectable.length === 0}
          onClick={() => {
            setSelected(selectable.map((item) => item.id));
            setConfirming(false);
            setConfirmation("");
          }}
        >
          Select available Inbox notes
        </button>

        <button
          type="button"
          className="fm-migration-button"
          disabled={busy || selected.length === 0}
          onClick={() => {
            setSelected([]);
            setConfirming(false);
            setConfirmation("");
          }}
        >
          Clear Inbox selection
        </button>
      </div>

      {localItems.map((item) => {
        const warning = reason(item);
        const allowed = warning === null;

        return (
          <label
            className={
              "fm-migration-record" +
              (!allowed ? " fm-migration-record-disabled" : "")
            }
            key={item.id}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(item.id)}
              disabled={busy || !allowed}
              onChange={() => changeSelection(item.id)}
            />

            <div>
              <strong>{item.text || "(Empty)"}</strong>

              <p className="fm-migration-small">
                {warning ?? "Available for import"}
              </p>
            </div>
          </label>
        );
      })}

      <div style={{ marginTop: 20 }}>
        <strong>Selected Inbox notes: {selected.length}</strong>
      </div>

      {selected.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {!confirming ? (
            <button
              type="button"
              className="fm-migration-button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Review Inbox import
            </button>
          ) : (
            <div className="fm-migration-panel">
              <strong>Confirm Inbox import</strong>

              <p className="fm-migration-small">
                You are about to create {selected.length} notes in your cloud
                Inbox.
              </p>

              <p className="fm-migration-small">Type IMPORT to confirm.</p>

              <input
                type="text"
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="IMPORT"
                aria-label="Confirm Inbox import"
                autoComplete="off"
                spellCheck={false}
                style={{
                  maxWidth: 240,
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--fm-border)",
                  borderRadius: 8,
                  color: "var(--fm-text)",
                  background: "var(--fm-surface)",
                }}
              />

              <div className="fm-migration-actions">
                <button
                  type="button"
                  className="fm-migration-button"
                  disabled={busy || confirmation !== "IMPORT"}
                  onClick={() => {
                    void runImport();
                  }}
                >
                  {busy ? "Importing..." : "Confirm Inbox import"}
                </button>

                <button
                  type="button"
                  className="fm-migration-button"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setConfirmation("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="fm-migration-small">
        Duplicate text is excluded from this automatic import. Focus History is
        not affected.
      </p>
    </section>
  );
}
