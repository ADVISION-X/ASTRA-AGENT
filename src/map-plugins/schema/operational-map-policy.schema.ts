import { z } from "zod";

export const MapPluginOrchestrationSequencePolicySchema = z.object({
  maxHops: z.number().int().positive(),
  maxRetriesPerStep: z.number().int().nonnegative(),
  loopDecisionOnLimit: z.literal("failed"),
  branchPolicy: z.literal("strict"),
}).strict();

export const MapPluginProofPolicySchema = z.object({
  requiresRuntimeProof: z.literal(true),
}).strict();
