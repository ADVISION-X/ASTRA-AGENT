import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parsePidList(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function isEmptyListenerCommandError(error) {
  const details = error && typeof error === "object" ? error : undefined;
  const code = details && "code" in details ? details.code : undefined;
  const stdout = details && "stdout" in details && typeof details.stdout === "string" ? details.stdout : "";
  return (code === 1 || code === "ENOENT") && stdout.trim().length === 0;
}

async function getListeningPidsOnUnix(port) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return parsePidList(stdout);
  } catch (error) {
    if (isEmptyListenerCommandError(error)) {
      return [];
    }
    throw error;
  }
}

async function getListeningPidsOnWindows(port) {
  const script = [
    `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
    "if ($null -eq $connections) { return }",
    "$connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]);
    return parsePidList(stdout);
  } catch (error) {
    if (isEmptyListenerCommandError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getListeningProcessIds(port, platform = process.platform) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Port must be a positive integer, received ${port}.`);
  }

  return platform === "win32" ? getListeningPidsOnWindows(port) : getListeningPidsOnUnix(port);
}

export async function terminateProcess(processId, signal) {
  try {
    process.kill(processId, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ESRCH" || error.code === "EPERM")) {
      return false;
    }
    throw error;
  }
}

export const waitForDelay = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));