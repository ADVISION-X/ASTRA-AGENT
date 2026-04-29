import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowCapabilityRosterBoundaryPolicySchema, ShowCapabilityRosterInputSchema, ShowCapabilityRosterOutputSchema, ShowCapabilityRosterProofPolicySchema, ShowCapabilityRosterReadinessSchema } from "./schema.js";

export const SHOW_CAPABILITY_ROSTER_CHILD_ID = "show-capability-roster";

export const SHOW_CAPABILITY_ROSTER_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_CAPABILITY_ROSTER_CHILD_ID,
  childKind: "read",
  purpose: "Return the governed ability-group roster for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "capability-health-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 3000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowCapabilityRosterBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "capability-health-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 3000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "capability-health-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["runtime-event"],
  }),
  proofPolicy: ShowCapabilityRosterProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowCapabilityRosterReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowCapabilityRosterInput = z.infer<typeof ShowCapabilityRosterInputSchema>;
export type ShowCapabilityRosterOutput = z.infer<typeof ShowCapabilityRosterOutputSchema>;