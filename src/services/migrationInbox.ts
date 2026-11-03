import { supabase } from "../lib/supabase";

import type { InboxItem } from "../utils/inboxStorage";

import { loadCloudInbox } from "./cloudInbox";

export interface InboxImportRequest {
  userId: string;
  localAtReview: InboxItem[];
  cloudAtReview: InboxItem[];
  selectedIds: string[];
}

export interface InboxImportResult {
  created: number;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

function signature(items: InboxItem[]): string {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        text: item.text,
        createdAt: item.createdAt,
      })),
  );
}

async function assertUser(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  if (!data.user || data.user.id !== userId) {
    throw new Error("Your session has changed. Sign in again.");
  }
}

export async function importLegacyInbox(
  request: InboxImportRequest,
): Promise<InboxImportResult> {
  const { userId, localAtReview, cloudAtReview, selectedIds } = request;

  await assertUser(userId);

  if (selectedIds.length === 0) {
    throw new Error("No Inbox items selected.");
  }

  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("Duplicate selected IDs.");
  }

  const localIds = new Set<string>();
  const localTexts = new Set<string>();

  for (const item of localAtReview) {
    if (localIds.has(item.id)) {
      throw new Error("Duplicate local Inbox ID.");
    }

    localIds.add(item.id);

    if (!item.text.trim()) {
      throw new Error("An empty local Inbox item was found.");
    }
  }

  const selected: InboxItem[] = [];

  for (const id of selectedIds) {
    const item = localAtReview.find((candidate) => candidate.id === id);

    if (!item) {
      throw new Error("A selected Inbox item no longer exists.");
    }

    const textKey = normalize(item.text);

    if (localTexts.has(textKey)) {
      throw new Error(
        `Repeated selected Inbox text: "${item.text}". ` +
          "Select only one copy.",
      );
    }

    localTexts.add(textKey);
    selected.push(item);
  }

  // A recent cloud read detects changes that
  // occurred after the user reviewed the data.
  const cloudNow = await loadCloudInbox(userId);

  if (signature(cloudNow) !== signature(cloudAtReview)) {
    throw new Error(
      "Cloud Inbox changed since the review. " +
        "Refresh the comparison before importing.",
    );
  }

  const cloudIds = new Set(cloudNow.map((item) => item.id));

  const cloudTexts = new Set(cloudNow.map((item) => normalize(item.text)));

  for (const item of selected) {
    if (cloudIds.has(item.id) || cloudTexts.has(normalize(item.text))) {
      throw new Error(`Inbox item "${item.text}" may already be in cloud.`);
    }
  }

  // New UUIDs are used for Inbox items, because
  // older local IDs are not guaranteed to be UUIDs.
  const rows = selected.map((item) => {
    const originalDate = Date.parse(item.createdAt);

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      text: item.text.trim(),
      created_at: Number.isFinite(originalDate)
        ? new Date(originalDate).toISOString()
        : new Date().toISOString(),
    };
  });

  const { error } = await supabase.from("fm_inbox").insert(rows);

  if (error) {
    throw new Error(
      `${error.message}. The server may have saved ` +
        "the request despite this error. " +
        "Refresh and compare before retrying.",
    );
  }

  return { created: selected.length };
}
