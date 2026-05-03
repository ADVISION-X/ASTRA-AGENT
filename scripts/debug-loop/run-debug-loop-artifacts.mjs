import path from "node:path";

import { writeJsonFile } from "./json-utils.mjs";
import { collectLogs } from "./log-collector.mjs";
import { buildLogIndex } from "./log-indexer.mjs";

function resolveCommandArtifact(scenarioExecution, verificationResult) {
  return verificationResult?.runtimeScenarioPayload?.command
    ?? scenarioExecution?.scenarioResult.command
    ?? scenarioExecution?.commandResult
    ?? {};
}

function resolveRuntimeEvents(scenarioExecution, verificationResult) {
  return verificationResult?.runtimeScenarioPayload?.runtimeEvents
    ?? scenarioExecution?.scenarioResult.runtimeEvents
    ?? [];
}

export function resolveAuthModeInfo(scenarioExecution, verificationResult) {
  return verificationResult?.runtimeScenarioPayload?.browserSession
    ?? scenarioExecution?.scenarioResult.browserSession
    ?? null;
}

export async function collectIterationArtifacts(input) {
  const collectedLogs = await collectLogs({
    iterationDir: input.iterationDir,
    scenario: input.scenario,
    command: resolveCommandArtifact(input.scenarioExecution, input.verificationResult),
    runtimeEvents: resolveRuntimeEvents(input.scenarioExecution, input.verificationResult),
  });
  const logIndex = await buildLogIndex({ iterationDir: input.iterationDir, missingLogSources: collectedLogs.missingLogSources });
  await writeJsonFile(path.join(input.iterationDir, "log-index.json"), logIndex);

  return {
    collectedLogs,
    logIndex,
    authModeInfo: resolveAuthModeInfo(input.scenarioExecution, input.verificationResult),
  };
}