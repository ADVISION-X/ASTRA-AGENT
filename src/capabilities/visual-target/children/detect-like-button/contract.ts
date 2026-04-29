import type { z } from "zod";

import { DetectLikeButtonInputSchema, DetectLikeButtonResultSchema } from "./schema.js";

export type DetectLikeButtonInput = z.output<typeof DetectLikeButtonInputSchema>;
export type DetectLikeButtonResult = z.output<typeof DetectLikeButtonResultSchema>;