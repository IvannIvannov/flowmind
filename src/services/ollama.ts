import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Priority, Project } from "../types";
import { getTodayKey, parseDateKey } from "../utils/dates";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL_NAME = "gemma3:1b";

export interface SuggestedTask {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string;
  projectId: string;
  selected: boolean;
}

interface OllamaGenerateResponse {
  response: string;
}

interface RawTask {
  title?: unknown;
  dueDate?: unknown;
  priority?: unknown;
  projectName?: unknown;
}

interface RawExtraction {
  tasks?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nextWeekday(dayIndex: number): string {
  const current = new Date();
  let difference = (dayIndex - current.getDay() + 7) % 7;

  if (difference === 0) difference = 7;

  current.setDate(current.getDate() + difference);

  return [
    current.getFullYear(),
    String(current.getMonth() + 1).padStart(2, "0"),
    String(current.getDate()).padStart(2, "0"),
  ].join("-");
}

function tomorrowKey(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizePriority(value: unknown): Priority {
  if (value === "high" || value === "low") return value;
  return "medium";
}

function normalizeDueDate(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!trimmed) return "";
  if (!parseDateKey(trimmed)) return "";

  return trimmed;
}

function findProjectId(name: unknown, projects: Project[]): string {
  if (typeof name !== "string" || !name.trim()) {
    return "";
  }

  const normalized = name.trim().toLocaleLowerCase("bg-BG");

  const exact = projects.find(
    (project) => project.name.trim().toLocaleLowerCase("bg-BG") === normalized,
  );

  return exact?.id ?? "";
}

function buildPrompt(input: string, projects: Project[]): string {
  const projectNames = projects.map((project) => project.name);

  return `
You extract tasks from Bulgarian notes for a task manager.

TODAY: ${getTodayKey()}
TOMORROW: ${tomorrowKey()}

NEXT UPCOMING WEEKDAYS:
Monday: ${nextWeekday(1)}
Tuesday: ${nextWeekday(2)}
Wednesday: ${nextWeekday(3)}
Thursday: ${nextWeekday(4)}
Friday: ${nextWeekday(5)}
Saturday: ${nextWeekday(6)}
Sunday: ${nextWeekday(0)}

AVAILABLE PROJECTS:
${JSON.stringify(projectNames)}

STRICT RULES:
- Return exactly one task per explicitly requested action.
- Keep all tasks. Do not invent subtasks.
- Write short, natural Bulgarian task titles.
- Assign each date only to the action it describes.
- "утре" means TOMORROW.
- "в петък" means the next upcoming Friday.
- "в понеделник" means the next upcoming Monday.
- An explicit YYYY-MM-DD date takes priority.
- If a deadline is unclear or absent, use an empty string.
- Priority must be low, medium, or high.
- Use medium unless importance is clearly indicated.
- projectName must match an available project exactly,
  or be an empty string if uncertain.
- Return only valid JSON. No explanations.

USER NOTE:
${input}
`.trim();
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          dueDate: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          projectName: { type: "string" },
        },
        required: ["title", "dueDate", "priority", "projectName"],
      },
    },
  },
  required: ["tasks"],
};

export async function extractTasksWithOllama(
  input: string,
  projects: Project[],
): Promise<SuggestedTask[]> {
  const prompt = input.trim();

  if (!prompt) {
    throw new Error("Please enter a note first.");
  }

  let response: Response;

  try {
    response = await tauriFetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: buildPrompt(prompt, projects),
        format: RESPONSE_SCHEMA,
        stream: false,
        keep_alive: "20m",
        options: {
          temperature: 0,
          num_predict: 750,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    console.error("Ollama connection error:", error);

    throw new Error(
      "Cannot connect to Ollama. Make sure Ollama is running and gemma3:1b is installed.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}. Check that gemma3:1b is available.`,
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error("Ollama returned an invalid HTTP response.");
  }

  if (!isRecord(data) || typeof data.response !== "string") {
    throw new Error("Unexpected response format from Ollama.");
  }

  const generated = data as unknown as OllamaGenerateResponse;

  let parsed: RawExtraction;

  try {
    parsed = JSON.parse(generated.response) as RawExtraction;
  } catch {
    throw new Error("The AI response was not valid JSON. Please try again.");
  }

  if (!parsed || !Array.isArray(parsed.tasks)) {
    throw new Error("The AI did not return a task list.");
  }

  const suggestions: SuggestedTask[] = [];

  for (const item of parsed.tasks) {
    if (!isRecord(item)) continue;

    const raw = item as RawTask;

    if (typeof raw.title !== "string" || !raw.title.trim()) {
      continue;
    }

    suggestions.push({
      id: crypto.randomUUID(),
      title: raw.title.trim().slice(0, 200),
      priority: normalizePriority(raw.priority),
      dueDate: normalizeDueDate(raw.dueDate),
      projectId: findProjectId(raw.projectName, projects),
      selected: true,
    });
  }

  if (suggestions.length === 0) {
    throw new Error(
      "No tasks were recognized. Try describing your actions more clearly.",
    );
  }

  return suggestions;
}
