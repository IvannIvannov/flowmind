import { useEffect, useRef, useState } from "react";

import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  createInboxItems,
  loadInbox,
  saveInbox,
} from "../../utils/inboxStorage";

import {
  downloadFlowMindBackup,
  readFlowMindBackup,
  restoreFlowMindBackup,
} from "../../utils/backup";

import "./QuickAdd.css";

interface QuickAddProps {
  onOpenInbox: () => void;
}

function QuickAdd({ onOpenInbox }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [restoring, setRestoring] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const previousFocusRef = useRef<HTMLElement | null>(null);

  const itemCount = text.split(/\r?\n/).filter((line) => line.trim()).length;

  function openQuickAdd() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setOpen(true);
    setError("");
    setSavedCount(0);
  }

  function closeQuickAdd() {
    setOpen(false);
    setError("");

    window.requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        if (event.repeat) return;

        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        setOpen(true);
        setError("");
        setSavedCount(0);
      }

      if (event.key === "Escape") {
        setOpen((current) => {
          if (!current) return current;

          event.preventDefault();

          window.requestAnimationFrame(() => {
            previousFocusRef.current?.focus();
          });

          return false;
        });
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut);

    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    textareaRef.current?.focus();

    function handleFocusTrap(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const elements = Array.from(
        dialogRef.current.querySelectorAll<
          HTMLButtonElement | HTMLTextAreaElement
        >("button:not(:disabled), textarea:not(:disabled)"),
      );

      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleFocusTrap);

    return () => {
      document.removeEventListener("keydown", handleFocusTrap);
    };
  }, [open]);

  function saveQuickAdd() {
    const newItems = createInboxItems(text);

    if (newItems.length === 0) {
      setError("Write at least one task or idea.");
      return;
    }

    const saved = saveInbox([...newItems, ...loadInbox()]);

    if (!saved) {
      setError("Could not save your notes. Please try again.");
      return;
    }

    setSavedCount(newItems.length);
    setText("");
    setError("");
    setOpen(false);
  }

  function handleTextareaKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveQuickAdd();
    }
  }

  function handleExport() {
    try {
      const count = downloadFlowMindBackup();

      setError("");

      window.alert(
        `Backup prepared with ${count} local data entries.\n` +
          "Save the JSON file somewhere safe.",
      );
    } catch (cause) {
      console.error("FlowMind: backup export failed", cause);

      setError("Backup could not be exported.");
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setRestoring(true);
    setError("");

    try {
      const backup = await readFlowMindBackup(file);

      const confirmed = window.confirm(
        "Restore FlowMind backup?\n\n" +
          `Backup date: ${backup.exportedAt}\n` +
          `Data entries: ${Object.keys(backup.data).length}\n\n` +
          "This will REPLACE the current FlowMind data.\n" +
          "Export a backup of your current data first.",
      );

      if (!confirmed) return;

      restoreFlowMindBackup(backup);

      // Reload so that all pages initialize from
      // the restored local data.
      window.location.reload();
    } catch (cause) {
      console.error("FlowMind: backup restore failed", cause);

      setError(
        cause instanceof Error ? cause.message : "Could not restore backup.",
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <div className="fm-quick-add-access">
        <button
          type="button"
          className="fm-quick-add-trigger"
          onClick={openQuickAdd}
          title="Quick Add (Ctrl + K)"
          aria-label="Open Quick Add"
        >
          <span className="fm-quick-add-trigger-icon">+</span>

          <span>Quick Add</span>

          <kbd>Ctrl K</kbd>
        </button>
      </div>

      {savedCount > 0 && !open && (
        <div className="fm-quick-add-toast" role="status">
          ✓ {savedCount} item(s) saved to Inbox.
          <button
            type="button"
            onClick={() => {
              setSavedCount(0);
              onOpenInbox();
            }}
          >
            Open Inbox
          </button>
        </div>
      )}

      {open && (
        <div
          className="fm-quick-add-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeQuickAdd();
            }
          }}
        >
          <div
            ref={dialogRef}
            className="fm-quick-add-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fm-quick-add-title"
            aria-describedby="fm-quick-add-description"
          >
            <div className="fm-quick-add-header">
              <div>
                <p className="fm-quick-add-eyebrow">
                  CAPTURE FIRST, ORGANIZE LATER
                </p>

                <h2 id="fm-quick-add-title">Quick Capture ⚡</h2>
              </div>

              <button
                type="button"
                className="fm-quick-add-close"
                onClick={closeQuickAdd}
                aria-label="Close Quick Add"
              >
                ✕
              </button>
            </div>

            <p
              className="fm-quick-add-description"
              id="fm-quick-add-description"
            >
              Write anything on your mind. Each non-empty line becomes a
              separate Inbox item.
            </p>

            <label
              htmlFor="fm-quick-add-textarea"
              className="fm-quick-add-label"
            >
              Your notes
            </label>

            <textarea
              id="fm-quick-add-textarea"
              ref={textareaRef}
              rows={7}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
              }}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                "Edit the new reel for Mazu\n" +
                "Send a brand partnership email\n" +
                "Review this week's tasks"
              }
            />

            <div className="fm-quick-add-counter">
              {itemCount} item(s) ready
            </div>

            {error && (
              <div className="fm-quick-add-error" role="alert">
                {error}
              </div>
            )}

            <div className="fm-quick-add-footer">
              <div className="fm-quick-add-shortcuts">
                <span>
                  <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save
                </span>

                <span>
                  <kbd>Esc</kbd> to close
                </span>
              </div>

              <div className="fm-quick-add-actions">
                <button
                  type="button"
                  className="fm-quick-add-secondary"
                  onClick={closeQuickAdd}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="fm-quick-add-primary"
                  onClick={saveQuickAdd}
                  disabled={!text.trim()}
                >
                  + Save to Inbox
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                borderTop: "1px solid #343747",
                paddingTop: 18,
                marginTop: 20,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 140,
                  color: "#a3a8b8",
                  fontSize: 12,
                }}
              >
                Data Backup & Restore
              </span>

              <button
                type="button"
                className="fm-quick-add-secondary"
                onClick={handleExport}
              >
                ↓ Backup
              </button>

              <button
                type="button"
                className="fm-quick-add-secondary"
                disabled={restoring}
                onClick={() => fileRef.current?.click()}
              >
                ↑ Restore
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                aria-label="Choose FlowMind backup"
                style={{ display: "none" }}
                onChange={handleImport}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QuickAdd;
