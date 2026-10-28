import { useEffect, useRef, useState } from "react";

import {
  createInboxItems,
  loadInbox,
  saveInbox,
} from "../../utils/inboxStorage";

import "./QuickAdd.css";

interface QuickAddProps {
  onOpenInbox: () => void;
}

function QuickAdd({ onOpenInbox }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const previousFocusRef = useRef<HTMLElement | null>(null);

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

    window.setTimeout(() => {
      previousFocusRef.current?.focus();
    }, 0);
  }

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        if (event.repeat) {
          return;
        }

        setOpen((previous) => {
          if (!previous) {
            previousFocusRef.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }

          setError("");
          setSavedCount(0);

          return true;
        });
      }

      if (event.key === "Escape") {
        setOpen((previous) => {
          if (previous) {
            event.preventDefault();
            return false;
          }

          return previous;
        });
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut);

    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    textareaRef.current?.focus();

    function handleFocusTrap(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<
          HTMLButtonElement | HTMLTextAreaElement
        >("button:not(:disabled), textarea:not(:disabled)"),
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

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

    const existing = loadInbox();

    const saved = saveInbox([...newItems, ...existing]);

    if (!saved) {
      setError("Could not save your notes. " + "Please try again.");

      return;
    }

    setSavedCount(newItems.length);
    setText("");
    setError("");
    setOpen(false);

    window.setTimeout(() => {
      setSavedCount(0);
    }, 3500);
  }

  function handleTextareaKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveQuickAdd();
    }
  }

  return (
    <>
      <div className="fm-quick-add-access">
        <button
          type="button"
          className="fm-quick-add-trigger"
          onClick={openQuickAdd}
          aria-label="Open Quick Add"
          title="Quick Add (Ctrl + K)"
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
            className="fm-quick-add-dialog"
            ref={dialogRef}
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
              {text.split(/\r?\n/).filter((line) => line.trim()).length} item(s)
              ready
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
          </div>
        </div>
      )}
    </>
  );
}

export default QuickAdd;
