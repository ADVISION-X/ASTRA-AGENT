import { z } from "zod";

import { StructuredRuntimeEventSchema, StructuredRuntimeSnapshotSummarySchema } from "../../../../types/structured-log.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsRuntimeSnapshotPayloadSchema = z.object({
  snapshotEvent: StructuredRuntimeEventSchema,
  snapshotSummary: StructuredRuntimeSnapshotSummarySchema.optional(),
});

export const UpdateRuntimeSnapshotInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("update-runtime-snapshot"),
  recordType: z.literal("runtime_snapshot"),
  payload: ForensicsRuntimeSnapshotPayloadSchema,
});

export const UpdateRuntimeSnapshotOutputSchema = ForensicsPersistedOutputSchema;
