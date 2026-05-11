import type { z } from "zod";

import type {
  AllowedAbilityGroupIdSchema,
  BranchFieldValuesSchema,
  RuntimePlanIdSchema,
  PayloadRefBundleSchema,
  TransitionStatusSchema,
} from "../schema.js";

export type AbilityDispatchTarget = Exclude<z.output<typeof AllowedAbilityGroupIdSchema>, "ai">;
export type AbilityDispatchStatus = z.output<typeof TransitionStatusSchema>;
export type OrchestrationDispatchPayload = z.output<typeof PayloadRefBundleSchema>;
export type DispatchInputValue = string | number | boolean | null | undefined;

export type OrchestrationDispatchResult = {
  status: AbilityDispatchStatus;
  envelopeId: string;
  resultRef: string;
  decision: string | null;
  actionPlan: unknown | null;
  branchFieldValues: z.output<typeof BranchFieldValuesSchema>;
  failureReason: string | null;
  payloadRefs: OrchestrationDispatchPayload;
};

export interface OrchestrationNerveBusPort {
  sendCommandToAbility(input: {
    missionId: string;
    mapId: z.output<typeof RuntimePlanIdSchema>;
    stepId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    targetAbilityGroupId: AbilityDispatchTarget;
    childCapabilityId: string;
    expectedOutputSchemaRef: string;
    postClickObservation: boolean;
    payloadRefs: OrchestrationDispatchPayload;
    actionInputRef?: string | null;
    dispatchInput?: Record<string, DispatchInputValue>;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
  }): Promise<OrchestrationDispatchResult>;
  sendRequestToAi(input: {
    missionId: string;
    mapId: z.output<typeof RuntimePlanIdSchema>;
    stepId: string;
    capabilityCallId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    taskType: string;
    promptContractId: string;
    promptContractVersion: string;
    outputSchemaRef: string;
    aiInputRefs: string[];
    providerPolicyRef: string;
    payloadRefs: OrchestrationDispatchPayload;
    dispatchInput?: Record<string, DispatchInputValue>;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
    signal?: AbortSignal | undefined;
  }): Promise<OrchestrationDispatchResult>;
}
