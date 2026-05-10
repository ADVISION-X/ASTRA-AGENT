import { z } from "zod";

const FailurePolicySchema = z.enum(["continue", "stop", "review_required"]);

const MuscleMemoryInputContractSchema = z.object({
  requiredFields: z.array(z.string().min(1)).default([]),
  optionalFields: z.array(z.string().min(1)).default([]),
  forbiddenFields: z.array(z.string().min(1)).default([]),
}).strict();

const AtomicMuscleMemoryEntrySchema = z.object({
  actionCode: z.string().min(1),
  type: z.literal("atomic"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  allowedForAiActionPlan: z.boolean(),
  allowedForUserRequirement: z.boolean(),
  requiresGridSpecRef: z.boolean(),
  requiresScreenshotRef: z.boolean(),
  requiresPageStateRef: z.boolean(),
  requiresGeometryProof: z.boolean(),
  requiresPostActionVerification: z.boolean(),
  sensitiveOperation: z.boolean(),
  inputContract: MuscleMemoryInputContractSchema,
  successOutputRefs: z.array(z.string().min(1)).default([]),
  failurePolicy: FailurePolicySchema,
  forbiddenResponsibilities: z.array(z.string().min(1)).default([]),
}).strict();

const CompositeMuscleMemoryStepSchema = z.object({
  stepCode: z.string().min(1),
  actionCode: z.string().min(1),
  inputMapping: z.record(z.string().min(1)).optional(),
  required: z.boolean(),
  onFailure: FailurePolicySchema,
}).strict();

const CompositeMuscleMemoryEntrySchema = z.object({
  actionCode: z.string().min(1),
  type: z.literal("composite"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  allowedForAiActionPlan: z.boolean(),
  allowedForUserRequirement: z.boolean(),
  sensitiveOperation: z.boolean(),
  steps: z.array(CompositeMuscleMemoryStepSchema).min(1),
  maxExpansionDepth: z.number().int().positive(),
  successOutputRefs: z.array(z.string().min(1)).default([]),
  failurePolicy: FailurePolicySchema,
}).strict();

const MuscleMemoryEntrySchema = z.union([
  AtomicMuscleMemoryEntrySchema,
  CompositeMuscleMemoryEntrySchema,
]);

const MuscleMemoryCatalogSchema = z.object({
  catalogId: z.literal("grasseye-muscle-memory-catalog"),
  catalogVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  entries: z.array(MuscleMemoryEntrySchema).min(1),
}).strict();

type MuscleMemoryInputContract = z.infer<typeof MuscleMemoryInputContractSchema>;
type AtomicMuscleMemoryEntry = z.infer<typeof AtomicMuscleMemoryEntrySchema>;
type CompositeMuscleMemoryStep = z.infer<typeof CompositeMuscleMemoryStepSchema>;
type CompositeMuscleMemoryEntry = z.infer<typeof CompositeMuscleMemoryEntrySchema>;
type MuscleMemoryEntry = z.infer<typeof MuscleMemoryEntrySchema>;
type MuscleMemoryCatalog = z.infer<typeof MuscleMemoryCatalogSchema>;
type FailurePolicy = z.infer<typeof FailurePolicySchema>;

export {
  FailurePolicySchema,
  MuscleMemoryInputContractSchema,
  AtomicMuscleMemoryEntrySchema,
  CompositeMuscleMemoryStepSchema,
  CompositeMuscleMemoryEntrySchema,
  MuscleMemoryEntrySchema,
  MuscleMemoryCatalogSchema,
};

export type {
  FailurePolicy,
  MuscleMemoryInputContract,
  AtomicMuscleMemoryEntry,
  CompositeMuscleMemoryStep,
  CompositeMuscleMemoryEntry,
  MuscleMemoryEntry,
  MuscleMemoryCatalog,
};