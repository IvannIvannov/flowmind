import { useEffect, useRef, useState } from "react";

import type { Project, Task } from "../../types";

import type { InboxItem } from "../../utils/inboxStorage";

import { INBOX_UPDATED_EVENT, loadInbox } from "../../utils/inboxStorage";

import "./GlobalSearch.css";

interface GlobalSearchProps {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onOpenProject: (id: string) => void;
  onOpenInbox: () => void;
}

type SearchResult =
  | {
      type: "task";
      id: string;
      task: Task;
    }
  | {
      type: "project";
      id: string;
      project: Project;
    }
  | {
      type: "inbox";
      id: string;
      item: InboxItem;
    };

const MAX_RESULTS = 30;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("bg-BG");
}

function GlobalSearch({
  tasks,
  projects,
  onOpenTask,
  onOpenProject,
  onOpenInbox,
}: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inbox, setInbox] = useState<InboxItem[]>(loadInbox);

  const [activeIndex, setActiveIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const previousFocusRef = useRef<HTMLElement | null>(null);

  const searchTerm = normalize(query);

  const results: SearchResult[] = [];

  if (searchTerm) {
    for (const task of tasks) {
      const project = projects.find((item) => item.id === task.projectId);

      if (
        normalize(task.title).includes(searchTerm) ||
        normalize(project?.name ?? "").includes(searchTerm)
      ) {
        results.push({
          type: "task",
          id: task.id,
          task,
        });
      }
    }

    for (const project of projects) {
      const names = [project.name, ...(project.aliases ?? [])];

      if (
        names.some((name) => normalize(name).includes(searchTerm)) ||
        normalize(project.description).includes(searchTerm)
      ) {
        results.push({
          type: "project",
          id: project.id,
          project,
        });
      }
    }

    for (const item of inbox) {
      if (normalize(item.text).includes(searchTerm)) {
        results.push({
          type: "inbox",
          id: item.id,
          item,
        });
      }
    }
  }

  const visibleResults = results.slice(0, MAX_RESULTS);

  function openSearch() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setInbox(loadInbox());
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);

    window.requestAnimationFrame(() => {
      (previousFocusRef.current ?? triggerRef.current)?.focus();
    });
  }

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);

    if (result.type === "task") {
      onOpenTask(result.task);
    } else if (result.type === "project") {
      onOpenProject(result.project.id);
    } else {
      onOpenInbox();
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const shortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "f";

      if (shortcut) {
        event.preventDefault();

        if (!event.repeat) {
          previousFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;

          setInbox(loadInbox());
          setQuery("");
          setActiveIndex(0);
          setOpen(true);
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    function refreshInbox() {
      setInbox(loadInbox());
    }

    window.addEventListener(INBOX_UPDATED_EVENT, refreshInbox);

    return () => {
      window.removeEventListener(INBOX_UPDATED_EVENT, refreshInbox);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    searchRef.current?.focus();

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }

      if (event.key === "Tab" && dialogRef.current) {
        const elements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled)",
          ),
        );

        if (elements.length === 0) {
          return;
        }

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
    }

    document.addEventListener("keydown", handleDialogKeys);

    return () => {
      document.removeEventListener("keydown", handleDialogKeys);
    };
  }, [open]);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((previous) =>
        Math.min(previous + 1, visibleResults.length - 1),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((previous) => Math.max(0, previous - 1));
    }

    if (event.key === "Enter" && visibleResults.length > 0) {
      event.preventDefault();

      const result =
        visibleResults[
          Math.max(0, Math.min(activeIndex, visibleResults.length - 1))
        ];

      selectResult(result);
    }
  }

  function projectForTask(task: Task) {
    return projects.find((project) => project.id === task.projectId);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fm-global-search-trigger"
        onClick={openSearch}
        title="Search FlowMind (Ctrl + Shift + F)"
      >
        <span aria-hidden="true">🔎</span>
        Search
      </button>

      {open && (
        <div
          className="fm-global-search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSearch();
            }
          }}
        >
          <div
            ref={dialogRef}
            className="fm-global-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fm-global-search-heading"
          >
            <div className="fm-global-search-header">
              <div>
                <p>SEARCH YOUR WORKSPACE</p>

                <h2 id="fm-global-search-heading">Global Search 🔎</h2>
              </div>

              <button
                type="button"
                className="fm-global-search-close"
                aria-label="Close search"
                onClick={closeSearch}
              >
                ✕
              </button>
            </div>

            <div className="fm-global-search-input-wrap">
              <span aria-hidden="true">🔎</span>

              <input
                ref={searchRef}
                type="search"
                aria-label="Search tasks, projects and Inbox"
                placeholder="Search tasks, projects, Inbox..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>

            <div
              className="fm-global-search-results"
              aria-label="Search results"
            >
              {!searchTerm ? (
                <div className="fm-global-search-empty">
                  <span>✨</span>

                  <h3>Find anything in FlowMind</h3>

                  <p>
                    Search task titles, project names, aliases and Inbox notes.
                  </p>
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="fm-global-search-empty">
                  <span>🔍</span>

                  <h3>No results found</h3>

                  <p>Try a different name or keyword.</p>
                </div>
              ) : (
                visibleResults.map((result, index) => {
                  let title = "";
                  let description = "";
                  let icon = "";

                  if (result.type === "task") {
                    const project = projectForTask(result.task);

                    title = result.task.title;
                    icon = "✅";

                    description = `Task · ${project?.name ?? "No Project"} · ${
                      result.task.status === "completed"
                        ? "Completed"
                        : result.task.priority + " priority"
                    }`;
                  } else if (result.type === "project") {
                    title = result.project.name;
                    description = "Project · Open project tasks";
                    icon = "📁";
                  } else {
                    title = result.item.text;
                    description = "Inbox · Captured note";
                    icon = "📥";
                  }

                  return (
                    <button
                      type="button"
                      key={`${result.type}-${result.id}`}
                      className={`fm-global-search-result ${
                        activeIndex === index ? "active" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectResult(result)}
                    >
                      <span className="fm-global-search-result-icon">
                        {icon}
                      </span>

                      <span className="fm-global-search-result-content">
                        <strong>{title}</strong>

                        <small>{description}</small>
                      </span>

                      <span
                        className="fm-global-search-result-arrow"
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="fm-global-search-footer">
              <span>↑ ↓ Navigate · Enter Open · Esc Close</span>

              {searchTerm && (
                <span>
                  {visibleResults.length}
                  {results.length > MAX_RESULTS ? "+" : ""} result(s)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;
