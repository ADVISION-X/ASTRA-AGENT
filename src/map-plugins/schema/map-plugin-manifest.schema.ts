import { z } from "zod";

import { MAP_PACKAGE_APPROVAL_STATUSES } from "../shared/map-package-status.js";

export const MapPluginManifestSchema = z.object({
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
}).strict().superRefine((manifest, context) => {
  if (!manifest.aiGenerated) {
    return;
  }

  const requiredFields: Array<keyof typeof manifest> = [
    "authoringPromptRef",
    "authoringModelRef",
    "capabilityCatalogVersion",
    "promptCatalogVersion"
  ];

  for (const fieldName of requiredFields) {
    if (manifest[fieldName] === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldName],
        message: `${fieldName} is required when manifest.aiGenerated is true.`
      });
    }
  }

  if (manifest.approvalStatus === "approved" && manifest.humanApprovalRef === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["humanApprovalRef"],
      message: "humanApprovalRef is required when an AI-generated map is approved."
    });
  }
});
