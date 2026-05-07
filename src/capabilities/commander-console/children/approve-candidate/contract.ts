import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ApproveCandidateBoundaryPolicySchema, ApproveCandidateInputSchema, ApproveCandidateOutputSchema, ApproveCandidateProofPolicySchema, ApproveCandidateReadinessSchema } from "./schema.js";

export const APPROVE_CANDIDATE_CHILD_ID = "approve-candidate";

export const APPROVE_CANDIDATE_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: APPROVE_CANDIDATE_CHILD_ID,
  childKind: "command",
  purpose: "Emit a governed approve-candidate review command for a candidate record.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "approve-candidate",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: ApproveCandidateBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "approve-candidate",
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
  proofPolicy: ApproveCandidateProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: ApproveCandidateReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type ApproveCandidateInput = z.infer<typeof ApproveCandidateInputSchema>;
export type ApproveCandidateOutput = z.infer<typeof ApproveCandidateOutputSchema>;