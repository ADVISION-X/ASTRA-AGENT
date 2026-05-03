import path from "node:path";

import { detectAuthSignals } from "./auth-detector.mjs";
import { classifyFailure } from "./failure-classifier.mjs";
import { decideNextAction } from "./decision-engine.mjs";
import { writeJsonFile } from "./json-utils.mjs";
import { routeOwner } from "./owner-router.mjs";
import { writeRepairPacket } from "./repair-packet-writer.mjs";

function shouldWriteRepairPacket(classification) {
  return !["PASS", "AUTH_REQUIRED", "EXTERNAL_PLATFORM_SECURITY", "SESSION_EXPIRED", "PROFILE_INVALID"].includes(classification.failureCategory);
}

function buildGitGuardClassification(gitGuardDecision) {
  return {
    failureCategory: "OWNER_BOUNDARY_ERROR",
    owner: "debug-loop-controller",
    severity: "P0",
    rootCause: gitGuardDecision.reason,
    firstFatal: gitGuardDecision.reason,
    evidenceRefs: [],
    allowedModify: [],
    forbiddenModify: [],
    requiredFixType: "BOUNDARY_FIX",
    secondaryFindings: [],
  };
}

function buildRequiredCommands(debugSessionId, scenarioId) {
  return [
    "npm run audit:build",
    "npm run ci:full",
    `node scripts/debug-loop/run-debug-loop.mjs --scenario ${scenarioId} --continue --runId ${debugSessionId}`,
  ];
}

function createDecisionPayload(input) {
  return {
    debugSessionId: input.debugSessionId,
    iteration: input.iteration,
    decision: input.decision.decision,
    reason: input.decision.reason,
    stageTrail: input.stageTrail,
    scenarioStatus: input.scenarioStatus,
    verificationResult: input.verificationResult,
  };
}

export async function finalizeIterationOutcome(input) {
  const authResult = detectAuthSignals({ logIndex: input.logIndex, modeInfo: input.authModeInfo });
  const classification = input.gitGuardDecision.decision === "REJECT_REPAIR"
    ? buildGitGuardClassification(input.gitGuardDecision)
    : await classifyFailure({ logIndex: input.logIndex, authResult, mapResolution: input.mapResolution, verificationResult: input.verificationResult });
  await writeJsonFile(path.join(input.iterationDir, "failure-classification.json"), classification);

  const route = routeOwner(classification);
  const repairPacketResult = shouldWriteRepairPacket(classification)
    ? await writeRepairPacket({
        iterationDir: input.iterationDir,
        debugSessionId: input.debugSessionId,
        iteration: input.iteration,
        scenarioId: input.scenario.scenarioId,
        classification,
        route,
        requiredCommands: buildRequiredCommands(input.debugSessionId, input.scenario.scenarioId),
      })
    : null;
  const decision = decideNextAction({
    classification,
    verificationResult: input.verificationResult,
    route,
    repairPacket: repairPacketResult?.packet ?? null,
    gitGuard: input.gitGuardDecision,
    identicalFailureCount: input.identicalFailureCount,
    repairMode: input.args.repairMode,
  });
  const decisionPayload = createDecisionPayload({
    debugSessionId: input.debugSessionId,
    iteration: input.iteration,
    decision,
    stageTrail: input.stageTrail,
    scenarioStatus: input.verificationResult?.runtimeScenario ?? input.scenarioExecution?.scenarioResult.status ?? "FAIL",
    verificationResult: input.verificationResult,
  });
  await writeJsonFile(path.join(input.iterationDir, "decision.json"), decisionPayload);

  return { decisionPayload, classification, route, repairPacketResult };
}