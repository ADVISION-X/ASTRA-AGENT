import os from "node:os";
import path from "node:path";

export function getDefaultLocalDataDir(platform = process.platform): string {
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "GrassEye", "local-data");
  }

  if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Local", "GrassEye", "local-data");
  }

  return path.join(os.homedir(), ".local", "share", "grasseye", "local-data");
}

export function getDefaultPhase04LocalDataDir(platform = process.platform): string {
  return path.join(getDefaultLocalDataDir(platform), "phase-04-full-enforcement");
}