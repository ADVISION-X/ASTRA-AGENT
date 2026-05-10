import type { MissionState, OperationalMap } from "../../capabilities/orchestration/contract.js";
import type { OrchestrationNerveBusPort } from "../../capabilities/orchestration/ports/orchestration-nerve-bus-port.js";
import { buildAbilityOutputSchemaRef, type DispatchChain } from "../../capabilities/orchestration/runtime/step-dispatch-shared.js";
import type { ExecutionPlan } from "../decoder/action-plan-decoder.js";
import { MuscleMemoryExecutionResultSchema, type MuscleMemoryExecutionActionResult } from "./muscle-memory-execution.schema.js";

type ExecutionAction = ExecutionPlan["actions"][number];
type PayloadRefs = MissionState["payloadRefs"];

type SyntheticDispatch = {
  stepId: string;
  targetAbilityGroupId: Exclude<Parameters<OrchestrationNerveBusPort["sendCommandToAbility"]>[0]["targetAbilityGroupId"], null>;
  childCapabilityId: string;
  postClickObservation: boolean;
  timeoutMs: number;
};

function resolveSyntheticDispatch(action: ExecutionAction): SyntheticDispatch {
  if (action.childCapabilityId === "write-product-lead-record") {
    return {
      stepId: "write-product-lead-record",
      targetAbilityGroupId: "forensics-persistence",
      childCapabilityId: "write-product-lead-record",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }

  if (action.childCapabilityId === "press-key" && action.input.key === "L") {
    return {
      stepId: "like-current-video-keyboard",
      targetAbilityGroupId: "text-input",
      childCapabilityId: "press-key",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }

  if (action.childCapabilityId === "press-navigation-key" && action.input.key === "ArrowDown") {
    return {
      stepId: "press-next-video-key",
      targetAbilityGroupId: "text-input",
      childCapabilityId: "press-navigation-key",
      postClickObservation: false,
      timeoutMs: 60_000,
    };
  }

  throw new Error(`Unsupported muscle-memory execution action ${action.sourceActionCode} -> ${action.childCapabilityId}.`);
}

function augmentPayloadRefs(action: ExecutionAction, payloadRefs: PayloadRefs): PayloadRefs {
  if (!payloadRefs.abilityResultRef) {
    return payloadRefs;
  }

  if (action.childCapabilityId === "write-product-lead-record") {
    return {
      ...payloadRefs,
      productLeadRecordRef: payloadRefs.abilityResultRef,
    };
  }

  if (action.childCapabilityId === "press-navigation-key") {
    return {
      ...payloadRefs,
      nextItemAdvanceProofRef: payloadRefs.abilityResultRef,
    };
  }

  return payloadRefs;
}

function buildActionResult(input: {
  action: ExecutionAction;
  syntheticDispatch: SyntheticDispatch;
  status: MuscleMemoryExecutionActionResult["status"];
  outputRef: string | null;
  failureReason: string | null;
}): MuscleMemoryExecutionActionResult {
  return {
    resolvedActionId: input.action.resolvedActionId,
    sourceActionCode: input.action.sourceActionCode,
    syntheticStepId: input.syntheticDispatch.stepId,
    status: input.status,
    outputRef: input.outputRef,
    failureReason: input.failureReason,
  };
}

function resolveFailureStatus(action: ExecutionAction, status: MuscleMemoryExecutionActionResult["status"]): MuscleMemoryExecutionActionResult["status"] {
  if (status === "review_required" || action.onFailure === "review_required") {
    return "review_required";
  }
  return "failed";
}

export async function executeMuscleMemoryPlan(input: {
  state: MissionState;
  map: OperationalMap;
  missionId: string;
  chain: DispatchChain;
  sequenceNo: number;
  idempotencyKey: string;
  plan: ExecutionPlan;
  nerveBus: Pick<OrchestrationNerveBusPort, "sendCommandToAbility">;
}) {
  let payloadRefs = { ...input.state.payloadRefs };
  const actionResults: MuscleMemoryExecutionActionResult[] = [];

  for (const action of input.plan.actions) {
    const syntheticDispatch = resolveSyntheticDispatch(action);
    const dispatchResult = await input.nerveBus.sendCommandToAbility({
      missionId: input.missionId,
      mapId: input.map.mapId,
      stepId: syntheticDispatch.stepId,
      runId: input.chain.runId,
      sessionId: input.chain.sessionId,
      roundId: input.chain.roundId,
      videoVisitId: input.chain.videoVisitId,
      mapPackageId: input.chain.mapPackageId,
      mapPackageVersion: input.chain.mapPackageVersion,
      selectedMapVersion: input.chain.selectedMapVersion,
      activationId: input.chain.activationId,
      activationSnapshotRef: input.chain.activationSnapshotRef,
      targetAbilityGroupId: syntheticDispatch.targetAbilityGroupId,
      childCapabilityId: syntheticDispatch.childCapabilityId,
      expectedOutputSchemaRef: buildAbilityOutputSchemaRef(syntheticDispatch.targetAbilityGroupId, syntheticDispatch.childCapabilityId),
      postClickObservation: syntheticDispatch.postClickObservation,
      payloadRefs,
      sequenceNo: input.sequenceNo + actionResults.length,
      idempotencyKey: `${input.idempotencyKey}:${action.resolvedActionId}`,
      timeoutMs: syntheticDispatch.timeoutMs,
    });

    payloadRefs = augmentPayloadRefs(action, dispatchResult.payloadRefs);
    actionResults.push(buildActionResult({
      action,
      syntheticDispatch,
      status: dispatchResult.status,
      outputRef: dispatchResult.payloadRefs.abilityResultRef ?? null,
      failureReason: dispatchResult.failureReason,
    }));

    if (dispatchResult.status !== "success" && (action.required || action.onFailure !== "continue")) {
      return MuscleMemoryExecutionResultSchema.parse({
        status: resolveFailureStatus(action, dispatchResult.status),
        failureReason: dispatchResult.failureReason ?? `Muscle-memory action ${action.sourceActionCode} failed.`,
        payloadRefs,
        actionResults,
      });
    }
  }

  return MuscleMemoryExecutionResultSchema.parse({
    status: "success",
    failureReason: null,
    payloadRefs,
    actionResults,
  });
}