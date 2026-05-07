import { z } from "zod";

import { RequestedPlatformIdSchema } from "../schema/platform-id.schema.js";

const NonEmptyStringListSchema = z.array(z.string().min(1)).min(1);
const OptionalStringSchema = z.string().min(1).nullable().default(null);

const MapAuthoringRunLimitSchema = z.object({
  maxRounds: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
}).strict();

const MapAuthoringBinaryOutcomeOptionSchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  routeLabel: z.string().min(1),
  description: z.string().min(1),
}).strict();

const MapAuthoringBinaryOutcomePolicySchema = z.object({
  positiveDecision: z.literal("product_yes"),
  negativeDecision: z.literal("product_no"),
  positiveOutcomeOptions: z.array(MapAuthoringBinaryOutcomeOptionSchema).min(1),
  negativeOutcomeOptions: z.array(MapAuthoringBinaryOutcomeOptionSchema).min(1),
  selectedPositiveOutcomeId: z.string().min(1),
  selectedNegativeOutcomeId: z.string().min(1),
  selectedPositiveRouteLabel: z.string().min(1),
  selectedNegativeRouteLabel: z.string().min(1),
  defaultedBySystem: z.boolean(),
}).strict().superRefine((value, context) => {
  const positive = value.positiveOutcomeOptions.find((option) => option.optionId === value.selectedPositiveOutcomeId);
  const negative = value.negativeOutcomeOptions.find((option) => option.optionId === value.selectedNegativeOutcomeId);
  if (!positive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedPositiveOutcomeId must reference positiveOutcomeOptions.",
      path: ["selectedPositiveOutcomeId"],
    });
  } else if (positive.routeLabel !== value.selectedPositiveRouteLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedPositiveRouteLabel must match the selected positive option routeLabel.",
      path: ["selectedPositiveRouteLabel"],
    });
  }
  if (!negative) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedNegativeOutcomeId must reference negativeOutcomeOptions.",
      path: ["selectedNegativeOutcomeId"],
    });
  } else if (negative.routeLabel !== value.selectedNegativeRouteLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedNegativeRouteLabel must match the selected negative option routeLabel.",
      path: ["selectedNegativeRouteLabel"],
    });
  }
});

const MapAuthoringPolicyDescriptorSchema = z.object({
  policyRef: z.string().min(1),
  summary: z.string().min(1),
  rules: NonEmptyStringListSchema,
}).strict();

const MapAuthoringRateLimitSchema = z.object({
  maxActionsPerMinute: z.number().int().positive(),
  burstLimit: z.number().int().positive(),
  refillPolicy: z.string().min(1),
}).strict();

