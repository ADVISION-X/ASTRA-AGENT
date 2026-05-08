import { getDefaultLocalDataDir } from "./default-data-dir.js";
import {
  loadAppRunLimitSettings,
  saveAppRunLimitSettings,
} from "./app-run-limit-settings.js";
import type { AppRunLimitSettings } from "./app-run-limit-settings-types.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";

function resolveSettingsDataDir(runtime: WorkbenchRuntime): string {
  return runtime.options.dataDir ?? getDefaultLocalDataDir();
}

export function getAppRunLimitSettings(runtime: WorkbenchRuntime): Promise<AppRunLimitSettings> {
  return loadAppRunLimitSettings(resolveSettingsDataDir(runtime));
}

export function updateAppRunLimitSettings(
  runtime: WorkbenchRuntime,
  input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
): Promise<AppRunLimitSettings> {
  return saveAppRunLimitSettings(resolveSettingsDataDir(runtime), input);
}