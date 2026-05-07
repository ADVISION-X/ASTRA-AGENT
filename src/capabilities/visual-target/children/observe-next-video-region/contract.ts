import type { z } from "zod";

import { ObserveNextVideoRegionInputSchema, ObserveNextVideoRegionResultSchema } from "./schema.js";

export type ObserveNextVideoRegionInput = z.output<typeof ObserveNextVideoRegionInputSchema>;
export type ObserveNextVideoRegionResult = z.output<typeof ObserveNextVideoRegionResultSchema>;