const MapAuthoringUserRequirementSchema = z.object({
  goal: z.string().min(1),
  targetPlatform: RequestedPlatformIdSchema,
  allowedAutomationScope: NonEmptyStringListSchema,
  mustAskBefore: z.array(z.string().min(1)).default([]),
  failureHandlingPreference: OptionalStringSchema,
  evidencePreference: OptionalStringSchema,
  binaryOutcomePolicy: MapAuthoringBinaryOutcomePolicySchema,
  runLimit: MapAuthoringRunLimitSchema.nullable().default(null),
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict();

const MapAuthoringCapabilityChildSchema = z.object({
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
  requiresAutomationGate: z.boolean(),
  sensitiveOperation: z.boolean(),
  sideEffectLevel: z.enum(["none", "read", "write", "submit", "delete", "purchase"]),
  allowedStepKinds: NonEmptyStringListSchema,
  supportedTargetKinds: z.array(z.string().min(1)).default([]),
  forbiddenResponsibilities: NonEmptyStringListSchema,
  proofRequirements: NonEmptyStringListSchema,
  failureModes: NonEmptyStringListSchema,
}).strict();

const MapAuthoringCapabilityGroupSchema = z.object({
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

const MapAuthoringCapabilityCatalogSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
  generatedFrom: z.string().min(1),
  activeAbilityGroupCount: z.literal(14),
  abilityGroups: z.array(MapAuthoringCapabilityGroupSchema).length(14),
  mapRoutableChildren: z.array(MapAuthoringCapabilityChildSchema).min(1),
  runtimeOnlyOwners: z.array(z.string().min(1)).min(1),
  authoringVisibilityPolicy: z.object({
    abilityTruthSource: z.literal("capabilityCatalog.abilityGroups"),
    routableStepSource: z.literal("capabilityCatalog.mapRoutableChildren"),
    aiMustNotInvent: z.literal(true),
  }).strict(),
}).strict();

const MapAuthoringPromptContractCatalogEntrySchema = z.object({
  promptContractId: z.string().min(1),
  promptContractVersion: z.string().min(1),
  promptHash: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  promptContractHash: z.string().min(1).optional(),
  systemPromptTemplateHash: z.string().min(1).optional(),
  userPromptTemplateHash: z.string().min(1).optional(),
  allowedInputRefs: z.array(z.string().min(1)).default([]),
  dataPolicy: MapAuthoringPolicyDescriptorSchema,
  providerPolicy: MapAuthoringPolicyDescriptorSchema,
  binaryDecisionPolicy: MapAuthoringPolicyDescriptorSchema,
  redactionPolicy: MapAuthoringPolicyDescriptorSchema,
  forensicsPolicy: MapAuthoringPolicyDescriptorSchema,
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
  branchableOutputFields: z.array(z.string().min(1)).default([]),
}).strict();

const MapAuthoringPromptContractCatalogSchema = z.object({
  version: z.string().min(1),
  entries: z.array(MapAuthoringPromptContractCatalogEntrySchema).min(1),
}).strict();

const MapAuthoringOutputSchemaCatalogEntrySchema = z.object({
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

const MapAuthoringOutputSchemaCatalogSchema = z.object({
  version: z.string().min(1),
  entries: z.array(MapAuthoringOutputSchemaCatalogEntrySchema).min(1),
}).strict();

const MapAuthoringMapPackageSchemaDescriptorSchema = z.object({
  schemaRef: z.string().min(1),
  schemaVersion: z.string().min(1),
  requiredSections: NonEmptyStringListSchema,
  requiredManifestFields: NonEmptyStringListSchema,
  requiredStepFields: NonEmptyStringListSchema,
  draftOnlyFields: NonEmptyStringListSchema,
  activationFields: NonEmptyStringListSchema,
  forbiddenFields: NonEmptyStringListSchema,
}).strict();

const MapAuthoringOutputSchemaDescriptorSchema = z.object({
  schemaRef: z.string().min(1),
  schemaVersion: z.string().min(1),
  requiredTopLevelFields: NonEmptyStringListSchema,
  draftStatusValues: NonEmptyStringListSchema,
  forbiddenFields: NonEmptyStringListSchema,
}).strict();

const MapAuthoringPlatformProfileSchema = z.object({
  platformProfileRef: z.string().min(1),
  targetPlatformId: RequestedPlatformIdSchema,
  loginAuthExpectations: NonEmptyStringListSchema,
  prohibitedOperations: z.array(z.string().min(1)).default([]),
  supportedTargets: NonEmptyStringListSchema,
  rateLimit: MapAuthoringRateLimitSchema,
  safetyPauseConditions: NonEmptyStringListSchema,
  securityCheckBehavior: NonEmptyStringListSchema,
  automationGateRules: NonEmptyStringListSchema,
}).strict();

const MapAuthoringExampleMapSchema = z.object({
  mapId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  displayName: z.string().min(1),
  summary: z.string().min(1),
  exampleOnly: z.literal(true),
}).strict();

const MapAuthoringValidationPolicySchema = z.object({
  policyRef: z.string().min(1),
  blockedOnMissingInputs: z.literal(true),
  blockedOnUnknownCatalogRefs: z.literal(true),
  blockedOnPolicyDrift: z.literal(true),
  draftOnlyStatuses: NonEmptyStringListSchema,
}).strict();

const MapAuthoringInputPackageSchema = z.object({
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
  automationGatePolicy: MapAuthoringPolicyDescriptorSchema,
  evidencePolicy: MapAuthoringPolicyDescriptorSchema,
  pavPolicy: MapAuthoringPolicyDescriptorSchema,
  forensicsPolicy: MapAuthoringPolicyDescriptorSchema,
  privacyPolicy: MapAuthoringPolicyDescriptorSchema,
  secretPolicy: MapAuthoringPolicyDescriptorSchema,
  rateLimitPolicy: MapAuthoringPolicyDescriptorSchema,
  exampleMaps: z.array(MapAuthoringExampleMapSchema),
  exampleMapsVersion: z.string().min(1),
  exampleMapsSourceRef: z.string().min(1),
  validationPolicy: MapAuthoringValidationPolicySchema,
  expectedDraftStatus: z.literal("draft"),
}).strict();

type MapAuthoringPolicyDescriptor = z.output<typeof MapAuthoringPolicyDescriptorSchema>;
type MapAuthoringCapabilityChild = z.output<typeof MapAuthoringCapabilityChildSchema>;
type MapAuthoringCapabilityGroup = z.output<typeof MapAuthoringCapabilityGroupSchema>;
type MapAuthoringOutputSchemaCatalogEntry = z.output<typeof MapAuthoringOutputSchemaCatalogEntrySchema>;
type MapAuthoringInputPackage = z.output<typeof MapAuthoringInputPackageSchema>;

export {
  MapAuthoringRunLimitSchema,
  MapAuthoringBinaryOutcomeOptionSchema,
  MapAuthoringBinaryOutcomePolicySchema,
  MapAuthoringPolicyDescriptorSchema,
  MapAuthoringRateLimitSchema,
  MapAuthoringUserRequirementSchema,
  MapAuthoringCapabilityChildSchema,
  MapAuthoringCapabilityGroupSchema,
  MapAuthoringCapabilityCatalogSchema,
  MapAuthoringPromptContractCatalogEntrySchema,
  MapAuthoringPromptContractCatalogSchema,
  MapAuthoringOutputSchemaCatalogEntrySchema,
  MapAuthoringOutputSchemaCatalogSchema,
  MapAuthoringMapPackageSchemaDescriptorSchema,
  MapAuthoringOutputSchemaDescriptorSchema,
  MapAuthoringPlatformProfileSchema,
  MapAuthoringExampleMapSchema,
  MapAuthoringValidationPolicySchema,
  MapAuthoringInputPackageSchema,
};

export type {
  MapAuthoringPolicyDescriptor,
  MapAuthoringCapabilityChild,
  MapAuthoringCapabilityGroup,
  MapAuthoringOutputSchemaCatalogEntry,
  MapAuthoringInputPackage,
};
