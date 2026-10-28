import { useEffect, useRef, useState } from "react";

import type { InboxItem } from "../../utils/inboxStorage";

import {
  createInboxItems,
  loadInbox,
  saveInbox,
} from "../../utils/inboxStorage";

import "./Inbox.css";

interface InboxProps {
  onOrganize: (item: InboxItem) => void;
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "plus"
    | "search"
    | "arrow"
    | "edit"
    | "trash"
    | "inbox"
    | "close"
    | "check";
  size?: number;
}) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    arrow: <path d="M7 17 17 7M8 7h9v9" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
      </>
    ),
    inbox: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 14h5l2 3h4l2-3h5" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Captured";
  }

  const now = new Date();

  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const difference = Math.round(
    (currentDay.getTime() - itemDay.getTime()) / 86400000,
  );

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (difference === 0) {
    return `Today, ${time}`;
  }

  if (difference === 1) {
    return `Yesterday, ${time}`;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Inbox({ onOrganize }: InboxProps) {
  const [items, setItems] = useState<InboxItem[]>(loadInbox);

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const captureRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showSearch) {
      searchRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (editingId !== null) {
      editRef.current?.focus();
    }
  }, [editingId]);

  useEffect(() => {
    function refresh() {
      setItems(loadInbox());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === "flowmind-inbox-v1" || event.key === null) {
        refresh();
      }
    }

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const readyCount = input
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;

  const visibleItems = items.filter((item) =>
    item.text
      .toLocaleLowerCase("bg-BG")
      .includes(search.toLocaleLowerCase("bg-BG").trim()),
  );

  function commit(nextItems: InboxItem[]): boolean {
    if (!saveInbox(nextItems)) {
      setError(
        "Could not save changes. Your previous Inbox data is unchanged.",
      );
      setMessage("");
      return false;
    }

    setItems(nextItems);
    setError("");
    return true;
  }

  function addItems() {
    const newItems = createInboxItems(input);

    if (newItems.length === 0) {
      setError("Write at least one item first.");
      setMessage("");
      captureRef.current?.focus();
      return;
    }

    // Load the latest saved Inbox so Quick Add entries
    // are not overwritten by older component state.
    const latestItems = loadInbox();

    if (!commit([...newItems, ...latestItems])) {
      return;
    }

    setInput("");
    setMessage(
      newItems.length === 1
        ? "Your thought was captured."
        : `${newItems.length} items captured.`,
    );

    captureRef.current?.focus();
  }

  function onCaptureKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      addItems();
    }

    if (event.key === "Escape" && message) {
      setMessage("");
    }
  }

  function startEditing(item: InboxItem) {
    setEditingId(item.id);
    setEditingText(item.text);
    setMessage("");
    setError("");
  }

  function saveEdit() {
    if (!editingId) return;

    const text = editingText.trim();

    if (!text) {
      setError("Inbox item cannot be empty.");
      return;
    }

    const updated = items.map((item) =>
      item.id === editingId ? { ...item, text } : item,
    );

    if (!commit(updated)) return;

    setEditingId(null);
    setEditingText("");
    setMessage("Item updated.");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
    setError("");
  }

  function deleteItem(item: InboxItem) {
    const confirmed = window.confirm(`Delete this Inbox item?\n\n${item.text}`);

    if (!confirmed) return;

    const next = items.filter((entry) => entry.id !== item.id);

    if (!commit(next)) return;

    if (editingId === item.id) {
      setEditingId(null);
      setEditingText("");
    }

    setMessage("Item deleted.");
  }

  function clearSearch() {
    setSearch("");
    setShowSearch(false);
  }

  return (
    <main className="fm-inbox">
      {/* PAGE INTRO */}

      <header className="fm-inbox-header">
        <div className="fm-inbox-header-copy">
          <span className="fm-inbox-eyebrow">YOUR CAPTURE SPACE</span>

          <h1>
            Inbox<span>.</span>
          </h1>

          <p>
            A place for everything on your mind. Capture now, organize later.
          </p>
        </div>

        <div className="fm-inbox-header-icon" aria-hidden="true">
          <Icon name="inbox" size={23} />
        </div>
      </header>

      {/* QUICK CAPTURE */}

      <section className="fm-inbox-capture" aria-label="Quick capture">
        <div className="fm-inbox-capture-heading">
          <span className="fm-inbox-capture-plus">
            <Icon name="plus" size={20} />
          </span>

          <div>
            <h2>Quick capture</h2>
            <p>Get it out of your head and into your Inbox.</p>
          </div>
        </div>

        <label className="fm-inbox-sr-only" htmlFor="fm-inbox-input">
          Write your thoughts or tasks
        </label>

        <textarea
          ref={captureRef}
          id="fm-inbox-input"
          className="fm-inbox-textarea"
          rows={3}
          placeholder="What's on your mind?"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);

            if (error) setError("");
            if (message) setMessage("");
          }}
          onKeyDown={onCaptureKeyDown}
        />

        <footer className="fm-inbox-capture-footer">
          <div className="fm-inbox-capture-hint">
            <span>
              <kbd>Enter</kbd> to capture
            </span>

            <span className="fm-inbox-hint-divider">·</span>

            <span>
              <kbd>Shift</kbd> + <kbd>Enter</kbd> for new line
            </span>

            {readyCount > 1 && (
              <span className="fm-inbox-ready-count">
                {readyCount} items ready
              </span>
            )}
          </div>

          <button
            type="button"
            className="fm-inbox-capture-button"
            onClick={addItems}
            disabled={readyCount === 0}
          >
            <Icon name="plus" size={17} />
            Capture
          </button>
        </footer>
      </section>

      {/* FEEDBACK */}

      {error && (
        <div className="fm-inbox-feedback fm-inbox-error" role="alert">
          {error}

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {message && !error && (
        <div className="fm-inbox-feedback fm-inbox-success" role="status">
          <Icon name="check" size={17} />
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {/* UNPROCESSED ITEMS */}

      <section
        className="fm-inbox-items-section"
        aria-label="Unprocessed Inbox items"
      >
        <div className="fm-inbox-list-header">
          <div className="fm-inbox-list-title">
            <h2>Unprocessed</h2>

            <span className="fm-inbox-count">{items.length}</span>
          </div>

          <div className="fm-inbox-list-tools">
            {showSearch ? (
              <div className="fm-inbox-search-wrap">
                <Icon name="search" size={16} />

                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search Inbox..."
                  aria-label="Search Inbox"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      clearSearch();
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Close search"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="fm-inbox-search-toggle"
                onClick={() => setShowSearch(true)}
                aria-label="Search Inbox"
                title="Search Inbox"
              >
                <Icon name="search" size={18} />
              </button>
            )}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="fm-inbox-empty">
            <div className="fm-inbox-empty-symbol">
              {items.length === 0 ? (
                <Icon name="inbox" size={25} />
              ) : (
                <Icon name="search" size={25} />
              )}
            </div>

            <h3>{items.length === 0 ? "All clear." : "No matching items."}</h3>

            <p>
              {items.length === 0
                ? "Your Inbox is clear. Capture a thought whenever you're ready."
                : "Try a different search to find what you're looking for."}
            </p>
          </div>
        ) : (
          <div className="fm-inbox-list">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className={`fm-inbox-item ${
                  editingId === item.id ? "is-editing" : ""
                }`}
              >
                {editingId === item.id ? (
                  <div className="fm-inbox-edit">
                    <label
                      className="fm-inbox-sr-only"
                      htmlFor={`fm-inbox-edit-${item.id}`}
                    >
                      Edit Inbox item
                    </label>

                    <textarea
                      ref={editRef}
                      id={`fm-inbox-edit-${item.id}`}
                      rows={3}
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          (event.ctrlKey || event.metaKey)
                        ) {
                          event.preventDefault();
                          saveEdit();
                        }

                        if (event.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                    />

                    <div className="fm-inbox-edit-footer">
                      <span>Ctrl + Enter to save</span>

                      <div className="fm-inbox-edit-actions">
                        <button
                          type="button"
                          className="fm-inbox-button-ghost"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="fm-inbox-button-dark"
                          onClick={saveEdit}
                        >
                          Save changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="fm-inbox-item-main">
                      <span className="fm-inbox-item-symbol" aria-hidden="true">
                        <Icon name="inbox" size={17} />
                      </span>

                      <div className="fm-inbox-item-info">
                        <h3>{item.text}</h3>

                        <time dateTime={item.createdAt}>
                          {formatCreatedAt(item.createdAt)}
                        </time>
                      </div>
                    </div>

                    <div className="fm-inbox-item-actions">
                      <button
                        type="button"
                        className="fm-inbox-organize"
                        onClick={() => onOrganize(item)}
                        title="Convert to task"
                      >
                        Create Task
                        <Icon name="arrow" size={15} />
                      </button>

                      <button
                        type="button"
                        className="fm-inbox-icon-button"
                        onClick={() => startEditing(item)}
                        aria-label={`Edit ${item.text}`}
                        title="Edit item"
                      >
                        <Icon name="edit" size={16} />
                      </button>

                      <button
                        type="button"
                        className="fm-inbox-icon-button fm-inbox-delete"
                        onClick={() => deleteItem(item)}
                        aria-label={`Delete ${item.text}`}
                        title="Delete item"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Inbox;
