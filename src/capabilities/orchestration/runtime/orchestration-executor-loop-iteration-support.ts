import type { MissionExecutionResult, MissionState, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import {
  checkCanDispatchStep,
  evaluateLoopGuard,
} from "./orchestration-loop-iteration-dispatch-support.js";
import {
  recordPreconditionCheck,
  recordStepSelected,
} from "./orchestration-loop-iteration-events-gateway.js";
import type { buildDispatchGateFailureProof, OrchestrationLoopProofContext } from "./orchestration-loop-proof-builders.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import type { dispatchOperationalStep } from "./step-dispatcher.js";
import { findEffectiveOperationalStep } from "./route-plan-resolver.js";

type StepDispatchResult = Awaited<ReturnType<typeof dispatchOperationalStep>>;
type OrchestrationStepResultRecord = Extract<StepDispatchResult, { dispatched: true }>["stepResult"];
type RuntimeProofRecord = ReturnType<typeof buildDispatchGateFailureProof>;

type MissionLoopIterationOutcome = {
  state: MissionState;
  lastResult: OrchestrationStepResultRecord | null;
  lastProof: RuntimeProofRecord | null;
  result: MissionExecutionResult | null;
};

type RunMissionLoopIterationInput = {
  state: MissionState;
  map: OperationalMap;
  mapRecord: ActiveOperationalMapRecord | null;
  context: OrchestrationRuntimeContext;
  commandKind: "start-mission" | "resume-mission";
  caller: "commander-console" | "orchestration";
  idempotencyKey: string;
  selectedMapSource: "preferred_map_id" | "initial_payload_map_id" | "task_template_id" | "activation_id";
  proofContext: OrchestrationLoopProofContext;
  lastResult: OrchestrationStepResultRecord | null;
  stepDispatchCallId: string;
};

type PreparedMissionLoopIteration =
  | {
    kind: "missing_step";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    nowIsoTimestamp: string;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
  }
  | {
    kind: "dispatch_gate_failure";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    dispatchGateReason: string;
    endedAt: string;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  }
  | {
    kind: "loop_guard_stop";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    endedAt: string;
    loopGuardDecision: "stop_failed" | "stop_completed";
    loopGuardReason: "completed_by_run_limit" | "completed_by_time_limit" | "blocked_by_loop_guard";
    nextHopCount: number;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  }
  | {
    kind: "ready";
    currentProofContext: OrchestrationLoopProofContext;
    currentStepId: string;
    nextHopCount: number;
    stateHashBefore: string | null;
    stateRevisionBefore: number;
    step: OperationalStep;
  };

type PreparedMissionLoopIterationContext = {
  currentProofContext: OrchestrationLoopProofContext;
  currentStepId: string;
  stateHashBefore: string | null;
  stateRevisionBefore: number;
};

const createCurrentProofContext = (input: RunMissionLoopIterationInput): OrchestrationLoopProofContext => ({
  ...input.proofContext,
  missionId: input.state.missionId ?? input.proofContext.missionId,
  mapId: input.state.mapId ?? input.proofContext.mapId,
});

const createPreparedMissionLoopIterationContext = (
  input: RunMissionLoopIterationInput,
): PreparedMissionLoopIterationContext => ({
  currentProofContext: createCurrentProofContext(input),
  currentStepId: input.state.currentStepId ?? "unknown-step",
  stateHashBefore: input.state.stateHash ?? null,
  stateRevisionBefore: input.state.stateRevision ?? 0,
});

const findOperationalStep = (map: OperationalMap, stepId: string): OperationalStep | null =>
  findEffectiveOperationalStep(map, stepId);

const buildMissingStepPreparation = (
  context: PreparedMissionLoopIterationContext,
  nowIsoTimestamp: string,
): Extract<PreparedMissionLoopIteration, { kind: "missing_step" }> => ({
  kind: "missing_step",
  currentProofContext: context.currentProofContext,
  currentStepId: context.currentStepId,
  nowIsoTimestamp,
  stateHashBefore: context.stateHashBefore,
  stateRevisionBefore: context.stateRevisionBefore,
});

const prepareResolvedMissionLoopIteration = async (
  input: RunMissionLoopIterationInput,
  step: OperationalStep,
  context: PreparedMissionLoopIterationContext,
): Promise<Exclude<PreparedMissionLoopIteration, { kind: "missing_step" }>> => {
  await recordStepSelected(input, step, context.currentStepId);
  const dispatchGate = checkCanDispatchStep(input.state);
  if (!dispatchGate.allowed) {
    return {
      kind: "dispatch_gate_failure",
      currentProofContext: context.currentProofContext,
      currentStepId: context.currentStepId,
      dispatchGateReason: dispatchGate.reason ?? "dispatch gate rejected",
      endedAt: input.context.clock.now().isoTimestamp,
      stateHashBefore: context.stateHashBefore,
      stateRevisionBefore: context.stateRevisionBefore,
      step,
    };
  }

  const loopGuard = evaluateLoopGuard({ state: input.state, map: input.map, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (loopGuard.loopDecision !== "continue") {
    return {
      kind: "loop_guard_stop",
      currentProofContext: context.currentProofContext,
      currentStepId: context.currentStepId,
      endedAt: input.context.clock.now().isoTimestamp,
      loopGuardDecision: loopGuard.loopDecision,
      loopGuardReason: loopGuard.reason,
      nextHopCount: loopGuard.nextHopCount,
      stateHashBefore: context.stateHashBefore,
      stateRevisionBefore: context.stateRevisionBefore,
      step,
    };
  }

  await recordPreconditionCheck(input, step, {
    status: "success",
    reason: `Step "${context.currentStepId}" passed dispatch and loop guard checks.`,
  });
  return {
    kind: "ready",
    currentProofContext: context.currentProofContext,
    currentStepId: context.currentStepId,
    nextHopCount: loopGuard.nextHopCount,
    stateHashBefore: context.stateHashBefore,
    stateRevisionBefore: context.stateRevisionBefore,
    step,
  };
};

const prepareMissionLoopIteration = async (input: RunMissionLoopIterationInput): Promise<PreparedMissionLoopIteration> => {
  const context = createPreparedMissionLoopIterationContext(input);
  const step = findOperationalStep(input.map, context.currentStepId);
  if (!step) {
    return buildMissingStepPreparation(context, input.context.clock.now().isoTimestamp);
  }
  return prepareResolvedMissionLoopIteration(input, step, context);
};

export type {
  MissionLoopIterationOutcome,
  OrchestrationStepResultRecord,
  PreparedMissionLoopIteration,
  RunMissionLoopIterationInput,
  RuntimeProofRecord,
};

export {
  createCurrentProofContext,
  findOperationalStep,
  prepareMissionLoopIteration,
};
