import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import "./QuickAdd.css";

interface QuickAddProps {
  onOpenInbox: () => void;
  onAddItems: (texts: string[]) => Promise<void>;
}

function QuickAdd({ onOpenInbox, onAddItems }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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

  async function saveQuickAdd() {
    if (saving) return;

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Write at least one task or idea.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onAddItems(lines);

      setSavedCount(lines.length);
      setText("");
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save your notes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleTextareaKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void saveQuickAdd();
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
                  onClick={() => {
                    void saveQuickAdd();
                  }}
                  disabled={!text.trim() || saving}
                >
                  + Save to Inbox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QuickAdd;
