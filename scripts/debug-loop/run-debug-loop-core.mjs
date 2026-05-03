import { runOneIteration } from "./run-debug-loop-iteration.mjs";
import { resolveIterationPlan } from "./run-state.mjs";

export function printDebugLoopUsage() {
  process.stdout.write([
    "Usage: node scripts/debug-loop/run-debug-loop.mjs --scenario <scenarioId> [--maxIterations <n>] [--continue] [--repairMode manual|codex-cli] [--owner <ownerId>] [--runId <id>]",
    "",
    "Run one controlled Debug Loop iteration and write artifacts under .debug-loop/runs/.",
  ].join("\n") + "\n");
}

function createDebugSessionId() {
  return `debug-${new Date().toISOString().replace(/[.:]/g, "-")}`;
}

function parsePositiveInteger(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

export function parseDebugLoopArgs(argv) {
  const scenarioIndex = argv.indexOf("--scenario");
  const maxIterationsIndex = argv.indexOf("--maxIterations");
  const repairModeIndex = argv.indexOf("--repairMode");
  const ownerIndex = argv.indexOf("--owner");
  const runIdIndex = argv.indexOf("--runId");
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    scenarioId: scenarioIndex === -1 ? null : argv[scenarioIndex + 1] ?? null,
    maxIterations: parsePositiveInteger(maxIterationsIndex === -1 ? null : argv[maxIterationsIndex + 1], 1),
    continueMode: argv.includes("--continue"),
    repairMode: repairModeIndex === -1 ? "manual" : argv[repairModeIndex + 1] ?? "manual",
    owner: ownerIndex === -1 ? null : argv[ownerIndex + 1] ?? null,
    runId: runIdIndex === -1 ? null : argv[runIdIndex + 1] ?? null,
  };
}

function updateFailureTracking(currentCategory, previousFailureCategory, identicalFailureCount) {
  return {
    identicalFailureCount: currentCategory === previousFailureCategory ? identicalFailureCount + 1 : 1,
    previousFailureCategory: currentCategory,
  };
}

async function runIterationLoop(input) {
  let identicalFailureCount = 0;
  let previousFailureCategory = null;
  let finalIterationResult = null;

  for (let offset = 0; offset < input.args.maxIterations; offset += 1) {
    const iteration = input.iterationPlan.startIteration + offset;
    finalIterationResult = await runOneIteration({
      args: input.args,
      debugSessionId: input.debugSessionId,
      iteration,
      identicalFailureCount,
      previousRepairPacket: offset === 0 ? input.iterationPlan.previousRepairPacket : finalIterationResult?.repairPacketResult?.packet ?? null,
      previousGitState: offset === 0 ? input.iterationPlan.previousGitState : null,
    });
    const failureTracking = updateFailureTracking(finalIterationResult.classification.failureCategory, previousFailureCategory, identicalFailureCount);
    identicalFailureCount = failureTracking.identicalFailureCount;
    previousFailureCategory = failureTracking.previousFailureCategory;
    if (finalIterationResult.decisionPayload.decision !== "CONTINUE" || input.args.repairMode === "manual") {
      break;
    }
  }

  return {
    debugSessionId: input.debugSessionId,
    finalDecision: finalIterationResult?.decisionPayload.decision ?? "NOT_PASS",
    reason: finalIterationResult?.decisionPayload.reason ?? "No iteration result was produced.",
  };
}

export async function runDebugLoop(input) {
  const args = input ?? parseDebugLoopArgs(process.argv.slice(2));
  if (args.continueMode && !args.runId) {
    return {
      debugSessionId: null,
      finalDecision: "BLOCKED_PREVIOUS_REPAIR_PACKET_MISSING",
      reason: "--continue requires --runId so the controller can load the previous repair-packet.",
    };
  }

  const debugSessionId = args.runId ?? createDebugSessionId();
  const iterationPlan = await resolveIterationPlan(debugSessionId, args.continueMode);
  if (!iterationPlan.ok) {
    return {
      debugSessionId,
      finalDecision: iterationPlan.decision,
      reason: iterationPlan.reason,
    };
  }

  return runIterationLoop({ args, debugSessionId, iterationPlan });
}