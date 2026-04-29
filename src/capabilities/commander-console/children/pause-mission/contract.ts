import type { z } from "zod";

import { PauseMissionInputSchema, PauseMissionOutputSchema } from "./schema.js";

export type PauseMissionInput = z.infer<typeof PauseMissionInputSchema>;
export type PauseMissionOutput = z.infer<typeof PauseMissionOutputSchema>;