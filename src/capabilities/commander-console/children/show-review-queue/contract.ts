import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowReviewQueueBoundaryPolicySchema, ShowReviewQueueInputSchema, ShowReviewQueueOutputSchema, ShowReviewQueueProofPolicySchema, ShowReviewQueueReadinessSchema } from "./schema.js";

export const SHOW_REVIEW_QUEUE_CHILD_ID = "show-review-queue";

export const SHOW_REVIEW_QUEUE_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_REVIEW_QUEUE_CHILD_ID,
  childKind: "read",
  purpose: "Return the governed review queue for Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "forensics-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 3000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowReviewQueueBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "forensics-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 3000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "forensics-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["candidate"],
  }),
  proofPolicy: ShowReviewQueueProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowReviewQueueReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowReviewQueueInput = z.infer<typeof ShowReviewQueueInputSchema>;
export type ShowReviewQueueOutput = z.infer<typeof ShowReviewQueueOutputSchema>;