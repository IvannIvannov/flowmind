import { supabase } from "../lib/supabase";
import type { InboxItem } from "../utils/inboxStorage";

interface InboxRow {
  id: string;
  text: string;
  created_at: string;
}

function mapItem(row: InboxRow): InboxItem {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
  };
}

async function verifyUser(userId: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  if (!user || user.id !== userId) {
    throw new Error("Your account has changed. Sign in again.");
  }
}

export async function loadCloudInbox(userId: string): Promise<InboxItem[]> {
  await verifyUser(userId);

  const all: InboxRow[] = [];
  let offset = 0;
  const size = 500;

  for (;;) {
    const { data, error } = await supabase
      .from("fm_inbox")
      .select("id,text,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + size - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as InboxRow[];

    all.push(...page);

    if (page.length < size) break;

    offset += page.length;
  }

  return all.map(mapItem);
}

export async function createCloudInboxItems(
  userId: string,
  texts: string[],
): Promise<void> {
  await verifyUser(userId);

  const clean = texts.map((text) => text.trim()).filter(Boolean);

  if (!clean.length) {
    throw new Error("Write at least one item.");
  }

  const { error } = await supabase.from("fm_inbox").insert(
    clean.map((text) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      text,
    })),
  );

  if (error) throw new Error(error.message);
}

export async function updateCloudInboxItem(
  userId: string,
  id: string,
  text: string,
): Promise<void> {
  await verifyUser(userId);

  const clean = text.trim();

  if (!clean) {
    throw new Error("Inbox item cannot be empty.");
  }

  const { data, error } = await supabase
    .from("fm_inbox")
    .update({ text: clean })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) throw new Error(error.message);

  if (!data?.length) {
    throw new Error("Inbox item not found or access denied.");
  }
}

export async function deleteCloudInboxItem(
  userId: string,
  id: string,
): Promise<void> {
  await verifyUser(userId);

  const { data, error } = await supabase
    .from("fm_inbox")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) throw new Error(error.message);

  if (!data?.length) {
    throw new Error("Inbox item not found or access denied.");
  }
}
