import { z } from "zod";

export const MapPluginOrchestrationSequencePolicySchema = z.object({
  maxHops: z.number().int().positive(),
  maxRetriesPerStep: z.number().int().nonnegative(),
  loopDecisionOnLimit: z.enum(["failed", "review_required"]),
  branchPolicy: z.enum(["strict", "allow_review_handoff"]),
}).strict();

export const MapPluginProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
}).strict();
