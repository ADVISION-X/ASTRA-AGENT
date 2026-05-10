import { z } from "zod";

const PromptContractCatalogEntrySchema = z.object({
  promptContractId: z.string().min(1),
}).passthrough();

const PromptContractCatalogSchema = z.object({
  entries: z.array(PromptContractCatalogEntrySchema),
}).passthrough();

const MapAuthoringInputPackageSchema = z.object({
  inputPackageId: z.string().min(1),
  inputPackageVersion: z.string().min(1),
  capabilityCatalog: z.object({ version: z.string().min(1) }).passthrough(),
  outputSchemaCatalog: z.object({ version: z.string().min(1) }).passthrough(),
  mapPackageSchema: z.object({ schemaVersion: z.string().min(1) }).passthrough(),
  promptContractCatalog: PromptContractCatalogSchema,
}).passthrough();

const MapAuthoringAiOutputSchema = z.object({
  draftPackage: z.record(z.string(), z.unknown()),
  humanReadableExplanation: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiredClarifications: z.array(z.string()),
  riskWarnings: z.array(z.string()),
  validationHints: z.array(z.string()),
  needsCapabilityExpansion: z.boolean(),
  draftStatus: z.enum(["draft_ready", "needs_clarification"]),
}).passthrough();

export {
  MapAuthoringAiOutputSchema,
  MapAuthoringInputPackageSchema,
};