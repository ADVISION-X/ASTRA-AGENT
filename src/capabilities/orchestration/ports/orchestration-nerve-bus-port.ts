import type { z } from "zod";

import type {
  AllowedAbilityGroupIdSchema,
  BranchFieldValuesSchema,
  OperationalMapIdSchema,
  PayloadRefBundleSchema,
  TransitionStatusSchema,
} from "../schema.js";

export type AbilityDispatchTarget = Exclude<z.output<typeof AllowedAbilityGroupIdSchema>, "ai">;
export type AbilityDispatchStatus = z.output<typeof TransitionStatusSchema>;
export type OrchestrationDispatchPayload = z.output<typeof PayloadRefBundleSchema>;

type OrchestrationDispatchChain = {
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
};

export type OrchestrationDispatchResult = {
  status: AbilityDispatchStatus;
  envelopeId: string;
  resultRef: string;
  decision: string | null;
  branchFieldValues: z.output<typeof BranchFieldValuesSchema>;
  failureReason: string | null;
  payloadRefs: OrchestrationDispatchPayload;
};

export interface OrchestrationNerveBusPort {
  sendCommandToAbility(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    mapPackageId: string;
    mapPackageVersion: string;
    selectedMapVersion: string;
    activationId: string;
    activationSnapshotRef: string;
    targetAbilityGroupId: AbilityDispatchTarget;
    childCapabilityId: string;
    expectedOutputSchemaRef: string;
    postClickObservation: boolean;
    payloadRefs: OrchestrationDispatchPayload;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
  }): Promise<OrchestrationDispatchResult>;
  sendRequestToAi(input: {
    missionId: string;
    mapId: z.output<typeof OperationalMapIdSchema>;
    stepId: string;
    capabilityCallId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    mapPackageId: string;
    mapPackageVersion: string;
    selectedMapVersion: string;
    activationId: string;
    activationSnapshotRef: string;
    taskType: string;
    promptContractId: string;
    promptContractVersion: string;
    outputSchemaRef: string;
    aiInputRefs: string[];
    providerPolicyRef: string;
    payloadRefs: OrchestrationDispatchPayload;
    sequenceNo: number;
    idempotencyKey: string;
    timeoutMs: number;
    signal?: AbortSignal | undefined;
  }): Promise<OrchestrationDispatchResult>;
}
