import { z } from "zod";

export const CapabilityCatalogEntrySchema = z.object({
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  description: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  platformId: z.string().min(1).nullable().default(null),
  targetKind: z.string().min(1).nullable().default(null),
  supportedTargets: z.array(z.string().min(1)).default([]),
  routableByMap: z.boolean(),
  requiresPostOpenWindowHandoff: z.boolean().default(false),
  requiresGeometryProof: z.boolean(),
  requiresPostActionVerification: z.boolean(),
  requiresAutomationGate: z.boolean(),
  sensitiveOperation: z.boolean(),
  forbiddenResponsibilities: z.array(z.string().min(1)).default([]),
}).strict();

export const CapabilityCatalogDocumentSchema = z.object({
  version: z.string().min(1),
  generatedFrom: z.string().min(1),
  entries: z.array(CapabilityCatalogEntrySchema),
}).strict();

export type CapabilityCatalogEntry = z.output<typeof CapabilityCatalogEntrySchema>;
export type CapabilityCatalogDocument = z.output<typeof CapabilityCatalogDocumentSchema>;
