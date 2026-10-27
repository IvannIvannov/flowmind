import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Priority, Project } from "../types";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL_NAME = "gemma3:1b";

export type SuggestionOrigin = "ai" | "fallback";

export interface SuggestedTask {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string;
  projectId: string;
  selected: boolean;
  sourceText: string;
  origin: SuggestionOrigin;
}

export interface ExtractionResult {
  tasks: SuggestedTask[];
  warnings: string[];
  analyzedSections: number;
}

interface SectionResult {
  tasks: SuggestedTask[];
  warnings: string[];
}

const WEEKDAYS: Record<string, number> = {
  понеделник: 1,
  вторник: 2,
  сряда: 3,
  четвъртък: 4,
  петък: 5,
  събота: 6,
  неделя: 0,
};

const MONTHS: Record<string, number> = {
  януари: 1,
  февруари: 2,
  март: 3,
  април: 4,
  май: 5,
  юни: 6,
  юли: 7,
  август: 8,
  септември: 9,
  октомври: 10,
  ноември: 11,
  декември: 12,
};

const DAY_NAMES = Object.keys(WEEKDAYS).join("|");
const MONTH_NAMES = Object.keys(MONTHS).join("|");

function normalize(value: string): string {
  return value.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  result.setDate(result.getDate() + count);
  return result;
}

function resolveDate(expression: string, today: Date): string {
  const text = normalize(expression)
    .replace(/[.!?,;]+$/g, "")
    .trim();

  if (text === "днес") return dateKey(today);

  if (text === "утре") {
    return dateKey(addDays(today, 1));
  }

  if (text === "вдругиден") {
    return dateKey(addDays(today, 2));
  }

  if (text === "до края на седмицата") {
    const offset = (7 - today.getDay()) % 7;
    return dateKey(addDays(today, offset));
  }

  if (text === "до края на месеца") {
    return dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }

  const afterDays = text.match(/^след\s+(\d{1,3})\s+дни?$/);

  if (afterDays) {
    return dateKey(addDays(today, Number(afterDays[1])));
  }

  const iso = text.match(/^(?:на\s+|до\s+)?(\d{4})-(\d{2})-(\d{2})$/);

  if (iso) {
    const result = createDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    return result ? dateKey(result) : "";
  }

  const numeric = text.match(
    /^(?:на\s+|до\s+)?(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\.?$/,
  );

  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);

    let year = numeric[3] ? Number(numeric[3]) : today.getFullYear();

    let result = createDate(year, month, day);

    if (!result) return "";

    if (!numeric[3] && dateKey(result) < dateKey(today)) {
      year += 1;
      result = createDate(year, month, day);
    }

    return result ? dateKey(result) : "";
  }

  const natural = text.match(
    /^(?:на\s+|до\s+)?(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?$/,
  );

  if (natural && MONTHS[natural[2]]) {
    const day = Number(natural[1]);
    const month = MONTHS[natural[2]];

    let year = natural[3] ? Number(natural[3]) : today.getFullYear();

    let result = createDate(year, month, day);

    if (!result) return "";

    if (!natural[3] && dateKey(result) < dateKey(today)) {
      year += 1;
      result = createDate(year, month, day);
    }

    return result ? dateKey(result) : "";
  }

  const weekdayPattern = new RegExp(
    "^(?:(другата|другия|следващата|следващия)" +
      "\\s+)?(?:(?:в|във|до)\\s+)?" +
      `(${DAY_NAMES})$`,
  );

  const weekday = text.match(weekdayPattern);

  if (weekday) {
    const target = WEEKDAYS[weekday[2]];

    if (weekday[1]) {
      const mondayOffset = (today.getDay() + 6) % 7;

      const nextMonday = addDays(today, 7 - mondayOffset);

      return dateKey(addDays(nextMonday, (target + 6) % 7));
    }

    const offset = (target - today.getDay() + 7) % 7;

    return dateKey(addDays(today, offset));
  }

  return "";
}

