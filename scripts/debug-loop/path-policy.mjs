import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const debugLoopDir = path.dirname(currentFile);
const repoRoot = path.resolve(debugLoopDir, "..", "..");

export function getDebugLoopDir() {
  return debugLoopDir;
}

export function getRepoRoot() {
  return repoRoot;
}

export function getDebugLoopRunsRoot() {
  return path.join(repoRoot, ".debug-loop", "runs");
}

export function resolveRunDir(debugSessionId) {
  return path.join(getDebugLoopRunsRoot(), debugSessionId);
}

export function resolveRunIterationDir(debugSessionId, iterationNumber) {
  const iterationId = String(iterationNumber).padStart(3, "0");
  return path.join(resolveRunDir(debugSessionId), `iteration-${iterationId}`);
}