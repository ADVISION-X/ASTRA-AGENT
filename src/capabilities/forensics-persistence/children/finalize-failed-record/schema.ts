import { z } from "zod";

import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundStructuralLogSchema,
} from "../../../../types/evidence-packet.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsFailedRecordPayloadSchema = z.object({
  evidencePacket: ProductDiscoveryEvidencePacketSchema.nullable().default(null),
  browseLedgerEntry: BrowseLedgerEntrySchema.nullable().default(null),
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeFailedRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-failed-record"),
  recordType: z.literal("failed_record"),
  payload: ForensicsFailedRecordPayloadSchema,
});

export const FinalizeFailedRecordOutputSchema = ForensicsPersistedOutputSchema;
