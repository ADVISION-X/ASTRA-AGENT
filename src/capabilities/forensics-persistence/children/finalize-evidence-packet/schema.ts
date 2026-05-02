import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsEvidencePacketPayloadSchema = z.object({
  evidencePacket: ForensicsPlainObjectSchema,
  roundStructuralLog: ForensicsPlainObjectSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeEvidencePacketInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-evidence-packet"),
  recordType: z.literal("evidence_packet"),
  decisionRef: z.string().min(1),
  payload: ForensicsEvidencePacketPayloadSchema,
});

export const FinalizeEvidencePacketOutputSchema = ForensicsPersistedOutputSchema;
