import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import Calendar from "./components/Calendar/Calendar";
import Dashboard from "./components/Dashboard/Dashboard";
import Projects from "./components/Projects/Projects";
import Sidebar from "./components/Sidebar/Sidebar";
import Tasks from "./components/Tasks/Tasks";

import type {
  Page,
  Priority,
  Task,
  TaskStatus,
  TaskFormState,
  TaskFilters,
  Project,
  ProjectFormState,
} from "./types";

import {
  loadTasks,
  loadProjects,
  saveTasks,
  saveProjects,
} from "./utils/storage";

import "./App.css";

const COLORS = [
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#f472b6",
];

const PRIORITY_VALUE: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const INITIAL_TASK_FORM: TaskFormState = {
  title: "",
  priority: "medium",
  dueDate: "",
  projectId: "",
  editingId: null,
};

const INITIAL_FILTERS: TaskFilters = {
  search: "",
  status: "all",
  project: "all",
  sort: "newest",
};

const INITIAL_PROJECT_FORM: ProjectFormState = {
  name: "",
  description: "",
  color: COLORS[0],
  editingId: null,
};

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const [tasks, setTasks] = useState<Task[]>(loadTasks);

  const [projects, setProjects] = useState<Project[]>(loadProjects);

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);

  const [taskFilters, setTaskFilters] = useState<TaskFilters>(INITIAL_FILTERS);

  const [projectForm, setProjectForm] =
    useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  // SAVE DATA

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  // TASK FILTERING AND SORTING

  const visibleTasks = useMemo(() => {
    const { search, status, project, sort } = taskFilters;

    return tasks
      .filter((task) => {
        const matchesSearch = task.title
          .toLowerCase()
          .includes(search.toLowerCase().trim());

        const matchesStatus = status === "all" || task.status === status;

        const matchesProject =
          project === "all" ||
          (project === "none"
            ? !task.projectId ||
              !projects.some((item) => item.id === task.projectId)
            : task.projectId === project);

        return matchesSearch && matchesStatus && matchesProject;
      })
      .sort((a, b) => {
        if (sort === "priority") {
          const difference =
            PRIORITY_VALUE[b.priority] - PRIORITY_VALUE[a.priority];

          if (difference !== 0) {
            return difference;
          }
        }

        if (sort === "due-date") {
          return (a.dueDate || "9999-12-31").localeCompare(
            b.dueDate || "9999-12-31",
          );
        }

        if (sort === "oldest") {
          return a.createdAt.localeCompare(b.createdAt);
        }

        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tasks, projects, taskFilters]);

  // TASK FORM

  function updateTaskForm(changes: Partial<TaskFormState>) {
    setTaskForm((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function updateTaskFilters(changes: Partial<TaskFilters>) {
    setTaskFilters((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function resetTaskForm() {
    setTaskForm({ ...INITIAL_TASK_FORM });
  }

  // CREATE AND EDIT TASKS

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = taskForm.title.trim();

    if (!name) return;

    const projectId = projects.some(
      (project) => project.id === taskForm.projectId,
    )
      ? taskForm.projectId
      : undefined;

    if (taskForm.editingId) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskForm.editingId
            ? {
                ...task,
                title: name,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate || undefined,
                projectId,
              }
            : task,
        ),
      );
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: name,
        priority: taskForm.priority,
        status: "todo",
        dueDate: taskForm.dueDate || undefined,
        projectId,
        createdAt: new Date().toISOString(),
      };

      setTasks((previous) => [newTask, ...previous]);
    }

    resetTaskForm();
  }

  function startEditTask(task: Task) {
    setTaskForm({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate || "",
      projectId: task.projectId || "",
      editingId: task.id,
    });

    setTaskFilters((previous) => ({
      ...previous,
      search: "",
      status: "all",
      project: "all",
    }));

    setPage("tasks");
  }

  function changeTaskStatus(id: string, status: TaskStatus) {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  function deleteTask(task: Task) {
    const confirmed = window.confirm(`Delete task "${task.title}"?`);

    if (!confirmed) return;

    setTasks((previous) => previous.filter((item) => item.id !== task.id));

    if (taskForm.editingId === task.id) {
      resetTaskForm();
    }
  }

  // PROJECT FORM

  function updateProjectForm(changes: Partial<ProjectFormState>) {
    setProjectForm((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function resetProjectForm() {
    setProjectForm({
      ...INITIAL_PROJECT_FORM,
    });
  }

  // CREATE AND EDIT PROJECTS

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = projectForm.name.trim();

    if (!name) return;

    const duplicate = projects.some(
      (project) =>
        project.name.trim().toLowerCase() === name.toLowerCase() &&
        project.id !== projectForm.editingId,
    );

    if (duplicate) {
      window.alert("A project with this name already exists.");
      return;
    }

    if (projectForm.editingId) {
      setProjects((previous) =>
        previous.map((project) =>
          project.id === projectForm.editingId
            ? {
                ...project,
                name,
                description: projectForm.description.trim(),
                color: projectForm.color,
              }
            : project,
        ),
      );
    } else {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        description: projectForm.description.trim(),
        color: projectForm.color,
        createdAt: new Date().toISOString(),
      };

      setProjects((previous) => [...previous, newProject]);
    }

    resetProjectForm();
  }

  function startEditProject(project: Project) {
    setProjectForm({
      name: project.name,
      description: project.description,
      color: project.color,
      editingId: project.id,
    });
  }

  function deleteProject(project: Project) {
    const count = tasks.filter((task) => task.projectId === project.id).length;

    const confirmed = window.confirm(
      `Delete "${project.name}"?\n\n` +
        `${count} task(s) will become unassigned. ` +
        "The tasks themselves will NOT be deleted.",
    );

    if (!confirmed) return;

    setProjects((previous) =>
      previous.filter((item) => item.id !== project.id),
    );

    setTasks((previous) =>
      previous.map((task) =>
        task.projectId === project.id
          ? {
              ...task,
              projectId: undefined,
            }
          : task,
      ),
    );

    if (taskFilters.project === project.id) {
      updateTaskFilters({
        project: "all",
      });
    }

    if (taskForm.projectId === project.id) {
      updateTaskForm({
        projectId: "",
      });
    }

    if (projectForm.editingId === project.id) {
      resetProjectForm();
    }
  }

  function openProjectTasks(id: string) {
    setTaskFilters((previous) => ({
      ...previous,
      project: id,
      status: "all",
      search: "",
    }));

    setPage("tasks");
  }

  // CALENDAR ACTIONS

  function addTaskFromCalendar(date: string) {
    setTaskForm({
      ...INITIAL_TASK_FORM,
      dueDate: date,
    });

    setTaskFilters((previous) => ({
      ...previous,
      search: "",
      status: "all",
      project: "all",
    }));

    setPage("tasks");
  }

  function openTaskFromCalendar(id: string) {
    const task = tasks.find((item) => item.id === id);

    if (task) {
      startEditTask(task);
    }
  }

  return (
    <div className="app">
      <Sidebar currentPage={page} onNavigate={setPage} />

      <main className="content">
        {page === "dashboard" && (
          <Dashboard
            tasks={tasks}
            projects={projects}
            onOpenTasks={() => setPage("tasks")}
            onOpenProjects={() => setPage("projects")}
          />
        )}

        {page === "tasks" && (
          <Tasks
            tasks={tasks}
            visibleTasks={visibleTasks}
            projects={projects}
            form={taskForm}
            filters={taskFilters}
            onFormChange={updateTaskForm}
            onFiltersChange={updateTaskFilters}
            onSubmit={submitTask}
            onCancelEdit={resetTaskForm}
            onEdit={startEditTask}
            onDelete={deleteTask}
            onStatusChange={changeTaskStatus}
          />
        )}

        {page === "projects" && (
          <Projects
            projects={projects}
            tasks={tasks}
            colors={COLORS}
            form={projectForm}
            onFormChange={updateProjectForm}
            onSubmit={submitProject}
            onCancelEdit={resetProjectForm}
            onEdit={startEditProject}
            onDelete={deleteProject}
            onOpenTasks={openProjectTasks}
          />
        )}

        {page === "calendar" && (
          <Calendar
            tasks={tasks}
            projects={projects}
            onAddTask={addTaskFromCalendar}
            onOpenTask={openTaskFromCalendar}
          />
        )}
      </main>
    </div>
  );
}

export default App;
