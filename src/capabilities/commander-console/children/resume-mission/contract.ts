import type { z } from "zod";

import { ResumeMissionInputSchema, ResumeMissionOutputSchema } from "./schema.js";

export type ResumeMissionInput = z.infer<typeof ResumeMissionInputSchema>;
export type ResumeMissionOutput = z.infer<typeof ResumeMissionOutputSchema>;