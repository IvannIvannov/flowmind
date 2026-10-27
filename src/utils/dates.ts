/* FLOWMIND - DATE UTILITIES */

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

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

export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
): string {
  const date = parseDateKey(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

export function isToday(value?: string): boolean {
  return Boolean(value && value === getTodayKey());
}

export function isOverdue(value?: string, completed = false): boolean {
  if (!value || completed) {
    return false;
  }

  return parseDateKey(value) !== null && value < getTodayKey();
}

export function isUpcoming(value?: string): boolean {
  if (!value) {
    return false;
  }

  return parseDateKey(value) !== null && value > getTodayKey();
}

export function changeMonth(value: string, amount: number): string {
  const date = parseDateKey(value);

  if (!date) {
    return getTodayKey();
  }

  const result = new Date(date.getFullYear(), date.getMonth() + amount, 1);

  return toDateKey(result);
}

export function getMonthTitle(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}
