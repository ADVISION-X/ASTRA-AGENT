/**
 * settings.ts — Local workbench settings and user requirement history.
 *
 * Responsibilities:
 *   - App run limit settings (file I/O).
 *   - User requirement history (file I/O).
 *   - Online AI provider settings are delegated to src/lib/online-ai.
 *
 * No mission truth, no AI truth, no forensics.
 */

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

// ─── App Run Limit Settings ───────────────────────────────────────────────────

export type AppRunLimitSettings = {
  defaultMaxRounds: number;
  defaultMaxMinutes: number;
  updatedAt: string | null;
};

const APP_RUN_LIMIT_SETTINGS_PATH = ["config", "app-run-limit-settings.json"] as const;

const AppRunLimitSettingsSchema = z.object({
  defaultMaxRounds: z.number().int().positive(),
  defaultMaxMinutes: z.number().int().positive(),
  updatedAt: z.string().min(1).nullable().optional().default(null),
}).strict();

const DEFAULT_APP_RUN_LIMIT_SETTINGS: AppRunLimitSettings = {
  defaultMaxRounds: 300,
  defaultMaxMinutes: 480,
  updatedAt: null,
};

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isIgnorablePermission(error: unknown): boolean {
  return error instanceof Error && "code" in error
    && ["EPERM", "ENOTSUP", "EROFS", "EINVAL"].includes(String((error as NodeJS.ErrnoException).code ?? ""));
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

async function safeChmod(filePath: string): Promise<void> {
  try {
    await chmod(filePath, 0o600);
  } catch (error) {
    if (isIgnorablePermission(error)) return;
    throw error;
  }
}

export async function loadAppRunLimitSettings(dataDir: string): Promise<AppRunLimitSettings> {
  const filePath = join(dataDir, ...APP_RUN_LIMIT_SETTINGS_PATH);
  const raw = await safeReadFile(filePath);
  if (!raw) return DEFAULT_APP_RUN_LIMIT_SETTINGS;
  try {
    return AppRunLimitSettingsSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_RUN_LIMIT_SETTINGS;
  }
}

export async function saveAppRunLimitSettings(
  dataDir: string,
  input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
): Promise<AppRunLimitSettings> {
  const filePath = join(dataDir, ...APP_RUN_LIMIT_SETTINGS_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  const updated: AppRunLimitSettings = {
    defaultMaxRounds: input.defaultMaxRounds,
    defaultMaxMinutes: input.defaultMaxMinutes,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(filePath, JSON.stringify(updated, null, 2), "utf8");
  await safeChmod(filePath);
  return updated;
}

// ─── User Requirement History ─────────────────────────────────────────────────

export type UserRequirementHistoryPlatformId = "facebook-web" | "tiktok-web";

export type UserRequirementHistoryEntry = {
  id: string;
  title: string;
  userRequirementText: string;
  selectedPlatforms: UserRequirementHistoryPlatformId[];
  maxRounds: number;
  maxMinutes: number;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
};

export type UserRequirementHistoryUpsertInput = {
  id?: string | null;
  title?: string | null;
  userRequirementText: string;
  selectedPlatforms: UserRequirementHistoryPlatformId[];
  maxRounds: number;
  maxMinutes: number;
};

const USER_HISTORY_PATH = ["user-requirement-history.json"] as const;

const UserRequirementHistoryEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  userRequirementText: z.string().min(1),
  selectedPlatforms: z.array(z.enum(["facebook-web", "tiktok-web"])).min(1),
  maxRounds: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
  createdAt: z.string().min(1),
  lastUsedAt: z.string().min(1),
  useCount: z.number().int().nonnegative(),
}).strict();

const UserRequirementHistoryFileSchema = z.array(UserRequirementHistoryEntrySchema);

function resolveHistoryPath(dataDir: string): string {
  return join(dataDir, ...USER_HISTORY_PATH);
}

async function loadHistoryEntries(dataDir: string): Promise<UserRequirementHistoryEntry[]> {
  const filePath = resolveHistoryPath(dataDir);
  const raw = await safeReadFile(filePath);
  if (!raw) return [];
  try {
    return UserRequirementHistoryFileSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveHistoryEntries(dataDir: string, entries: UserRequirementHistoryEntry[]): Promise<void> {
  const filePath = resolveHistoryPath(dataDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
  await safeChmod(filePath);
}

function generateHistoryId(): string {
  return `hist_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function buildTitle(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export async function loadUserRequirementHistory(
  dataDir: string,
  limit = 20,
): Promise<UserRequirementHistoryEntry[]> {
  const entries = await loadHistoryEntries(dataDir);
  return entries
    .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
    .slice(0, limit);
}

export async function upsertUserRequirementHistory(
  dataDir: string,
  input: UserRequirementHistoryUpsertInput,
): Promise<UserRequirementHistoryEntry> {
  const entries = await loadHistoryEntries(dataDir);
  const now = new Date().toISOString();

  const existingIndex = input.id ? entries.findIndex((e) => e.id === input.id) : -1;

  if (existingIndex >= 0) {
    const existing = entries[existingIndex]!;
    const updated: UserRequirementHistoryEntry = {
      ...existing,
      title: input.title?.trim() || buildTitle(input.userRequirementText),
      userRequirementText: input.userRequirementText,
      selectedPlatforms: input.selectedPlatforms,
      maxRounds: input.maxRounds,
      maxMinutes: input.maxMinutes,
      lastUsedAt: now,
      useCount: existing.useCount + 1,
    };
    entries[existingIndex] = updated;
    await saveHistoryEntries(dataDir, entries);
    return updated;
  }

  const newEntry: UserRequirementHistoryEntry = {
    id: input.id?.trim() || generateHistoryId(),
    title: input.title?.trim() || buildTitle(input.userRequirementText),
    userRequirementText: input.userRequirementText,
    selectedPlatforms: input.selectedPlatforms,
    maxRounds: input.maxRounds,
    maxMinutes: input.maxMinutes,
    createdAt: now,
    lastUsedAt: now,
    useCount: 1,
  };
  entries.unshift(newEntry);
  await saveHistoryEntries(dataDir, entries);
  return newEntry;
}

export async function deleteUserRequirementHistory(
  dataDir: string,
  id: string,
): Promise<void> {
  const entries = await loadHistoryEntries(dataDir);
  const filtered = entries.filter((e) => e.id !== id);
  await saveHistoryEntries(dataDir, filtered);
}

export async function markUserRequirementHistoryReused(
  dataDir: string,
  id: string,
): Promise<UserRequirementHistoryEntry | null> {
  const entries = await loadHistoryEntries(dataDir);
  const index = entries.findIndex((e) => e.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const updated: UserRequirementHistoryEntry = {
    ...entries[index]!,
    lastUsedAt: now,
    useCount: entries[index]!.useCount + 1,
  };
  entries[index] = updated;
  await saveHistoryEntries(dataDir, entries);
  return updated;
}
