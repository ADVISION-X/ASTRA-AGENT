import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  ReviewDecisionInputSchema,
} from "../../shared/commander-schema-base.js";

export const MarkReviewRequiredInputSchema = ReviewDecisionInputSchema.extend({});

export const MarkReviewRequiredOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("mark-review-required"),
  priority: z.literal("normal"),
});

export const MarkReviewRequiredBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("mark-review-required"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(4000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const MarkReviewRequiredProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const MarkReviewRequiredReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});