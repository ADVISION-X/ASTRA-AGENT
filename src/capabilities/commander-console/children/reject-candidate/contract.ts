import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { RejectCandidateBoundaryPolicySchema, RejectCandidateInputSchema, RejectCandidateOutputSchema, RejectCandidateProofPolicySchema, RejectCandidateReadinessSchema } from "./schema.js";

export const REJECT_CANDIDATE_CHILD_ID = "reject-candidate";

export const REJECT_CANDIDATE_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: REJECT_CANDIDATE_CHILD_ID,
  childKind: "command",
  purpose: "Emit a governed reject-candidate review command for a candidate record.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "reject-candidate",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: RejectCandidateBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "reject-candidate",
    readModelSource: null,
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "dedupe-command",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "command-transport",
    targetRecordRequired: true,
    proofRefRequired: false,
    recordTypes: ["candidate"],
  }),
  proofPolicy: RejectCandidateProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: RejectCandidateReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type RejectCandidateInput = z.infer<typeof RejectCandidateInputSchema>;
export type RejectCandidateOutput = z.infer<typeof RejectCandidateOutputSchema>;