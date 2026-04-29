import type { z } from "zod";

import type { CommanderCommandChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { MarkReviewRequiredBoundaryPolicySchema, MarkReviewRequiredInputSchema, MarkReviewRequiredOutputSchema, MarkReviewRequiredProofPolicySchema, MarkReviewRequiredReadinessSchema } from "./schema.js";

export const MARK_REVIEW_REQUIRED_CHILD_ID = "mark-review-required";

export const MARK_REVIEW_REQUIRED_CONTRACT: CommanderCommandChildContract = {
  childCapabilityId: MARK_REVIEW_REQUIRED_CHILD_ID,
  childKind: "command",
  purpose: "Emit a governed mark-review-required command for a candidate record.",
  allowedCaller: "commander-console",
  boundaryDecision: "command-transport-only",
  ownedCommandType: "mark-review-required",
  readModelSource: null,
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 4000,
  idempotencyPolicy: "dedupe-command",
  boundaryPolicy: MarkReviewRequiredBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "command-transport-only",
    ownedCommandType: "mark-review-required",
    readModelSource: null,
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 4000,
    idempotencyPolicy: "dedupe-command",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "command-transport",
    targetRecordRequired: true,
    proofRefRequired: false,
    recordTypes: ["candidate"],
  }),
  proofPolicy: MarkReviewRequiredProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: true,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: true,
    requiresTransportDecision: true,
    requiresReadDecision: false,
    requiresHardStopDecision: false,
  }),
  readiness: MarkReviewRequiredReadinessSchema.parse({
    requiresCommandTransport: true,
    requiresReadModel: false,
    requiresHardPath: false,
  }),
};

export type MarkReviewRequiredInput = z.infer<typeof MarkReviewRequiredInputSchema>;
export type MarkReviewRequiredOutput = z.infer<typeof MarkReviewRequiredOutputSchema>;