import type { z } from "zod";

import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { tryGetPromptContractCatalogEntry } from "../../ai/prompt-contracts/registry.js";
import { getDefaultMapPluginRegistry } from "./orchestration-map-id-list.js";

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

type OperationalStep = OperationalMap["steps"][number];
type ReviewStep = OperationalStep & { stepKind: "review" };
type FinalizeStep = OperationalStep & { stepKind: "finalize" };
type AiStep = OperationalStep & { stepKind: "ai" };
type AbilityStep = OperationalStep & { stepKind: "ability" };

const applyStepOutputRefPolicy = (
  step: OperationalStep,
  payloadRefs: z.output<typeof MissionStepResultSchema>["payloadRefs"],
  outputRef: string | null,
): z.output<typeof MissionStepResultSchema>["payloadRefs"] => {
  if (!outputRef || step.outputRefPolicy.storeAs.length === 0) {
    return payloadRefs;
  }

  const nextPayloadRefs = { ...payloadRefs };
  for (const key of step.outputRefPolicy.storeAs) {
    if (key === "requestedPlatformId") {
      continue;
    }
    nextPayloadRefs[key] = outputRef;
  }
  return nextPayloadRefs;
};

type StepDispatchResult =
  | { dispatched: true; stepResult: z.output<typeof MissionStepResultSchema> }
  | { dispatched: false; failureReason: string };

type AbilityDispatchInput = {
  state: MissionState;
  map: OperationalMap;
  step: AbilityStep;
  sequenceNo: number;
  idempotencyKey: string;
  context: Pick<OrchestrationRuntimeContext, "nerveBus">;
  missionId: string;
};

type AbilityDispatchTarget = Exclude<AbilityStep["targetAbilityGroupId"], null | "ai">;

type DispatchChain = {
  runId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
};

const resolveDispatchChain = (state: MissionState, stepId: string): { ok: true; value: DispatchChain } | { ok: false; failureReason: string } => {
  if (!state.activeTaskRunId) {
    return { ok: false, failureReason: `Step "${stepId}" cannot dispatch without activeTaskRunId.` };
  }

  if (!state.missionId || !state.mapPackageId || !state.mapPackageVersion || !state.selectedMapVersion || !state.activationId || !state.activationSnapshotRef) {
    return { ok: false, failureReason: `Step "${stepId}" is missing frozen activation chain fields.` };
  }

  return {
    ok: true,
    value: {
      runId: state.activeTaskRunId,
      sessionId: state.missionId,
      roundId: String(state.currentRoundIndex),
      videoVisitId: null,
      mapPackageId: state.mapPackageId,
      mapPackageVersion: state.mapPackageVersion,
      selectedMapVersion: state.selectedMapVersion,
      activationId: state.activationId,
      activationSnapshotRef: state.activationSnapshotRef,
    },
  };
};

const buildAbilityOutputSchemaRef = (targetAbilityGroupId: string, childCapabilityId: string) => `${targetAbilityGroupId}.${childCapabilityId}.output`;

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildBranchFieldValues = (input: {
  decision: string | null;
  branchFieldValues: z.output<typeof MissionStepResultSchema>["branchFieldValues"];
}): z.output<typeof MissionStepResultSchema>["branchFieldValues"] => {
  if (input.decision === null) {
    return input.branchFieldValues;
  }

  return {
    ...input.branchFieldValues,
    decision: input.decision,
  };
};

const resolveAiDispatchRequirements = (input: {
  state: MissionState;
  map: OperationalMap;
  step: AiStep;
}): { ok: true; value: { taskType: string; promptContractVersion: string; outputSchemaRef: string; aiInputRefs: string[]; providerPolicyRef: string } } | { ok: false; failureReason: string } => {
  const registration = getDefaultMapPluginRegistry().active.getRegistration(input.map.mapId);
  if (!registration) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" has no active map registration.` };
  }
  if (!input.step.promptContractId) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing promptContractId.` };
  }
  const promptContract = tryGetPromptContractCatalogEntry(input.step.promptContractId);
  if (!promptContract) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" prompt_contract_resolution_failed for ${input.step.promptContractId}.` };
  }

  const binding = registration.mapPackage.promptBindings.bindings.find((candidate) => candidate.stepId === input.step.stepId);
  if (!binding) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing governed prompt binding.` };
  }
  if (binding.outputSchemaRef !== promptContract.outputSchemaRef) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" prompt contract output schema mismatch.` };
  }

  if (!input.state.promptContractVersion) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing promptContractVersion.` };
  }

  const aiInputRefs = binding.requiredInputRefs.map((key) => resolvePayloadRefValue(input.state.payloadRefs, key));
  if (aiInputRefs.some((value) => value === null)) {
    return { ok: false, failureReason: `AI step "${input.step.stepId}" is missing required aiInputRefs from payloadRefs.` };
  }

  return {
    ok: true,
    value: {
      taskType: promptContract.taskType,
      promptContractVersion: input.state.promptContractVersion,
      outputSchemaRef: binding.outputSchemaRef,
      aiInputRefs: aiInputRefs as string[],
      providerPolicyRef: `orchestration:${input.step.stepId}:provider-policy`,
    },
  };
};

export {
  applyStepOutputRefPolicy,
  DEFAULT_STEP_TIMEOUT_MS,
  buildAbilityOutputSchemaRef,
  buildBranchFieldValues,
  resolveAiDispatchRequirements,
  resolveDispatchChain,
};

export type {
  AbilityDispatchInput,
  AbilityDispatchTarget,
  AbilityStep,
  AiStep,
  DispatchChain,
  FinalizeStep,
  OperationalStep,
  ReviewStep,
  StepDispatchResult,
};
