import { captureGitState, verifyRepairScope } from "./git-guard.mjs";
import { resolveScenarioMapBinding } from "./map-resolver.mjs";
import { resolveRunIterationDir } from "./path-policy.mjs";
import { collectIterationArtifacts } from "./run-debug-loop-artifacts.mjs";
import { finalizeIterationOutcome } from "./run-debug-loop-decision.mjs";
import { resolveScenarioExecution } from "./run-debug-loop-scenario.mjs";
import { loadScenarioById } from "./scenario-runner.mjs";
import { runVerification } from "./verifier.mjs";

function shouldRunVerification(args, scenarioStatus) {
  return args.continueMode || scenarioStatus === "PASS";
}

function buildGitGuardInput(previousRepairPacket, previousGitState) {
  return previousRepairPacket
    ? {
        allowedModify: previousRepairPacket.allowedModify,
        forbiddenModify: previousRepairPacket.forbiddenModify,
        previousGitState: previousGitState ?? null,
      }
    : null;
}

async function resolveGitGuardDecision(previousRepairPacket, previousGitState) {
  const gitGuardInput = buildGitGuardInput(previousRepairPacket, previousGitState);
  return gitGuardInput
    ? verifyRepairScope(gitGuardInput)
    : { decision: "PASS", reason: "Initial iteration." };
}

async function maybeRunVerification(input) {
  const scenarioStatus = input.scenarioExecution?.scenarioResult.status ?? "FAIL";
  if (!shouldRunVerification(input.args, scenarioStatus)) {
    return null;
  }

  return runVerification({
    iterationDir: input.iterationDir,
    owner: input.args.owner ?? input.previousRepairPacket?.owner ?? null,
    scenarioId: input.scenario.scenarioId,
  });
}

export async function runOneIteration(input) {
  const stageTrail = ["PRECHECK", "LOAD_SCENARIO"];
  const iterationDir = resolveRunIterationDir(input.debugSessionId, input.iteration);
  const scenario = await loadScenarioById(input.args.scenarioId);
  await captureGitState({ iterationDir });
  stageTrail.push("GIT_GUARD_BEFORE", "MAP_RESOLVE", "AUTH_PRECHECK");

  const previousRepairPacket = input.previousRepairPacket ?? null;
  const gitGuardDecision = await resolveGitGuardDecision(previousRepairPacket, input.previousGitState);
  const mapResolution = await resolveScenarioMapBinding({ scenario });
  const scenarioExecution = await resolveScenarioExecution({
    scenario,
    iterationDir,
    continueMode: input.args.continueMode,
    gitGuardDecision,
    mapResolution,
  });
  if (!input.args.continueMode) {
    stageTrail.push("PUBLISH_TASK", "RUN_SCENARIO");
  }

  const verificationResult = gitGuardDecision.decision === "REJECT_REPAIR"
    ? null
    : await maybeRunVerification({ args: input.args, iterationDir, previousRepairPacket, scenario, scenarioExecution });
  if (verificationResult) {
    stageTrail.push("RUN_VERIFIER");
  }
  stageTrail.push("COLLECT_LOGS");

  const artifacts = await collectIterationArtifacts({ iterationDir, scenario, scenarioExecution, verificationResult });
  stageTrail.push("INDEX_LOGS", "CLASSIFY_FAILURE", "ROUTE_OWNER", "BUILD_REPAIR_PACKET", "DECIDE_NEXT");
  return finalizeIterationOutcome({
    debugSessionId: input.debugSessionId,
    iteration: input.iteration,
    iterationDir,
    args: input.args,
    identicalFailureCount: input.identicalFailureCount,
    scenario,
    scenarioExecution,
    verificationResult,
    mapResolution,
    gitGuardDecision,
    stageTrail,
    logIndex: artifacts.logIndex,
    authModeInfo: artifacts.authModeInfo,
  });
}