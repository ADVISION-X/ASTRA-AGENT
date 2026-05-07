import { z } from "zod";

import {
  CommanderBoundaryPolicySchema,
  CommanderCommandReceiptSchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
  ReviewDecisionInputSchema,
} from "../../shared/commander-schema-base.js";

export const ApproveCandidateInputSchema = ReviewDecisionInputSchema.extend({});

export const ApproveCandidateOutputSchema = CommanderCommandReceiptSchema.extend({
  commandType: z.literal("approve-candidate"),
  priority: z.literal("normal"),
});

export const ApproveCandidateBoundaryPolicySchema = CommanderBoundaryPolicySchema.extend({
  boundaryDecision: z.literal("command-transport-only"),
  ownedCommandType: z.literal("approve-candidate"),
  readModelSource: z.null(),
  hardStopPriority: z.null(),
  maxDurationMs: z.literal(60_000),
  idempotencyPolicy: z.literal("dedupe-command"),
});

export const ApproveCandidateProofPolicySchema = CommanderProofPolicySchema.extend({
  requiresGovernedReceipt: z.literal(true),
  requiresFailureReceipt: z.literal(true),
  requiresTransportDecision: z.literal(true),
  requiresReadDecision: z.literal(false),
  requiresHardStopDecision: z.literal(false),
});

export const ApproveCandidateReadinessSchema = CommanderReadinessSchema.extend({
  requiresCommandTransport: z.literal(true),
  requiresReadModel: z.literal(false),
  requiresHardPath: z.literal(false),
});