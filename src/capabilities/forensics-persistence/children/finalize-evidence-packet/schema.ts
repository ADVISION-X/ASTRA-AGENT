import { z } from "zod";

import { ProductDiscoveryEvidencePacketSchema, RoundStructuralLogSchema } from "../../../../types/evidence-packet.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsEvidencePacketPayloadSchema = z.object({
  evidencePacket: ProductDiscoveryEvidencePacketSchema,
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeEvidencePacketInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-evidence-packet"),
  recordType: z.literal("evidence_packet"),
  payload: ForensicsEvidencePacketPayloadSchema,
});

export const FinalizeEvidencePacketOutputSchema = ForensicsPersistedOutputSchema;
