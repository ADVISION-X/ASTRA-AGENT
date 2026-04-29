import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowRuntimeProofTimelineBoundaryPolicySchema, ShowRuntimeProofTimelineInputSchema, ShowRuntimeProofTimelineOutputSchema, ShowRuntimeProofTimelineProofPolicySchema, ShowRuntimeProofTimelineReadinessSchema } from "./schema.js";

export const SHOW_RUNTIME_PROOF_TIMELINE_CHILD_ID = "show-runtime-proof-timeline";

export const SHOW_RUNTIME_PROOF_TIMELINE_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_RUNTIME_PROOF_TIMELINE_CHILD_ID,
  childKind: "read",
  purpose: "Return a governed runtime-proof timeline for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "runtime-proof-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 3000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowRuntimeProofTimelineBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "runtime-proof-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 3000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "runtime-proof-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["runtime-event"],
  }),
  proofPolicy: ShowRuntimeProofTimelineProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowRuntimeProofTimelineReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowRuntimeProofTimelineInput = z.infer<typeof ShowRuntimeProofTimelineInputSchema>;
export type ShowRuntimeProofTimelineOutput = z.infer<typeof ShowRuntimeProofTimelineOutputSchema>;