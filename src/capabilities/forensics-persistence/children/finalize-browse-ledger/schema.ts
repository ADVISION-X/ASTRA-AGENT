import { z } from "zod";

import { BrowseLedgerEntrySchema } from "../../../../types/evidence-packet.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsBrowseLedgerPayloadSchema = z.object({
  browseLedgerEntry: ForensicsPlainObjectSchema,
  roundStructuralLog: ForensicsPlainObjectSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeBrowseLedgerInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-browse-ledger"),
  recordType: z.literal("browse_ledger_entry"),
  decisionRef: z.string().min(1),
  payload: ForensicsBrowseLedgerPayloadSchema,
});

export const FinalizeBrowseLedgerOutputSchema = ForensicsPersistedOutputSchema;
