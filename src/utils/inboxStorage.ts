export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
}

const INBOX_STORAGE_KEY = "flowmind-inbox-v1";

export const INBOX_UPDATED_EVENT = "flowmind-inbox-updated";

function isInboxItem(value: unknown): value is InboxItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.createdAt === "string" &&
    !Number.isNaN(Date.parse(item.createdAt))
  );
}

export function loadInbox(): InboxItem[] {
  try {
    const raw = localStorage.getItem(INBOX_STORAGE_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();

    return parsed
      .filter(isInboxItem)
      .filter((item) => {
        if (!item.text.trim() || seen.has(item.id)) {
          return false;
        }

        seen.add(item.id);
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch (error) {
    console.error("FlowMind: could not load Inbox", error);

    return [];
  }
}

export function saveInbox(items: InboxItem[]): boolean {
  try {
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(items));

    window.dispatchEvent(new Event(INBOX_UPDATED_EVENT));

    return true;
  } catch (error) {
    console.error("FlowMind: could not save Inbox", error);

    return false;
  }
}

export function removeInboxItem(id: string): boolean {
  const current = loadInbox();

  return saveInbox(current.filter((item) => item.id !== id));
}

export function createInboxItems(text: string): InboxItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const createdAt = new Date().toISOString();

  return lines.map((line) => ({
    id: crypto.randomUUID(),
    text: line,
    createdAt,
  }));
}
