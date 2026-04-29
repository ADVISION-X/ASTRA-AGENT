import type { z } from "zod";

import { DetectSaveButtonInputSchema, DetectSaveButtonResultSchema } from "./schema.js";

export type DetectSaveButtonInput = z.output<typeof DetectSaveButtonInputSchema>;
export type DetectSaveButtonResult = z.output<typeof DetectSaveButtonResultSchema>;