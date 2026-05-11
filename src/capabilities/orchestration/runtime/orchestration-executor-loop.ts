import { randomUUID } from "node:crypto";
import type { MissionExecutionResult, MissionState, RuntimePlan } from "../contract.js";
import type { ActiveRuntimePlanRecord } from "../ports/orchestration-runtime-plan-store-port.js";
import { buildOrchestrationRuntimeProof } from "./orchestration-proof-builder.js";
import { buildMissionExecutionResult } from "./orchestration-result-builder.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { runMissionLoopIteration } from "./orchestration-executor-loop-iteration.js";
import { toMapProofMetadata, toRuntimeProofStatus } from "./orchestration-state-support.js";

type OrchestrationLoopInput = {
  state: MissionState;
  map: RuntimePlan;
  mapRecord: ActiveRuntimePlanRecord | null;
  context: OrchestrationRuntimeContext;
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  runtimePlanSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
};

function buildMissionLoopFallbackProof(input: OrchestrationLoopInput, state: MissionState) {
  const now = input.context.clock.now().isoTimestamp;
  return buildOrchestrationRuntimeProof({
    missionId: state.missionId ?? "unknown-mission",
    runId: state.activeTaskRunId ?? `${state.missionId ?? "unknown-mission"}:fallback-run`,
    mapId: state.mapId ?? input.map.mapId,
    ...toMapProofMetadata(input.mapRecord),
    runtimePlanSource: input.runtimePlanSource,
    stepId: state.currentStepId ?? "finalize-mission",
    childCapabilityId: "finalize-mission",
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
    sequenceNo: state.sequenceNo,
    abilityResultRef: state.lastResultRef ?? null,
    previousStepId: state.previousStepId ?? null,
    startedAt: now,
    endedAt: now,
    durationMs: 0,
    status: toRuntimeProofStatus(state.status),
    failureReason: state.failureReason,
    reviewRequiredReason: state.reviewRequiredReason,
    mapDecision: "selected",
    transitionDecision: "finalize",
    loopDecision: "continue",
    stateDecision: "finalized",
    emergencyDecision: state.emergencyStopLatched ? "latched" : "none",
    dataQualityFlags: [],
  });
}

function createLoopProofContext(input: OrchestrationLoopInput) {
  return {
    missionId: input.state.missionId ?? "unknown-mission",
    runId: input.state.activeTaskRunId ?? `${input.state.missionId ?? "unknown-mission"}:fallback-run`,
    mapId: input.state.mapId ?? input.map.mapId,
    runtimePlanSource: input.runtimePlanSource,
    commandKind: input.commandKind,
    caller: input.caller,
    idempotencyKey: input.idempotencyKey,
    mapRecord: input.mapRecord,
  };
}

export async function runMissionLoop(input: OrchestrationLoopInput): Promise<MissionExecutionResult> {
  let state = input.state;
  let lastResult = null;
  let lastProof = null;
  const proofContext = createLoopProofContext(input);

  while (state.currentStepId && state.status === "running") {
    const outcome = await runMissionLoopIteration({
      state,
      map: input.map,
      mapRecord: input.mapRecord,
      context: input.context,
      commandKind: input.commandKind,
      caller: input.caller,
      idempotencyKey: input.idempotencyKey,
      runtimePlanSource: input.runtimePlanSource,
      proofContext,
      lastResult,
      stepDispatchCallId: randomUUID(),
    });
    state = outcome.state;
    lastResult = outcome.lastResult;
    lastProof = outcome.lastProof;
    if (outcome.result) {
      return outcome.result;
    }
  }

  if (!lastProof) {
    lastProof = buildMissionLoopFallbackProof(input, state);
  }

  return buildMissionExecutionResult({ missionState: state, currentStepResult: lastResult, runtimeProof: lastProof });
}
