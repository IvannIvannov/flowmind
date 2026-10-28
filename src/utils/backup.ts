export interface FlowMindBackup {
  app: "FlowMind";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

const PREFIX = "flowmind-";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getBackupData(): Record<string, string> {
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key || !key.startsWith(PREFIX)) {
      continue;
    }

    const value = localStorage.getItem(key);

    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

export function downloadFlowMindBackup(): number {
  const data = getBackupData();

  const backup: FlowMindBackup = {
    app: "FlowMind",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `FlowMind-Backup-${date}.json`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return Object.keys(data).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBackup(value: unknown): FlowMindBackup {
  if (!isRecord(value)) {
    throw new Error("Invalid backup file.");
  }

  if (
    value.app !== "FlowMind" ||
    value.version !== 1 ||
    typeof value.exportedAt !== "string" ||
    !isRecord(value.data)
  ) {
    throw new Error("This is not a supported FlowMind backup.");
  }

  const data: Record<string, string> = {};

  for (const [key, storedValue] of Object.entries(value.data)) {
    if (!key.startsWith(PREFIX) || typeof storedValue !== "string") {
      throw new Error("Backup contains invalid storage data.");
    }

    // FlowMind application data is JSON encoded.
    try {
      JSON.parse(storedValue);
    } catch {
      throw new Error(`Invalid JSON data for ${key}.`);
    }

    data[key] = storedValue;
  }

  return {
    app: "FlowMind",
    version: 1,
    exportedAt: value.exportedAt,
    data,
  };
}

export async function readFlowMindBackup(file: File): Promise<FlowMindBackup> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Backup file exceeds the 10 MB limit.");
  }

  const content = await file.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  return validateBackup(parsed);
}

export function restoreFlowMindBackup(backup: FlowMindBackup): number {
  const validated = validateBackup(backup);

  // Save the existing data in memory so that
  // a failed write can be rolled back.
  const previous = getBackupData();

  const keysToRemove = Object.keys(previous);

  try {
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(validated.data)) {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    // Restore the previous state if any write fails.
    for (const key of Object.keys(validated.data)) {
      localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(previous)) {
      localStorage.setItem(key, value);
    }

    throw error;
  }

  return Object.keys(validated.data).length;
}
