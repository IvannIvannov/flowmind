import type { Task } from "../types";

export type DuplicateLevel = "exact" | "similar";

export interface DuplicateCandidate {
  title: string;
  projectId?: string;
  dueDate?: string;
}

export interface DuplicateMatch {
  task: Task;
  level: DuplicateLevel;
  score: number;
}

const COMMON_WORDS = new Set([
  "да",
  "за",
  "на",
  "по",
  "с",
  "със",
  "и",
  "в",
  "във",
  "до",
  "от",
  "ще",
  "трябва",
  "трябваше",
  "необходимо",
  "е",
  "нов",
  "нова",
  "новия",
  "новият",
  "новото",
  "един",
  "една",
]);

function normalizeTitle(value: string): string {
  return value
    .toLocaleLowerCase("bg-BG")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWord(word: string): string {
  const variants: Record<string, string> = {
    монтирам: "монтаж",
    монтирай: "монтаж",
    монтиране: "монтаж",
    монтажа: "монтаж",
    монтаж: "монтаж",

    изпратя: "изпращане",
    изпрати: "изпращане",
    изпращам: "изпращане",
    изпращане: "изпращане",

    подготвя: "подготовка",
    подготви: "подготовка",
    подготвяне: "подготовка",
    подготовка: "подготовка",

    публикувам: "публикуване",
    публикувай: "публикуване",
    публикуване: "публикуване",

    рийла: "рийл",
    рийлът: "рийл",
    рийлове: "рийл",

    видеото: "видео",
    видеа: "видео",

    имейла: "имейл",
    имейли: "имейл",

    сторита: "стори",
    сторито: "стори",
  };

  return variants[word] ?? word;
}

function getWords(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !COMMON_WORDS.has(word))
    .map(normalizeWord);
}

function getSignature(title: string): string {
  return [...new Set(getWords(title))].sort().join(" ");
}

function getSimilarity(first: string, second: string): number {
  const firstWords = new Set(getWords(first));
  const secondWords = new Set(getWords(second));

  if (firstWords.size === 0 || secondWords.size === 0) {
    return 0;
  }

  const intersection = [...firstWords].filter((word) =>
    secondWords.has(word),
  ).length;

  return intersection / Math.max(firstWords.size, secondWords.size);
}

function sameProject(candidate: DuplicateCandidate, existing: Task): boolean {
  return (candidate.projectId || "") === (existing.projectId || "");
}

function compatibleDate(
  candidate: DuplicateCandidate,
  existing: Task,
): boolean {
  // Different explicit deadlines usually indicate
  // separate occurrences of a recurring task.
  if (
    candidate.dueDate &&
    existing.dueDate &&
    candidate.dueDate !== existing.dueDate
  ) {
    return false;
  }

  return true;
}

export function findTaskDuplicates(
  candidate: DuplicateCandidate,
  existingTasks: Task[],
): DuplicateMatch[] {
  const normalizedCandidate = normalizeTitle(candidate.title);

  const candidateSignature = getSignature(candidate.title);

  if (!normalizedCandidate) {
    return [];
  }

  const matches: DuplicateMatch[] = [];

  for (const task of existingTasks) {
    if (task.status === "completed") {
      continue;
    }

    if (!sameProject(candidate, task)) {
      continue;
    }

    if (!compatibleDate(candidate, task)) {
      continue;
    }

    const normalizedExisting = normalizeTitle(task.title);

    const existingSignature = getSignature(task.title);

    const isExact =
      normalizedCandidate === normalizedExisting ||
      (candidateSignature.length > 0 &&
        candidateSignature === existingSignature);

    if (isExact) {
      matches.push({
        task,
        level: "exact",
        score: 1,
      });

      continue;
    }

    const similarity = getSimilarity(candidate.title, task.title);

    // Avoid marking very short and generic
    // task descriptions as duplicates.
    const candidateWordCount = new Set(getWords(candidate.title)).size;

    const existingWordCount = new Set(getWords(task.title)).size;

    if (
      candidateWordCount >= 2 &&
      existingWordCount >= 2 &&
      similarity >= 0.75
    ) {
      matches.push({
        task,
        level: "similar",
        score: similarity,
      });
    }
  }

  return matches.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level === "exact" ? -1 : 1;
    }

    return b.score - a.score;
  });
}
