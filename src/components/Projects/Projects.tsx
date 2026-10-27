import type { FormEvent } from "react";

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
  return (
    <div className="fm-projects">
      <header className="fm-projects-header">
        <p className="fm-projects-subtitle">ORGANIZE YOUR WORK</p>

        <h1>Projects 📁</h1>

        <p className="fm-projects-description">
          Group related tasks and track your progress.
        </p>
      </header>

      <section className="fm-projects-panel">
        <h2>{form.editingId ? "Edit Project" : "Create New Project"}</h2>

        <form className="fm-projects-form" onSubmit={onSubmit}>
          <div className="fm-projects-field">
            <label htmlFor="fm-project-name">Project Name</label>

            <input
              id="fm-project-name"
              type="text"
              placeholder="e.g. University"
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
              Description (Optional)
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

          <div className="fm-projects-field">
            <span className="fm-projects-label">Project Color</span>

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
                  className={`fm-projects-color ${
                    form.color === color ? "selected" : ""
                  }`}
                  style={{
                    backgroundColor: color,
                  }}
                  onClick={() => onFormChange({ color })}
                />
              ))}
            </div>
          </div>

          <div className="fm-projects-form-actions">
            <button className="fm-projects-primary-button" type="submit">
              {form.editingId ? "Save Project" : "+ Create Project"}
            </button>

            {form.editingId && (
              <button
                type="button"
                className="fm-projects-secondary-button"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <div className="fm-projects-section-heading">
        <h2>Your Projects ({projects.length})</h2>
      </div>

      {projects.length === 0 ? (
        <div className="fm-projects-panel fm-projects-empty">
          <div>📁</div>
          <h3>No projects yet</h3>
          <p>Create your first project above.</p>
        </div>
      ) : (
        <div className="fm-projects-grid">
          {projects.map((project) => {
            const projectTasks = tasks.filter(
              (task) => task.projectId === project.id,
            );

            const completed = projectTasks.filter(
              (task) => task.status === "completed",
            ).length;

            const progress = projectTasks.length
              ? Math.round((completed / projectTasks.length) * 100)
              : 0;

            return (
              <article className="fm-projects-card" key={project.id}>
                <div className="fm-projects-card-heading">
                  <span
                    className="fm-projects-dot"
                    style={{
                      backgroundColor: project.color,
                    }}
                  />

                  <h3>{project.name}</h3>
                </div>

                <p className="fm-projects-card-description">
                  {project.description || "No description"}
                </p>

                <div className="fm-projects-progress-label">
                  <span>
                    {completed}/{projectTasks.length} tasks completed
                  </span>

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

                <div className="fm-projects-card-actions">
                  <button
                    type="button"
                    className="fm-projects-secondary-button"
                    onClick={() => onOpenTasks(project.id)}
                  >
                    View Tasks
                  </button>

                  <button
                    type="button"
                    className="fm-projects-icon-button fm-projects-edit-button"
                    title="Edit project"
                    aria-label={`Edit ${project.name}`}
                    onClick={() => onEdit(project)}
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    className="fm-projects-icon-button fm-projects-delete-button"
                    title="Delete project"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => onDelete(project)}
                  >
                    🗑️
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Projects;
