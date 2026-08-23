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

function toErrorDetails(error) {
  return error && typeof error === "object" ? error : undefined;
}

function getErrorCode(details) {
  return details && "code" in details ? details.code : undefined;
}

function getErrorStdout(details) {
  return details && "stdout" in details && typeof details.stdout === "string" ? details.stdout : "";
}

function isEmptyListenerCommandError(error) {
  const details = toErrorDetails(error);
  const code = getErrorCode(details);
  const stdout = getErrorStdout(details);
  return code === 1 && stdout.trim().length === 0;
}

function isMissingProcessError(error) {
  const details = toErrorDetails(error);
  return getErrorCode(details) === 1;
}

async function readProcessField(processId, field) {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(processId), "-o", `${field}=`]);
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  } catch (error) {
    if (isMissingProcessError(error)) return null;
    throw error;
  }
}

async function readProcessCwd(processId) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-a", "-p", String(processId), "-d", "cwd", "-Fn"]);
    const cwd = stdout.split(/\r?\n/u).find((line) => line.startsWith("n"))?.slice(1).trim();
    return cwd || null;
  } catch (error) {
    if (isMissingProcessError(error)) return null;
    throw error;
  }
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

export async function getProcessIdentity(processId, platform = process.platform) {
  if (!Number.isInteger(processId) || processId <= 0) {
    throw new Error(`Process id must be a positive integer, received ${processId}.`);
  }
  if (platform === "win32") {
    throw new Error("PORT_OWNERSHIP_UNSUPPORTED_PLATFORM:win32");
  }

  const startTimeBefore = await readProcessField(processId, "lstart");
  if (!startTimeBefore) return null;
  const [uidText, command, cwd] = await Promise.all([
    readProcessField(processId, "uid"),
    readProcessField(processId, "command"),
    readProcessCwd(processId),
  ]);
  const startTimeAfter = await readProcessField(processId, "lstart");
  if (!uidText || !command || !cwd || startTimeBefore !== startTimeAfter) return null;
  const uid = Number(uidText);
  if (!Number.isInteger(uid) || uid < 0) return null;
  return Object.freeze({ processId, uid, startTime: startTimeBefore, command, cwd });
}

export async function terminateProcess(processId, signal) {
  try {
    process.kill(processId, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

export const waitForDelay = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));