function findDates(section: string): string[] {
  const pattern = new RegExp(
    [
      "до края на седмицата",
      "до края на месеца",
      "вдругиден",
      "утре",
      "днес",
      "след\\s+\\d{1,3}\\s+дни?",
      "(?:на\\s+|до\\s+)?\\d{4}-\\d{2}-\\d{2}",
      "(?:на\\s+|до\\s+)?\\d{1,2}\\.\\d{1,2}(?:\\.\\d{4})?",
      `(?:на\\s+|до\\s+)?\\d{1,2}\\s+(?:${MONTH_NAMES})(?:\\s+\\d{4})?`,
      `(?:(?:другата|другия|следващата|следващия)\\s+)?(?:(?:в|във|до)\\s+)?(?:${DAY_NAMES})`,
    ].join("|"),
    "giu",
  );

  return Array.from(section.matchAll(pattern), (match) => match[0].trim());
}

function getDeadline(
  section: string,
  today: Date,
): { date: string; warning: string } {
  const dates = findDates(section)
    .map((expression) => resolveDate(expression, today))
    .filter(Boolean);

  const uniqueDates = [...new Set(dates)];

  if (uniqueDates.length === 0) {
    return { date: "", warning: "" };
  }

  if (uniqueDates.length === 1) {
    return { date: uniqueDates[0], warning: "" };
  }

  return {
    date: "",
    warning:
      `Multiple dates found in "${section}". ` +
      "Please set the deadline manually.",
  };
}

function getPriority(section: string): Priority {
  const text = normalize(section);

  if (/без\s+бързане|не\s+е\s+спешно/u.test(text)) {
    return "low";
  }

  if (/спешно|неотложно|приоритетно/u.test(text)) {
    return "high";
  }

  return "medium";
}

function findProject(value: unknown, projects: Project[]): string {
  if (typeof value !== "string") return "";

  const name = normalize(value);

  const project = projects.find((item) => normalize(item.name) === name);

  return project?.id ?? "";
}

function guessProject(section: string, projects: Project[]): string {
  const source = normalize(section);

  const matched = projects.filter(
    (project) =>
      project.name.trim() && source.includes(normalize(project.name)),
  );

  return matched.length === 1 ? matched[0].id : "";
}

function splitNote(note: string): string[] {
  return note
    .replace(/\r\n/g, "\n")
    .split(/\n+|[;!?]\s*|(?<!\d)\.(?=\s+[А-ЯA-Z]|\s*$)/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isClearlyPastInformation(section: string): boolean {
  const text = normalize(section);

  const pastStart =
    /^(?:(?:днес|вчера)\s+)?(?:проведохме|обсъдихме|приключихме|завършихме|получихме)(?:\s|$)/u;

  const pending =
    /трябва|предстои|необходимо|да\s+(?:изпратя|направя|подготвя|монтирам|проверя|организирам)/u;

  return pastStart.test(text) && !pending.test(text);
}

function looksLikePendingAction(section: string): boolean {
  const text = normalize(section);

  return (
    /трябва\s+да|необходимо\s+е\s+да|предстои\s+да/u.test(text) ||
    /(?:^|\s)да\s+(?:изпратя|пратя|подготвя|монтирам|проверя|организирам|направя|създам|публикувам|снимам|обработя|редактирам|кача)(?:\s|$)/u.test(
      text,
    ) ||
    /^(?:изпрати|подготви|монтирай|провери|организирай|направи|създай|публикувай|снимай)(?:\s|$)/u.test(
      text,
    )
  );
}

function fallbackTitle(section: string): string {
  let title = section.trim();

  for (const expression of findDates(title)) {
    title = title.replace(expression, " ");
  }

  title = title
    .replace(/трябва\s+да\s+/iu, "")
    .replace(/необходимо\s+е\s+да\s+/iu, "")
    .replace(/предстои\s+да\s+/iu, "")
    .replace(/^\s*да\s+/iu, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\s]+|[,;:\s.]+$/g, "")
    .trim();

  if (!title) title = section.trim();

  return (title.charAt(0).toLocaleUpperCase("bg-BG") + title.slice(1)).slice(
    0,
    200,
  );
}

function makeSuggestion(
  title: string,
  section: string,
  projects: Project[],
  today: Date,
  proposedProject: unknown,
  origin: SuggestionOrigin,
): {
  task: SuggestedTask;
  warning: string;
} {
  const deadline = getDeadline(section, today);

  return {
    task: {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 200),
      priority: getPriority(section),
      dueDate: deadline.date,
      projectId:
        findProject(proposedProject, projects) ||
        guessProject(section, projects),
      selected: true,
      sourceText: section,
      origin,
    },
    warning: deadline.warning,
  };
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
          projectName: { type: "string" },
        },
        required: ["title", "projectName"],
      },
    },
  },
  required: ["tasks"],
};

