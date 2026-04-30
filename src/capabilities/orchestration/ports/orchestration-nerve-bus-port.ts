import type { z } from "zod";

import type {
  AllowedAbilityGroupIdSchema,
  OperationalMapIdSchema,
  PayloadRefBundleSchema,
  TransitionStatusSchema,
} from "../schema.js";

export type AbilityDispatchTarget = Exclude<z.output<typeof AllowedAbilityGroupIdSchema>, "ai">;
export type AbilityDispatchStatus = z.output<typeof TransitionStatusSchema>;
export type OrchestrationDispatchPayload = z.output<typeof PayloadRefBundleSchema>;

export type OrchestrationDispatchResult = {
  status: AbilityDispatchStatus;
  envelopeId: string;
  resultRef: string;
  decision: string | null;
  failureReason: string | null;
  payloadRefs: OrchestrationDispatchPayload;
};

export type OrchestrationReviewDispatchResult = {
  status: "review_required";
  reviewDispatchRef: string;
  failureReason: string | null;
  payloadRefs: OrchestrationDispatchPayload;
};

export interface OrchestrationNerveBusPort {
  sendCommandToAbility(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    targetAbilityGroupId: AbilityDispatchTarget;
    childCapabilityId: string;
    payloadRefs: OrchestrationDispatchPayload;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
  }): Promise<OrchestrationDispatchResult>;
  sendRequestToAi(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    promptContractId: string;
    payloadRefs: OrchestrationDispatchPayload;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
  }): Promise<OrchestrationDispatchResult>;
  sendReviewRequestToCommander(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    reason: string;
    payloadRefs: OrchestrationDispatchPayload;
    sequenceNo: number;
    idempotencyKey: string;
  }): Promise<OrchestrationReviewDispatchResult>;
}
