import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import type { RequestedPlatformId } from "./workbench-contract.js";
import { createId } from "./ids.js";

export type UserRequirementHistoryPlatformId = Extract<RequestedPlatformId, "facebook-web" | "tiktok-web">;

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

const USER_REQUIREMENT_HISTORY_RELATIVE_PATH = ["user-requirement-history.json"] as const;

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
  return join(dataDir, ...USER_REQUIREMENT_HISTORY_RELATIVE_PATH);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isIgnorablePermissionError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error
    && "code" in error
    && ["EPERM", "ENOTSUP", "EROFS", "EINVAL"].includes(String(error.code ?? ""));
}

async function readHistoryFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

async function ensureHistoryParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function lockHistoryFile(path: string): Promise<void> {
  try {
    await chmod(path, 0o600);
  } catch (error) {
    if (isIgnorablePermissionError(error)) {
      return;
    }
    throw error;
  }
}

function normalizeTitle(input: { title?: string | null; userRequirementText: string }): string {
  const explicit = input.title?.trim();
  if (explicit) {
    return explicit.slice(0, 60);
  }
  const firstLine = input.userRequirementText.split(/\r?\n/u).find((line) => line.trim().length > 0)?.trim() ?? input.userRequirementText.trim();
  return firstLine.slice(0, 60);
}

function sortHistory(entries: UserRequirementHistoryEntry[]): UserRequirementHistoryEntry[] {
  return [...entries].sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
}

async function writeHistoryEntries(dataDir: string, entries: UserRequirementHistoryEntry[]): Promise<void> {
  const filePath = resolveHistoryPath(dataDir);
  await ensureHistoryParent(filePath);
  await writeFile(filePath, `${JSON.stringify(sortHistory(entries), null, 2)}\n`, { mode: 0o600 });
  await lockHistoryFile(filePath);
}

function findMatchingEntry(entries: UserRequirementHistoryEntry[], input: UserRequirementHistoryUpsertInput): UserRequirementHistoryEntry | null {
  if (input.id) {
    return entries.find((entry) => entry.id === input.id) ?? null;
  }
  return entries.find((entry) => entry.userRequirementText === input.userRequirementText && entry.selectedPlatforms.join(",") === input.selectedPlatforms.join(",")) ?? null;
}

export async function loadUserRequirementHistory(dataDir: string, limit = 20): Promise<UserRequirementHistoryEntry[]> {
  const content = await readHistoryFile(resolveHistoryPath(dataDir));
  if (content === null) {
    return [];
  }
  return sortHistory(UserRequirementHistoryFileSchema.parse(JSON.parse(content))).slice(0, Math.max(1, limit));
}

export async function upsertUserRequirementHistory(dataDir: string, input: UserRequirementHistoryUpsertInput): Promise<UserRequirementHistoryEntry> {
  const now = new Date().toISOString();
  const entries = await loadUserRequirementHistory(dataDir, 500);
  const existing = findMatchingEntry(entries, input);
  const nextEntry = UserRequirementHistoryEntrySchema.parse(existing
    ? {
      ...existing,
      title: normalizeTitle(input),
      userRequirementText: input.userRequirementText,
      selectedPlatforms: input.selectedPlatforms,
      maxRounds: input.maxRounds,
      maxMinutes: input.maxMinutes,
      lastUsedAt: now,
      useCount: existing.useCount + 1,
    }
    : {
      id: input.id?.trim() || createId("user_requirement_history"),
      title: normalizeTitle(input),
      userRequirementText: input.userRequirementText,
      selectedPlatforms: input.selectedPlatforms,
      maxRounds: input.maxRounds,
      maxMinutes: input.maxMinutes,
      createdAt: now,
      lastUsedAt: now,
      useCount: 1,
    });
  const filtered = entries.filter((entry) => entry.id !== nextEntry.id);
  await writeHistoryEntries(dataDir, [nextEntry, ...filtered].slice(0, 100));
  return nextEntry;
}

export async function deleteUserRequirementHistory(dataDir: string, id: string): Promise<boolean> {
  const entries = await loadUserRequirementHistory(dataDir, 500);
  const nextEntries = entries.filter((entry) => entry.id !== id);
  if (nextEntries.length === entries.length) {
    return false;
  }
  await writeHistoryEntries(dataDir, nextEntries);
  return true;
}

export async function markUserRequirementHistoryReused(dataDir: string, id: string): Promise<UserRequirementHistoryEntry | null> {
  const entries = await loadUserRequirementHistory(dataDir, 500);
  const existing = entries.find((entry) => entry.id === id) ?? null;
  if (!existing) {
    return null;
  }
  return upsertUserRequirementHistory(dataDir, {
    id: existing.id,
    title: existing.title,
    userRequirementText: existing.userRequirementText,
    selectedPlatforms: existing.selectedPlatforms,
    maxRounds: existing.maxRounds,
    maxMinutes: existing.maxMinutes,
  });
}