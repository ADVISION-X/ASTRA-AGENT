import { z } from "zod";

import { BrowseLedgerEntrySchema, RoundStructuralLogSchema } from "../../../../types/evidence-packet.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsBrowseLedgerPayloadSchema = z.object({
  browseLedgerEntry: BrowseLedgerEntrySchema,
  roundStructuralLog: RoundStructuralLogSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeBrowseLedgerInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-browse-ledger"),
  recordType: z.literal("browse_ledger_entry"),
  payload: ForensicsBrowseLedgerPayloadSchema,
});

export const FinalizeBrowseLedgerOutputSchema = ForensicsPersistedOutputSchema;
