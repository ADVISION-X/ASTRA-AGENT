import path from "node:path";

import { runCommand } from "./command-runner.mjs";
import { getDebugLoopDir } from "./path-policy.mjs";

function buildScenarioResult(status, scenarioId, rootCause, blockingSignals = []) {
  return {
    status,
    scenarioId,
    successSignals: [],
    blockingSignals,
    runtimeEvents: [],
    rootCause,
    command: null,
  };
}

function tryParseScenarioPayload(stdout) {
  try {
    return { ok: true, payload: JSON.parse(stdout) };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseScenarioOutput(stdout, stderr) {
  const parsed = tryParseScenarioPayload(stdout);
  if (parsed.ok) {
    return parsed.payload;
  }

  return buildScenarioResult(
    "FAIL",
    null,
    stderr || `Failed to parse scenario-runner output: ${parsed.errorMessage}`,
  );
}

async function runScenarioCommand(scenarioId, iterationDir) {
  const commandResult = await runCommand(process.execPath, [path.join(getDebugLoopDir(), "scenario-runner.mjs"), "--scenario", scenarioId], {
    cwd: process.cwd(),
    stdoutPath: path.join(iterationDir, "stdout.log"),
    stderrPath: path.join(iterationDir, "stderr.log"),
  });

  return {
    commandResult,
    scenarioResult: parseScenarioOutput(commandResult.stdout, commandResult.stderr),
  };
}

function buildBlockedScenarioResult(scenario, mapResolution) {
  return buildScenarioResult("BLOCKED", scenario.scenarioId, mapResolution.rootCause, [mapResolution.decision]);
}

function buildGitGuardFailureScenarioResult(scenarioId, reason) {
  return buildScenarioResult("FAIL", scenarioId, reason);
}

export async function resolveScenarioExecution(input) {
  if (input.gitGuardDecision.decision === "REJECT_REPAIR") {
    return {
      commandResult: null,
      scenarioResult: buildGitGuardFailureScenarioResult(input.scenario.scenarioId, input.gitGuardDecision.reason),
    };
  }

  if (input.continueMode) {
    return null;
  }

  return input.mapResolution.decision && input.mapResolution.status === "blocked"
    ? { commandResult: null, scenarioResult: buildBlockedScenarioResult(input.scenario, input.mapResolution) }
    : runScenarioCommand(input.scenario.scenarioId, input.iterationDir);
}