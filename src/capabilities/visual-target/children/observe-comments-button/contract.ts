import type { z } from "zod";

import { ObserveCommentsButtonInputSchema, ObserveCommentsButtonResultSchema } from "./schema.js";

export type ObserveCommentsButtonInput = z.output<typeof ObserveCommentsButtonInputSchema>;
export type ObserveCommentsButtonResult = z.output<typeof ObserveCommentsButtonResultSchema>;