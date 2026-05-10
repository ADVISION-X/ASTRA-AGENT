import { z } from "zod";

import { ForensicsProductLeadRecordPayloadSchema } from "./forensics-storage-types.js";

export const ProductLeadRecordSchema = ForensicsProductLeadRecordPayloadSchema.shape.productLeadRecord.extend({
  recordId: z.string().min(1),
  roundId: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1),
}).strict();

export type ProductLeadRecord = z.infer<typeof ProductLeadRecordSchema>;