import type { z } from "zod";

import { ScrollRegionInputSchema, ScrollRegionResultSchema } from "../../schema.js";

export type ScrollRegionInput = z.output<typeof ScrollRegionInputSchema>;
export type ScrollRegionResult = z.output<typeof ScrollRegionResultSchema>;