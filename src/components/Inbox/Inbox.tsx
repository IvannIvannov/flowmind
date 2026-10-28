import { useState } from "react";

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

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Inbox({ onOrganize }: InboxProps) {
  const [items, setItems] = useState<InboxItem[]>(loadInbox);

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editingText, setEditingText] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      return;
    }

    if (!commit([...newItems, ...items])) {
      return;
    }

    setInput("");
    setMessage(`${newItems.length} item(s) added to Inbox.`);
  }

  function startEditing(item: InboxItem) {
    setEditingId(item.id);
    setEditingText(item.text);
    setMessage("");
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

    if (commit(items.filter((entry) => entry.id !== item.id))) {
      if (editingId === item.id) {
        cancelEdit();
      }

      setMessage("Item deleted.");
    }
  }

  return (
    <div className="fm-inbox">
      <header className="fm-inbox-header">
        <p className="fm-inbox-eyebrow">CAPTURE FIRST, ORGANIZE LATER</p>

        <h1>My Inbox 📥</h1>

        <p>
          Save your thoughts and tasks in seconds. Organize them whenever you're
          ready.
        </p>
      </header>

      <section className="fm-inbox-panel">
        <div className="fm-inbox-section-heading">
          <div>
            <h2>Quick Capture ✨</h2>
            <p>One item per line. No project or deadline needed yet.</p>
          </div>
        </div>

        <label className="fm-inbox-label" htmlFor="fm-inbox-input">
          What's on your mind?
        </label>

        <textarea
          id="fm-inbox-input"
          className="fm-inbox-textarea"
          rows={6}
          placeholder={
            "Prepare client proposal\n" +
            "Check the latest footage\n" +
            "Plan next week's content"
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />

        <div className="fm-inbox-capture-footer">
          <span>
            {input.split(/\r?\n/).filter((line) => line.trim()).length} item(s)
            ready
          </span>

          <button type="button" className="fm-inbox-primary" onClick={addItems}>
            + Add to Inbox
          </button>
        </div>
      </section>

      {error && (
        <div className="fm-inbox-error" role="alert">
          {error}
        </div>
      )}

      {message && !error && (
        <div className="fm-inbox-success" role="status">
          ✓ {message}
        </div>
      )}

      <section className="fm-inbox-panel">
        <div className="fm-inbox-section-heading">
          <div>
            <h2>Your Inbox ({items.length})</h2>
            <p>Review and turn your notes into tasks.</p>
          </div>

          <span className="fm-inbox-count">{items.length} captured</span>
        </div>

        <input
          type="search"
          className="fm-inbox-search"
          aria-label="Search Inbox"
          placeholder="Search Inbox..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {visibleItems.length === 0 ? (
          <div className="fm-inbox-empty">
            <span>📥</span>

            <h3>
              {items.length === 0 ? "Your Inbox is empty" : "No matching items"}
            </h3>

            <p>
              {items.length === 0
                ? "Capture your first thought above."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className="fm-inbox-list">
            {visibleItems.map((item) => (
              <article key={item.id} className="fm-inbox-item">
                {editingId === item.id ? (
                  <div className="fm-inbox-edit">
                    <textarea
                      aria-label="Edit Inbox item"
                      rows={3}
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                    />

                    <div className="fm-inbox-item-actions">
                      <button
                        type="button"
                        className="fm-inbox-primary"
                        onClick={saveEdit}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        className="fm-inbox-secondary"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="fm-inbox-item-main">
                      <span className="fm-inbox-item-icon">📝</span>

                      <div className="fm-inbox-item-info">
                        <h3>{item.text}</h3>

                        <span>{formatCreatedAt(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="fm-inbox-item-actions">
                      <button
                        type="button"
                        className="fm-inbox-primary"
                        onClick={() => onOrganize(item)}
                      >
                        Create Task
                      </button>

                      <button
                        type="button"
                        className="fm-inbox-secondary"
                        onClick={() => startEditing(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="fm-inbox-delete"
                        onClick={() => deleteItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Inbox;
