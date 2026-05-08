import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import type { AppRunLimitSettings } from "./app-run-limit-settings-types.js";

const APP_RUN_LIMIT_SETTINGS_RELATIVE_PATH = ["config", "app-run-limit-settings.json"] as const;

const AppRunLimitSettingsSchema = z.object({
  defaultMaxRounds: z.number().int().positive(),
  defaultMaxMinutes: z.number().int().positive(),
  updatedAt: z.string().min(1).nullable().optional().default(null),
}).strict();

const DEFAULT_APP_RUN_LIMIT_SETTINGS = AppRunLimitSettingsSchema.parse({
  defaultMaxRounds: 300,
  defaultMaxMinutes: 480,
  updatedAt: null,
}) satisfies AppRunLimitSettings;

function resolveSettingsPath(dataDir: string): string {
  return join(dataDir, ...APP_RUN_LIMIT_SETTINGS_RELATIVE_PATH);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isIgnorablePermissionError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error
    && "code" in error
    && ["EPERM", "ENOTSUP", "EROFS", "EINVAL"].includes(String(error.code ?? ""));
}

async function readSettings(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

async function ensureSettingsParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function lockFilePermissions(path: string): Promise<void> {
  try {
    await chmod(path, 0o600);
  } catch (error) {
    if (isIgnorablePermissionError(error)) {
      return;
    }
    throw error;
  }
}

export async function loadAppRunLimitSettings(dataDir: string): Promise<AppRunLimitSettings> {
  const filePath = resolveSettingsPath(dataDir);
  const content = await readSettings(filePath);
  if (content === null) {
    return DEFAULT_APP_RUN_LIMIT_SETTINGS;
  }
  return AppRunLimitSettingsSchema.parse(JSON.parse(content));
}

export async function saveAppRunLimitSettings(
  dataDir: string,
  input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
): Promise<AppRunLimitSettings> {
  const filePath = resolveSettingsPath(dataDir);
  const settings = AppRunLimitSettingsSchema.parse({
    defaultMaxRounds: input.defaultMaxRounds,
    defaultMaxMinutes: input.defaultMaxMinutes,
    updatedAt: new Date().toISOString(),
  });

  await ensureSettingsParent(filePath);
  await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  await lockFilePermissions(filePath);
  return settings;
}