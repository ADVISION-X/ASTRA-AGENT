import { z } from "zod";

import { MAP_PACKAGE_APPROVAL_STATUSES } from "../shared/map-package-status.js";

const APPROVED_REQUIRED_FIELDS = [
  "capabilityCatalogVersion",
  "promptCatalogVersion",
  "validationReportRef",
  "humanApprovalRef",
] as const;

const AI_GENERATED_REQUIRED_FIELDS = [
  "authoringPromptRef",
  "authoringModelRef",
  "capabilityCatalogVersion",
  "promptCatalogVersion",
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
  approvalStatus: z.enum(MAP_PACKAGE_APPROVAL_STATUSES),
  aiGenerated: z.boolean().default(false),
  authoringPromptRef: z.string().min(1).nullable().default(null),
  authoringModelRef: z.string().min(1).nullable().default(null),
  capabilityCatalogVersion: z.string().min(1).nullable().default(null),
  promptCatalogVersion: z.string().min(1).nullable().default(null),
  validationReportRef: z.string().min(1).nullable().default(null),
  humanApprovalRef: z.string().min(1).nullable().default(null)
}).strict();

type MapPluginManifestValue = z.input<typeof MapPluginManifestBaseSchema>;

function validateApprovedManifest(manifest: MapPluginManifestValue, context: z.RefinementCtx): void {
  if (manifest.approvalStatus !== "approved") {
    return;
  }

  for (const fieldName of APPROVED_REQUIRED_FIELDS) {
    if (manifest[fieldName] === null) {
      addManifestIssue(context, fieldName, `${fieldName} is required when approvalStatus is approved.`);
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

  if (manifest.approvalStatus === "approved" && manifest.humanApprovalRef === null) {
    addManifestIssue(context, "humanApprovalRef", "humanApprovalRef is required when an AI-generated map is approved.");
  }
}

export const MapPluginManifestSchema = MapPluginManifestBaseSchema.superRefine((manifest, context) => {
  validateApprovedManifest(manifest, context);
  validateAiGeneratedManifest(manifest, context);
});
