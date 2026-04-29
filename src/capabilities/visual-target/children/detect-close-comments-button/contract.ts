import type { z } from "zod";

import { DetectCloseCommentsButtonInputSchema, DetectCloseCommentsButtonResultSchema } from "./schema.js";

export type DetectCloseCommentsButtonInput = z.output<typeof DetectCloseCommentsButtonInputSchema>;
export type DetectCloseCommentsButtonResult = z.output<typeof DetectCloseCommentsButtonResultSchema>;