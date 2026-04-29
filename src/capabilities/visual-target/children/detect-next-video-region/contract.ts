import type { z } from "zod";

import { DetectNextVideoRegionInputSchema, DetectNextVideoRegionResultSchema } from "./schema.js";

export type DetectNextVideoRegionInput = z.output<typeof DetectNextVideoRegionInputSchema>;
export type DetectNextVideoRegionResult = z.output<typeof DetectNextVideoRegionResultSchema>;