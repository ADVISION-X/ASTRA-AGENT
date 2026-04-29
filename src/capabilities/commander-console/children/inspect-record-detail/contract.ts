import type { z } from "zod";

import { InspectRecordDetailInputSchema, InspectRecordDetailOutputSchema } from "./schema.js";

export type InspectRecordDetailInput = z.infer<typeof InspectRecordDetailInputSchema>;
export type InspectRecordDetailOutput = z.infer<typeof InspectRecordDetailOutputSchema>;