function buildPrompt(section: string, projects: Project[]): string {
  return `
Extract pending tasks from Bulgarian notes.

AVAILABLE PROJECTS:
${JSON.stringify(projects.map((p) => p.name))}

Return JSON:
{"tasks":[{"title":"...","projectName":""}]}

RULES:
- Include actions that still need to be done.
- Exclude meetings or events that already happened.
- Keep all explicit pending actions.
- Short Bulgarian task titles.
- No invented actions or subtasks.
- Use an available project name only if certain.
- Otherwise set projectName to "".
- If no pending actions, return {"tasks":[]}.

EXAMPLES:
INPUT: До петък трябва да изпратя имейл.
OUTPUT: {"tasks":[{"title":"Изпрати имейл","projectName":""}]}

INPUT: Днес проведохме среща.
OUTPUT: {"tasks":[]}

INPUT:
${section}

OUTPUT:
`.trim();
}

async function analyzeSection(
  section: string,
  projects: Project[],
  today: Date,
): Promise<SectionResult> {
  if (isClearlyPastInformation(section)) {
    return { tasks: [], warnings: [] };
  }

  const tasks: SuggestedTask[] = [];
  const warnings: string[] = [];

  let modelTasks: unknown[] = [];
  let aiFailed = false;

  try {
    const response = await tauriFetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: buildPrompt(section, projects),
        format: RESPONSE_SCHEMA,
        stream: false,
        keep_alive: "20m",
        options: {
          temperature: 0,
          num_predict: 350,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    if (!isRecord(data) || typeof data.response !== "string") {
      throw new Error("Unexpected Ollama response");
    }

    const parsed: unknown = JSON.parse(data.response);

    if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) {
      throw new Error("Invalid AI task list");
    }

    modelTasks = parsed.tasks;
  } catch (error) {
    console.error("Ollama section error:", error);
    aiFailed = true;
  }

  for (const item of modelTasks) {
    if (
      !isRecord(item) ||
      typeof item.title !== "string" ||
      !item.title.trim()
    ) {
      continue;
    }

    const result = makeSuggestion(
      item.title,
      section,
      projects,
      today,
      item.projectName,
      "ai",
    );

    tasks.push(result.task);

    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  if (tasks.length === 0 && looksLikePendingAction(section)) {
    const result = makeSuggestion(
      fallbackTitle(section),
      section,
      projects,
      today,
      "",
      "fallback",
    );

    tasks.push(result.task);

    warnings.push(
      `Fallback suggestion created from: "${section}". ` +
        "Review its title and deadline.",
    );

    if (result.warning) {
      warnings.push(result.warning);
    }
  } else if (tasks.length === 0 && aiFailed) {
    warnings.push(`Could not analyze this section: "${section}".`);
  }

  return { tasks, warnings };
}

export async function extractTasksWithOllama(
  input: string,
  projects: Project[],
): Promise<ExtractionResult> {
  const note = input.trim();

  if (!note) {
    throw new Error("Please enter a note first.");
  }

  const sections = splitNote(note);

  if (sections.length === 0) {
    throw new Error("No note sections found.");
  }

  if (sections.length > 25) {
    throw new Error("Please analyze up to 25 sections at a time.");
  }

  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const results: SectionResult[] = [];

  for (const section of sections) {
    const result = await analyzeSection(section, projects, today);

    results.push(result);
  }

  return {
    tasks: results.flatMap((result) => result.tasks),
    warnings: results.flatMap((result) => result.warnings),
    analyzedSections: sections.length,
  };
}
