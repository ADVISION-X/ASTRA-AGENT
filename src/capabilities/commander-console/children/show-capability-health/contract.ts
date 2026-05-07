import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowCapabilityHealthBoundaryPolicySchema, ShowCapabilityHealthInputSchema, ShowCapabilityHealthOutputSchema, ShowCapabilityHealthProofPolicySchema, ShowCapabilityHealthReadinessSchema } from "./schema.js";

export const SHOW_CAPABILITY_HEALTH_CHILD_ID = "show-capability-health";

export const SHOW_CAPABILITY_HEALTH_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_CAPABILITY_HEALTH_CHILD_ID,
  childKind: "read",
  purpose: "Return governed capability health summaries for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "capability-health-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowCapabilityHealthBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "capability-health-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "capability-health-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["runtime-event"],
  }),
  proofPolicy: ShowCapabilityHealthProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowCapabilityHealthReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowCapabilityHealthInput = z.infer<typeof ShowCapabilityHealthInputSchema>;
export type ShowCapabilityHealthOutput = z.infer<typeof ShowCapabilityHealthOutputSchema>;