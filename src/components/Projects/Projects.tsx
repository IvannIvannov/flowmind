import { useEffect, useMemo, useRef, useState } from "react";

import type { FormEvent, ReactNode } from "react";

import type { Task, Project, ProjectFormState } from "../../types";

import "./Projects.css";

interface ProjectsProps {
  projects: Project[];
  tasks: Task[];
  colors: string[];
  form: ProjectFormState;
  onFormChange: (changes: Partial<ProjectFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onOpenTasks: (projectId: string) => void;
}

type IconName =
  | "plus"
  | "search"
  | "folder"
  | "arrow"
  | "edit"
  | "trash"
  | "close"
  | "check"
  | "list"
  | "layers";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),

    folder: (
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    ),

    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,

    edit: (
      <>
        <path d="M12 20h9" />
        <path d="m16 4 4 4L9 19l-5 1 1-5Z" />
      </>
    ),

    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14" />
        <path d="M10 10v6M14 10v6" />
      </>
    ),

    close: <path d="M18 6 6 18M6 6l12 12" />,

    check: <path d="m5 12 4 4 14-14" />,

    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),

    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
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

function Projects({
  projects,
  tasks,
  colors,
  form,
  onFormChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
  onOpenTasks,
}: ProjectsProps) {
  const [formOpen, setFormOpen] = useState(false);

  const [search, setSearch] = useState("");

  const [showAliases, setShowAliases] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  const editing = Boolean(form.editingId);

  useEffect(() => {
    if (editing) {
      setFormOpen(true);
    }
  }, [editing]);

  useEffect(() => {
    if (!formOpen) return;

    const frame = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      nameRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [formOpen, form.editingId]);

  const projectStats = useMemo(() => {
    const counts = new Map<
      string,
      {
        total: number;
        completed: number;
      }
    >();

    projects.forEach((project) => {
      counts.set(project.id, {
        total: 0,
        completed: 0,
      });
    });

    tasks.forEach((task) => {
      const projectId = task.projectId;

      if (!projectId) {
        return;
      }

      const current = counts.get(projectId);

      if (!current) {
        return;
      }

      current.total += 1;

      if (task.status === "completed") {
        current.completed += 1;
      }
    });

    return counts;
  }, [projects, tasks]);

  // projectId is optional, so check it before Map.has().
  const projectTasks = useMemo(() => {
    return tasks.filter((task) => {
      const projectId = task.projectId;

      return typeof projectId === "string" && projectStats.has(projectId);
    });
  }, [tasks, projectStats]);

  const totalProjectTasks = projectTasks.length;

  const completedTasks = projectTasks.filter(
    (task) => task.status === "completed",
  ).length;

  const activeTasks = totalProjectTasks - completedTasks;

  const visibleProjects = useMemo(() => {
    const query = search.toLocaleLowerCase().trim();

    if (!query) {
      return projects;
    }

    return projects.filter((project) => {
      const aliasText = Array.isArray(project.aliases)
        ? project.aliases.join(" ")
        : "";

      const haystack = [project.name, project.description, aliasText]
        .join(" ")
        .toLocaleLowerCase();

      return haystack.includes(query);
    });
  }, [projects, search]);

  function openCreateForm() {
    if (editing) {
      onCancelEdit();
    }

    setShowAliases(false);
    setFormOpen(true);
  }

  function openEditForm(project: Project) {
    onEdit(project);

    setShowAliases(
      Array.isArray(project.aliases) && project.aliases.length > 0,
    );

    setFormOpen(true);
  }

  function closeForm() {
    if (editing) {
      onCancelEdit();
    }

    setShowAliases(false);
    setFormOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit(event);

    if (!form.name.trim()) {
      return;
    }

    setFormOpen(false);
    setShowAliases(false);
  }

  function renderProject(project: Project) {
    const stats = projectStats.get(project.id) ?? {
      total: 0,
      completed: 0,
    };

    const remaining = stats.total - stats.completed;

    const progress =
      stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    const projectAliases = Array.isArray(project.aliases)
      ? project.aliases
      : [];

    const progressLabel =
      stats.total === 0
        ? "No tasks yet"
        : remaining === 0
          ? "All tasks completed"
          : `${remaining} remaining`;

    return (
      <article key={project.id} className="fm-projects-card">
        <div className="fm-projects-card-top">
          <span className="fm-projects-card-icon" aria-hidden="true">
            <span
              className="fm-projects-card-color"
              style={{
                backgroundColor: project.color,
              }}
            />

            <Icon name="folder" size={21} />
          </span>

          <div className="fm-projects-card-tools">
            <button
              type="button"
              className="fm-projects-icon-button"
              onClick={() => openEditForm(project)}
              title="Edit project"
              aria-label={`Edit ${project.name}`}
            >
              <Icon name="edit" size={16} />
            </button>

            <button
              type="button"
              className="fm-projects-icon-button fm-projects-delete-button"
              onClick={() => onDelete(project)}
              title="Delete project"
              aria-label={`Delete ${project.name}`}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>

        <div className="fm-projects-card-content">
          <h3>{project.name}</h3>

          <p className="fm-projects-card-description">
            {project.description || "Your space for related tasks and ideas."}
          </p>

          {projectAliases.length > 0 && (
            <span className="fm-projects-alias-count">
              {projectAliases.length} alternative{" "}
              {projectAliases.length === 1 ? "name" : "names"}
            </span>
          )}
        </div>

        <div className="fm-projects-card-progress">
          <div className="fm-projects-progress-heading">
            <span>Progress</span>

            <strong>{progress}%</strong>
          </div>

          <div
            className="fm-projects-progress-track"
            role="progressbar"
            aria-label={`${project.name} progress`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="fm-projects-progress-fill"
              style={{
                width: `${progress}%`,
                backgroundColor: project.color,
              }}
            />
          </div>

          <div className="fm-projects-progress-details">
            <span>
              {stats.completed} of {stats.total} tasks
            </span>

            <span>{progressLabel}</span>
          </div>
        </div>

        <button
          type="button"
          className="fm-projects-view-button"
          onClick={() => onOpenTasks(project.id)}
        >
          <span>
            <Icon name="list" size={16} />
            View tasks
          </span>

          <Icon name="arrow" size={17} />
        </button>
      </article>
    );
  }

  return (
    <main className="fm-projects">
      <header className="fm-projects-header">
        <div>
          <p className="fm-projects-subtitle">YOUR WORKSPACE</p>

          <h1>
            Projects<span>.</span>
          </h1>

          <p className="fm-projects-description">
            Keep your work organized and moving forward.
          </p>
        </div>

        <button
          type="button"
          className="fm-projects-new-button"
          onClick={openCreateForm}
        >
          <Icon name="plus" size={17} />
          New project
        </button>
      </header>

      {/* COMPACT OVERVIEW */}

      <section className="fm-projects-overview" aria-label="Projects overview">
        <div className="fm-projects-overview-item">
          <strong>{projects.length}</strong>
          <span>Total projects</span>
        </div>

        <div className="fm-projects-overview-item">
          <strong>{activeTasks}</strong>
          <span>Open tasks</span>
        </div>

        <div className="fm-projects-overview-item">
          <strong>{completedTasks}</strong>
          <span>Completed tasks</span>
        </div>
      </section>

      {/* CREATE / EDIT FORM */}

      {formOpen && (
        <section
          ref={formRef}
          className="fm-projects-form-panel"
          aria-label={editing ? "Edit project" : "Create project"}
        >
          <div className="fm-projects-form-heading">
            <div>
              <span className="fm-projects-kicker">
                {editing ? "UPDATE PROJECT" : "NEW PROJECT"}
              </span>

              <h2>{editing ? "Edit project" : "Create a project"}</h2>

              <p>Give your work a place to belong.</p>
            </div>

            <button
              type="button"
              className="fm-projects-icon-button"
              onClick={closeForm}
              aria-label="Close project form"
              title="Close"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <form className="fm-projects-form" onSubmit={handleSubmit}>
            <div className="fm-projects-field">
              <label htmlFor="fm-project-name">Project name</label>

              <input
                ref={nameRef}
                id="fm-project-name"
                type="text"
                placeholder="e.g. Content Creation"
                value={form.name}
                maxLength={80}
                required
                onChange={(event) =>
                  onFormChange({
                    name: event.target.value,
                  })
                }
              />
            </div>

            <div className="fm-projects-field">
              <label htmlFor="fm-project-description">
                Description
                <span className="fm-projects-optional">Optional</span>
              </label>

              <textarea
                id="fm-project-description"
                placeholder="What's this project about?"
                value={form.description}
                maxLength={300}
                rows={3}
                onChange={(event) =>
                  onFormChange({
                    description: event.target.value,
                  })
                }
              />
            </div>

            {/* ALTERNATIVE NAMES */}

            <div className="fm-projects-extra">
              <button
                type="button"
                className="fm-projects-extra-toggle"
                aria-expanded={showAliases}
                onClick={() => setShowAliases((value) => !value)}
              >
                <span>
                  Alternative names
                  <small>Help FlowMind AI recognize your project</small>
                </span>

                <span
                  className={`fm-projects-chevron ${
                    showAliases ? "is-open" : ""
                  }`}
                  aria-hidden="true"
                >
                  <Icon name="plus" size={17} />
                </span>
              </button>

              {showAliases && (
                <div className="fm-projects-extra-content">
                  <label
                    className="fm-projects-sr-only"
                    htmlFor="fm-project-aliases"
                  >
                    Alternative names
                  </label>

                  <textarea
                    id="fm-project-aliases"
                    placeholder="e.g. Mazu, Mazu Beach, Мазу Бийч"
                    value={form.aliases}
                    maxLength={500}
                    rows={2}
                    onChange={(event) =>
                      onFormChange({
                        aliases: event.target.value,
                      })
                    }
                  />

                  <p>
                    Separate names with commas. FlowMind AI will use them to
                    recognize the project in your notes.
                  </p>
                </div>
              )}
            </div>

            {/* PROJECT COLOR */}

            <div className="fm-projects-field">
              <span className="fm-projects-label">Project color</span>

              <div
                className="fm-projects-colors"
                role="group"
                aria-label="Project color"
              >
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Choose color ${color}`}
                    aria-pressed={form.color === color}
                    title={color}
                    className={`fm-projects-color ${
                      form.color === color ? "selected" : ""
                    }`}
                    style={{
                      backgroundColor: color,
                    }}
                    onClick={() => onFormChange({ color })}
                  >
                    {form.color === color && <Icon name="check" size={15} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="fm-projects-form-footer">
              <span>You can update this project anytime.</span>

              <div className="fm-projects-form-actions">
                <button
                  type="button"
                  className="fm-projects-secondary-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button type="submit" className="fm-projects-primary-button">
                  {editing ? "Save changes" : "Create project"}

                  <Icon name={editing ? "check" : "arrow"} size={16} />
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* PROJECT LIST */}

      <section className="fm-projects-section" aria-label="Your projects">
        <div className="fm-projects-section-heading">
          <div>
            <span className="fm-projects-kicker">ALL YOUR WORK</span>

            <h2>
              Your projects
              <span className="fm-projects-count">{projects.length}</span>
            </h2>

            <p>Open a project to see its tasks and progress.</p>
          </div>

          {projects.length > 0 && (
            <div className="fm-projects-search">
              <Icon name="search" size={17} />

              <input
                type="search"
                aria-label="Search projects"
                placeholder="Search projects..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </div>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="fm-projects-empty">
            <span className="fm-projects-empty-icon">
              <Icon name="layers" size={25} />
            </span>

            <h3>A fresh start.</h3>

            <p>Create your first project and bring your tasks together.</p>

            <button
              type="button"
              className="fm-projects-primary-button"
              onClick={openCreateForm}
            >
              <Icon name="plus" size={16} />
              Create project
            </button>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="fm-projects-empty">
            <span className="fm-projects-empty-icon">
              <Icon name="search" size={25} />
            </span>

            <h3>No matching projects.</h3>

            <p>Try another name or clear your search.</p>

            <button
              type="button"
              className="fm-projects-secondary-button"
              onClick={() => setSearch("")}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="fm-projects-grid">
            {visibleProjects.map(renderProject)}
          </div>
        )}
      </section>
    </main>
  );
}

export default Projects;
