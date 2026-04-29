import type { z } from "zod";

import type {
  AllowedAbilityGroupIdSchema,
  OperationalMapIdSchema,
  PayloadRefBundleSchema,
  TransitionStatusSchema,
} from "../schema.js";

export type AbilityDispatchTarget = z.output<typeof AllowedAbilityGroupIdSchema>;
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

export interface OrchestrationNerveBusPort {
  sendCommandToAbility(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    targetAbilityGroupId: AbilityDispatchTarget;
    childCapabilityId: string;
    payloadRefs: OrchestrationDispatchPayload;
  }): Promise<OrchestrationDispatchResult>;
  sendRequestToAi(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    promptContractId: string;
    payloadRefs: OrchestrationDispatchPayload;
  }): Promise<OrchestrationDispatchResult>;
  sendReviewRequestToCommander(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    reason: string;
    payloadRefs: OrchestrationDispatchPayload;
  }): Promise<OrchestrationDispatchResult>;
}