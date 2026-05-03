import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { readJsonFile } from "./json-utils.mjs";
import { resolveRunDir, resolveRunIterationDir } from "./path-policy.mjs";

const ITERATION_DIR_PATTERN = /^iteration-(\d{3})$/;

function parseIterationNumber(entryName) {
  const match = ITERATION_DIR_PATTERN.exec(entryName);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readIterationJson(debugSessionId, iterationNumber, fileName) {
  const filePath = path.join(resolveRunIterationDir(debugSessionId, iterationNumber), fileName);
  if (!(await pathExists(filePath))) {
    return null;
  }

  return readJsonFile(filePath);
}

export async function listIterationNumbers(debugSessionId) {
  const runDir = resolveRunDir(debugSessionId);
  if (!(await pathExists(runDir))) {
    return [];
  }

  const entries = await readdir(runDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseIterationNumber(entry.name))
    .filter((entryNumber) => Number.isInteger(entryNumber))
    .sort((left, right) => left - right);
}

export async function getLatestIterationNumber(debugSessionId) {
  const iterationNumbers = await listIterationNumbers(debugSessionId);
  return iterationNumbers.at(-1) ?? 0;
}

export async function resolveIterationPlan(debugSessionId, continueMode) {
  if (!continueMode) {
    return {
      ok: true,
      latestIteration: 0,
      startIteration: 1,
      previousRepairPacket: null,
      previousGitState: null,
    };
  }

  const latestIteration = await getLatestIterationNumber(debugSessionId);
  if (latestIteration === 0) {
    return {
      ok: false,
      decision: "BLOCKED_PREVIOUS_REPAIR_PACKET_MISSING",
      reason: `Run ${debugSessionId} does not have a previous iteration to continue from.`,
    };
  }

  const previousRepairPacket = await readIterationJson(debugSessionId, latestIteration, "repair-packet.json");
  if (previousRepairPacket === null) {
    return {
      ok: false,
      decision: "BLOCKED_PREVIOUS_REPAIR_PACKET_MISSING",
      reason: `Run ${debugSessionId} iteration-${String(latestIteration).padStart(3, "0")} is missing repair-packet.json.`,
    };
  }

  return {
    ok: true,
    latestIteration,
    startIteration: latestIteration + 1,
    previousRepairPacket,
    previousGitState: await readIterationJson(debugSessionId, latestIteration, "git-state.json"),
  };
}