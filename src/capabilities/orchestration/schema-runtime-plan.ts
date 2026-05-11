import { z } from "zod";

const OrchestrationRequestedPlatformIdSchemaSource = z.enum([
  "facebook-web",
  "tiktok-web",
  "macos-local",
  "iphone-mirroring-facebook-app",
  "iphone-mirroring-tiktok-app",
]);

const OrchestrationAllowedAbilityGroupIdSchemaSource = z.enum([
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "forensics-persistence",
  "page-state",
]);

const OrchestrationPayloadRefKeySchemaSource = z.string().min(1);
const OrchestrationStepKindSchemaSource = z.string().min(1);
const OrchestrationTransitionStatusSchemaSource = z.enum(["success", "failed", "review_required", "pending"]);

const OrchestrationRuntimePlanStepSchemaSource = z.object({
  stepId: z.string().min(1),
  kind: OrchestrationStepKindSchemaSource,
  targetAbilityGroupId: OrchestrationAllowedAbilityGroupIdSchemaSource.nullable().optional().default(null),
  childCapabilityId: z.string().min(1).nullable().optional().default(null),
  promptContractId: z.string().min(1).nullable().optional().default(null),
  inputRefs: z.array(z.string().min(1)).default([]),
}).passthrough();

const OrchestrationTransitionSchemaSource = z.object({
  transitionId: z.string().min(1),
  fromStepId: z.string().min(1),
  toStepId: z.string().min(1),
  status: OrchestrationTransitionStatusSchemaSource.optional().default("success"),
}).passthrough();

const OrchestrationRuntimePlanSchemaSource = z.object({
  mapId: z.string().min(1),
  requestedPlatformId: OrchestrationRequestedPlatformIdSchemaSource.nullable().optional().default(null),
  initialStepId: z.string().min(1),
  steps: z.array(OrchestrationRuntimePlanStepSchemaSource),
  transitions: z.array(OrchestrationTransitionSchemaSource).default([]),
  sequencePolicy: z.object({
    maxHops: z.number().int().positive(),
    maxRetriesPerStep: z.number().int().nonnegative(),
    loopDecisionOnLimit: z.literal("failed"),
    branchPolicy: z.literal("strict"),
  }).passthrough(),
  proofPolicy: z.object({
    requiresRuntimeProof: z.literal(true),
  }).passthrough(),
}).passthrough();

export {
  OrchestrationRequestedPlatformIdSchemaSource,
  OrchestrationAllowedAbilityGroupIdSchemaSource,
  OrchestrationPayloadRefKeySchemaSource,
  OrchestrationStepKindSchemaSource,
  OrchestrationTransitionStatusSchemaSource,
  OrchestrationRuntimePlanStepSchemaSource,
  OrchestrationTransitionSchemaSource,
  OrchestrationRuntimePlanSchemaSource,
};