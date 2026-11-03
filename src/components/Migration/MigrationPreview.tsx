import { useState } from "react";

import { previewLocalMigration } from "../../services/localMigrationPreview";

import type { LocalMigrationPreview } from "../../services/localMigrationPreview";

interface MigrationPreviewProps {
  userId: string;
  onClose: () => void;
}

function summary(preview: LocalMigrationPreview) {
  return [
    {
      name: "Tasks",
      category: preview.tasks,
      examples: preview.tasks.items.map((item) => item.title),
    },
    {
      name: "Projects",
      category: preview.projects,
      examples: preview.projects.items.map((item) => item.name),
    },
    {
      name: "Inbox",
      category: preview.inbox,
      examples: preview.inbox.items.map((item) => item.text),
    },
    {
      name: "Focus History",
      category: preview.focusHistory,
      examples: preview.focusHistory.items.map((item) => item.taskTitle),
    },
  ];
}

export default function MigrationPreview({
  userId,
  onClose,
}: MigrationPreviewProps) {
  const [preview, setPreview] = useState<LocalMigrationPreview>(() =>
    previewLocalMigration(),
  );

  const groups = summary(preview);

  const total = groups.reduce((sum, group) => sum + group.category.total, 0);

  const valid = groups.reduce((sum, group) => sum + group.category.valid, 0);

  const invalid = groups.reduce(
    (sum, group) => sum + group.category.invalid,
    0,
  );

  const duplicates = groups.reduce(
    (sum, group) => sum + group.category.duplicateIds,
    0,
  );

  return (
    <section
      aria-label="Local data migration preview"
      style={{
        border: "1px solid var(--fm-border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        background: "var(--fm-surface)",
        color: "var(--fm-text)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            DATA SAFETY
          </p>

          <h2 style={{ marginBottom: 8 }}>Local Data Migration</h2>

          <p style={{ opacity: 0.7 }}>
            Review the information saved on this device before importing it.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close migration preview"
          style={{
            border: "1px solid var(--fm-border)",
            borderRadius: 8,
            padding: "8px 12px",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </header>

      <div
        style={{
          padding: 14,
          border: "1px solid var(--fm-border)",
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <strong>Destination account</strong>

        <p
          style={{
            overflowWrap: "anywhere",
            fontSize: 12,
            opacity: 0.75,
          }}
        >
          {userId}
        </p>

        <p style={{ fontSize: 12 }}>
          This is the signed-in account. No data will be imported during this
          preview.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
          gap: 12,
          marginBottom: 22,
        }}
      >
        {[
          ["Found", total],
          ["Valid", valid],
          ["Invalid", invalid],
          ["Duplicate IDs", duplicates],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: 14,
              border: "1px solid var(--fm-border)",
              borderRadius: 10,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: 12,
                opacity: 0.65,
              }}
            >
              {label}
            </span>

            <strong
              style={{
                display: "block",
                marginTop: 8,
                fontSize: 24,
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>

      {preview.hasReadErrors && (
        <p role="alert">
          Some local data could not be read. Import should not proceed until
          these issues are reviewed.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {groups.map((group) => (
          <section
            key={group.name}
            style={{
              border: "1px solid var(--fm-border)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>{group.name}</h3>

              <strong>{group.category.valid} valid</strong>
            </div>

            <p
              style={{
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              {group.category.total} found · {group.category.invalid} invalid ·{" "}
              {group.category.duplicateIds} duplicate IDs
            </p>

            {group.category.readError && (
              <p role="alert">{group.category.readError}</p>
            )}

            {group.examples.length > 0 ? (
              <>
                <p style={{ fontSize: 12 }}>Preview of the first records:</p>

                <ul>
                  {group.examples.slice(0, 5).map((example, index) => (
                    <li key={index}>{example || "(Untitled)"}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p style={{ opacity: 0.65 }}>No valid local records found.</p>
            )}
          </section>
        ))}
      </div>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 24,
        }}
      >
        <p
          style={{
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          Read-only preview. Your local and cloud data remain unchanged.
        </p>

        <button
          type="button"
          onClick={() => {
            setPreview(previewLocalMigration());
          }}
          style={{
            padding: "10px 16px",
            border: "1px solid var(--fm-border)",
            borderRadius: 9,
            background: "var(--fm-surface)",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Refresh preview
        </button>
      </footer>
    </section>
  );
}
