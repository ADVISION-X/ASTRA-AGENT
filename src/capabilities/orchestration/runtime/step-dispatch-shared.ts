import type { z } from "zod";

import type { MissionState, OperationalMap } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { findAiPromptContractCatalogEntry, resolveAiDispatchTimeoutMs } from "../../ai/index.js";

const DEFAULT_STEP_TIMEOUT_MS = 60_000;

type OperationalStep = OperationalMap["steps"][number];
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
  if (
    step.stepId === "prepare-next-item-verification-ai-input"
    && payloadRefs.promptInputRef
    && payloadRefs.promptInputRef !== outputRef
  ) {
    nextPayloadRefs.previousPromptInputRef = payloadRefs.promptInputRef;
  }
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

type AiDispatchRequirements = {
  taskType: string;
  promptContractVersion: string;
  outputSchemaRef: string;
  aiInputRefs: string[];
  providerPolicyRef: string;
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
      videoVisitId: `${state.missionId}:video-visit:${state.currentRoundIndex}`,
      mapPackageId: state.mapPackageId,
      mapPackageVersion: state.mapPackageVersion,
      selectedMapVersion: state.selectedMapVersion,
      activationId: state.activationId,
      activationSnapshotRef: state.activationSnapshotRef,
    },
  };
};

const buildAbilityOutputSchemaRef = (targetAbilityGroupId: string, childCapabilityId: string) => `${targetAbilityGroupId}.${childCapabilityId}.output`;

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

const PRODUCTION_STEP_TIMEOUT_MS_BY_KIND = {
  ability: 60_000,
  ai: 60_000,
  finalize: 60_000,
} as const;

const PRODUCTION_STEP_TIMEOUT_MS_BY_ABILITY: Partial<Record<Exclude<OperationalStep["targetAbilityGroupId"], null>, number>> = {
  ai: PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.ai,
  open: 60_000,
  screenshot: 60_000,
  "visual-target": 60_000,
  "geometry-guard": 60_000,
  "mouse-click": 60_000,
  "mouse-scroll": 60_000,
  "text-input": 60_000,
  "page-state": 60_000,
  "forensics-persistence": 60_000,
} as const;

const resolveStepTimeoutMs = (step: OperationalStep): number => {
  if (step.stepKind === "ai") {
    const promptContract = step.promptContractId ? findAiPromptContractCatalogEntry(step.promptContractId) : null;
    return promptContract ? resolveAiDispatchTimeoutMs(promptContract.taskType) : PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.ai;
  }
  if (step.stepKind === "finalize") {
    return PRODUCTION_STEP_TIMEOUT_MS_BY_KIND.finalize;
  }
  return step.targetAbilityGroupId
    ? PRODUCTION_STEP_TIMEOUT_MS_BY_ABILITY[step.targetAbilityGroupId] ?? DEFAULT_STEP_TIMEOUT_MS
    : DEFAULT_STEP_TIMEOUT_MS;
};

export {
  applyStepOutputRefPolicy,
  DEFAULT_STEP_TIMEOUT_MS,
  buildAbilityOutputSchemaRef,
  buildBranchFieldValues,
  resolveDispatchChain,
  resolveStepTimeoutMs,
};

export type {
  AbilityDispatchInput,
  AbilityDispatchTarget,
  AbilityStep,
  AiStep,
  DispatchChain,
  FinalizeStep,
  OperationalStep,
  StepDispatchResult,
};
