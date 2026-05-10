import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

const ProductLeadDecisionSchema = z.enum(["product_yes", "product_no"]);

export const ForensicsProductLeadRecordPayloadSchema = z.object({
  productLeadRecord: z.object({
    platformId: z.string().min(1),
    targetUrl: z.string().min(1),
    targetTitle: z.string().min(1),
    screenshotEvidenceRef: z.string().min(1),
    productPresenceAiResultRef: z.string().min(1),
    decision: ProductLeadDecisionSchema,
    taskDecision: z.string().min(1),
    actionCodes: z.array(z.string().min(1)).min(1),
    confidence: z.number().min(0).max(1),
    visibleProductTypes: z.array(z.string().min(1)).default([]),
    reason: z.string().min(1),
    capturedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    runId: z.string().min(1),
    missionId: z.string().min(1),
  }).strict(),
}).strict();

export const WriteProductLeadRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-product-lead-record"),
  recordType: z.literal("product_lead_record"),
  payload: ForensicsProductLeadRecordPayloadSchema,
});

export const WriteProductLeadRecordOutputSchema = ForensicsPersistedOutputSchema;