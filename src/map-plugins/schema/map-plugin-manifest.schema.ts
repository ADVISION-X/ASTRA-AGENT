import { z } from "zod";

import { MAP_PACKAGE_ACTIVATION_GATE_STATUSES } from "../shared/map-package-status.js";

const APPROVED_REQUIRED_FIELDS = [
  "capabilityCatalogVersion",
  "promptCatalogVersion",
  "validationReportRef",
  "automationGateRef",
] as const;

const AI_GENERATED_REQUIRED_FIELDS = [
  "authoringPromptRef",
  "authoringModelRef",
  "authoringRunId",
  "userRequirementRef",
  "sourceRequirementHash",
  "providerPolicyRef",
  "promptContractId",
  "promptContractVersion",
  "promptHash",
  "capabilityCatalogVersion",
  "promptCatalogVersion",
  "mapPackageSchemaVersion",
  "securityPolicyRef",
  "outputFormatVersion",
  "generatedAt",
  "authoringProofRef",
] as const;

const addManifestIssue = (context: z.RefinementCtx, path: string, message: string): void => {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  });
};

const MapPluginManifestBaseSchema = z.object({
  packageId: z.string().min(1),
  packageKind: z.literal("operational-map-package"),
  packageVersion: z.string().min(1),
  mapId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  displayName: z.string().min(1),
  author: z.string().min(1),
  createdAt: z.string().datetime(),
  minimumGrassEyeVersion: z.string().min(1),
  mapSchemaVersion: z.string().min(1),
  activationGateStatus: z.enum(MAP_PACKAGE_ACTIVATION_GATE_STATUSES),
  aiGenerated: z.boolean().default(false),
  authoringPromptRef: z.string().min(1).nullable().default(null),
  authoringModelRef: z.string().min(1).nullable().default(null),
  authoringRunId: z.string().min(1).nullable().default(null),
  userRequirementRef: z.string().min(1).nullable().default(null),
  sourceRequirementHash: z.string().min(1).nullable().default(null),
  providerPolicyRef: z.string().min(1).nullable().default(null),
  promptContractId: z.string().min(1).nullable().default(null),
  promptContractVersion: z.string().min(1).nullable().default(null),
  promptHash: z.string().min(1).nullable().default(null),
  capabilityCatalogVersion: z.string().min(1).nullable().default(null),
  promptCatalogVersion: z.string().min(1).nullable().default(null),
  mapPackageSchemaVersion: z.string().min(1).nullable().default(null),
  securityPolicyRef: z.string().min(1).nullable().default(null),
  outputFormatVersion: z.string().min(1).nullable().default(null),
  generatedAt: z.string().datetime().nullable().default(null),
  authoringProofRef: z.string().min(1).nullable().default(null),
  validationReportRef: z.string().min(1).nullable().default(null),
  automationGateRef: z.string().min(1).nullable().default(null)
}).strict();

type MapPluginManifestValue = z.input<typeof MapPluginManifestBaseSchema>;

function validateApprovedManifest(manifest: MapPluginManifestValue, context: z.RefinementCtx): void {
  if (manifest.activationGateStatus !== "gate_passed") {
    return;
  }

  for (const fieldName of APPROVED_REQUIRED_FIELDS) {
    if (manifest[fieldName] === null) {
      addManifestIssue(context, fieldName, `${fieldName} is required when activationGateStatus is gate_passed.`);
    }
  }
}

function validateAiGeneratedManifest(manifest: MapPluginManifestValue, context: z.RefinementCtx): void {
  if (!manifest.aiGenerated) {
    return;
  }

  for (const fieldName of AI_GENERATED_REQUIRED_FIELDS) {
    if (manifest[fieldName] === null) {
      addManifestIssue(context, fieldName, `${fieldName} is required when manifest.aiGenerated is true.`);
    }
  }

  if (manifest.activationGateStatus === "gate_passed" && manifest.automationGateRef === null) {
    addManifestIssue(context, "automationGateRef", "automationGateRef is required when an AI-generated map passed the automation gate.");
  }
}

export const MapPluginManifestSchema = MapPluginManifestBaseSchema.superRefine((manifest, context) => {
  validateApprovedManifest(manifest, context);
  validateAiGeneratedManifest(manifest, context);
});
