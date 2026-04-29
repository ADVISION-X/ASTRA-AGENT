import type { z } from "zod";

import { DetectCommentsButtonInputSchema, DetectCommentsButtonResultSchema } from "./schema.js";

export type DetectCommentsButtonInput = z.output<typeof DetectCommentsButtonInputSchema>;
export type DetectCommentsButtonResult = z.output<typeof DetectCommentsButtonResultSchema>;