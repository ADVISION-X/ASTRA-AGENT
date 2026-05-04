import { z } from "zod";

import { RequestedPlatformIdSchema } from "../schema/platform-id.schema.js";

const NonEmptyStringListSchema = z.array(z.string().min(1)).min(1);
const OptionalStringSchema = z.string().min(1).nullable().default(null);

export const MapAuthoringRunLimitSchema = z.object({
  maxRounds: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
}).strict();

export const MapAuthoringPolicyDescriptorSchema = z.object({
  policyRef: z.string().min(1),
  summary: z.string().min(1),
  rules: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringRateLimitSchema = z.object({
  maxActionsPerMinute: z.number().int().positive(),
  burstLimit: z.number().int().positive(),
  refillPolicy: z.string().min(1),
}).strict();

export const MapAuthoringUserRequirementSchema = z.object({
  goal: z.string().min(1),
  targetPlatform: RequestedPlatformIdSchema,
  allowedAutomationScope: z.string().min(1),
  mustAskBefore: z.array(z.string().min(1)).default([]),
  failureHandlingPreference: OptionalStringSchema,
  evidencePreference: OptionalStringSchema,
  runLimit: MapAuthoringRunLimitSchema.nullable().default(null),
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict();

export const MapAuthoringCapabilityChildSchema = z.object({
  childCapabilityId: z.string().min(1),
  childCapabilityCode: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  requiredInputRefs: z.array(z.string().min(1)).default([]),
  producedOutputRefs: NonEmptyStringListSchema,
  requiresGeometryProof: z.boolean(),
  requiresTargetProof: z.boolean(),
  requiresFocusProof: z.boolean(),
  requiresApprovedText: z.boolean(),
  requiresPostActionVerification: z.boolean(),
  requiresHumanReview: z.boolean(),
  sensitiveOperation: z.boolean(),
  sideEffectLevel: z.enum(["none", "read", "write", "submit", "delete", "purchase"]),
  allowedStepKinds: NonEmptyStringListSchema,
  supportedTargetKinds: z.array(z.string().min(1)).default([]),
  forbiddenResponsibilities: NonEmptyStringListSchema,
  proofRequirements: NonEmptyStringListSchema,
  failureModes: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringCapabilityGroupSchema = z.object({
  abilityGroupId: z.string().min(1),
  abilityGroupCode: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  ownerDomain: z.string().min(1),
  routableByMap: z.boolean(),
  publicContractRef: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  forbiddenResponsibilities: NonEmptyStringListSchema,
  children: z.array(MapAuthoringCapabilityChildSchema).min(1),
}).strict();

export const MapAuthoringCapabilityCatalogSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
  generatedFrom: z.string().min(1),
  abilityGroups: z.array(MapAuthoringCapabilityGroupSchema).min(1),
}).strict();

export const MapAuthoringPromptContractCatalogEntrySchema = z.object({
  promptContractId: z.string().min(1),
  promptContractVersion: z.string().min(1),
  promptHash: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  allowedInputRefs: z.array(z.string().min(1)).default([]),
  dataPolicy: MapAuthoringPolicyDescriptorSchema,
  providerPolicy: MapAuthoringPolicyDescriptorSchema,
  reviewPolicy: MapAuthoringPolicyDescriptorSchema,
  failurePolicy: MapAuthoringPolicyDescriptorSchema,
  redactionPolicy: MapAuthoringPolicyDescriptorSchema,
  forensicsPolicy: MapAuthoringPolicyDescriptorSchema,
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
  branchableOutputFields: z.array(z.string().min(1)).default([]),
}).strict();

export const MapAuthoringPromptContractCatalogSchema = z.object({
  version: z.string().min(1),
  entries: z.array(MapAuthoringPromptContractCatalogEntrySchema).min(1),
}).strict();

export const MapAuthoringOutputSchemaCatalogEntrySchema = z.object({
  outputSchemaRef: z.string().min(1),
  schemaVersion: z.string().min(1),
  declaredFields: NonEmptyStringListSchema,
  branchableFields: z.array(z.string().min(1)).default([]),
  fieldTypes: z.record(z.string().min(1), z.string().min(1)),
  requiredFields: z.array(z.string().min(1)).default([]),
  reviewFields: z.array(z.string().min(1)).default([]),
  confidenceFields: z.array(z.string().min(1)).default([]),
  forbiddenFields: z.array(z.string().min(1)).default([]),
  exampleOutput: z.record(z.string().min(1), z.unknown()).nullable().default(null),
}).strict();

export const MapAuthoringOutputSchemaCatalogSchema = z.object({
  version: z.string().min(1),
  entries: z.array(MapAuthoringOutputSchemaCatalogEntrySchema).min(1),
}).strict();

export const MapAuthoringMapPackageSchemaDescriptorSchema = z.object({
  schemaRef: z.string().min(1),
  schemaVersion: z.string().min(1),
  requiredSections: NonEmptyStringListSchema,
  requiredManifestFields: NonEmptyStringListSchema,
  requiredStepFields: NonEmptyStringListSchema,
  draftOnlyFields: NonEmptyStringListSchema,
  activationFields: NonEmptyStringListSchema,
  forbiddenFields: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringOutputSchemaDescriptorSchema = z.object({
  schemaRef: z.string().min(1),
  schemaVersion: z.string().min(1),
  requiredTopLevelFields: NonEmptyStringListSchema,
  draftStatusValues: NonEmptyStringListSchema,
  forbiddenFields: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringPlatformProfileSchema = z.object({
  platformProfileRef: z.string().min(1),
  targetPlatformId: RequestedPlatformIdSchema,
  loginAuthExpectations: NonEmptyStringListSchema,
  prohibitedOperations: z.array(z.string().min(1)).default([]),
  supportedTargets: NonEmptyStringListSchema,
  rateLimit: MapAuthoringRateLimitSchema,
  safetyPauseConditions: NonEmptyStringListSchema,
  securityCheckBehavior: NonEmptyStringListSchema,
  humanReviewRules: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringExampleMapSchema = z.object({
  mapId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  displayName: z.string().min(1),
  summary: z.string().min(1),
  exampleOnly: z.literal(true),
}).strict();

export const MapAuthoringValidationPolicySchema = z.object({
  policyRef: z.string().min(1),
  blockedOnMissingInputs: z.literal(true),
  blockedOnUnknownCatalogRefs: z.literal(true),
  blockedOnPolicyDrift: z.literal(true),
  draftOnlyStatuses: NonEmptyStringListSchema,
}).strict();

export const MapAuthoringInputPackageSchema = z.object({
  inputPackageId: z.string().min(1),
  inputPackageVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  requesterRef: z.string().min(1),
  userRequirement: MapAuthoringUserRequirementSchema,
  userRequirementRef: z.string().min(1),
  sourceRequirementHash: z.string().min(1),
  targetPlatformProfileRef: z.string().min(1),
  targetPlatformProfile: MapAuthoringPlatformProfileSchema,
  capabilityCatalog: MapAuthoringCapabilityCatalogSchema,
  promptContractCatalog: MapAuthoringPromptContractCatalogSchema,
  outputSchemaCatalog: MapAuthoringOutputSchemaCatalogSchema,
  mapPackageSchema: MapAuthoringMapPackageSchemaDescriptorSchema,
  mapAuthoringOutputSchema: MapAuthoringOutputSchemaDescriptorSchema,
  safetyPolicy: MapAuthoringPolicyDescriptorSchema,
  humanApprovalPolicy: MapAuthoringPolicyDescriptorSchema,
  evidencePolicy: MapAuthoringPolicyDescriptorSchema,
  pavPolicy: MapAuthoringPolicyDescriptorSchema,
  forensicsPolicy: MapAuthoringPolicyDescriptorSchema,
  privacyPolicy: MapAuthoringPolicyDescriptorSchema,
  secretPolicy: MapAuthoringPolicyDescriptorSchema,
  rateLimitPolicy: MapAuthoringPolicyDescriptorSchema,
  exampleMaps: z.array(MapAuthoringExampleMapSchema).optional(),
  validationPolicy: MapAuthoringValidationPolicySchema,
  expectedDraftStatus: z.literal("draft"),
}).strict();

export type MapAuthoringPolicyDescriptor = z.output<typeof MapAuthoringPolicyDescriptorSchema>;
export type MapAuthoringCapabilityChild = z.output<typeof MapAuthoringCapabilityChildSchema>;
export type MapAuthoringCapabilityGroup = z.output<typeof MapAuthoringCapabilityGroupSchema>;
export type MapAuthoringOutputSchemaCatalogEntry = z.output<typeof MapAuthoringOutputSchemaCatalogEntrySchema>;
export type MapAuthoringInputPackage = z.output<typeof MapAuthoringInputPackageSchema>;