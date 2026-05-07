import type { z } from "zod";

import { ObserveCloseCommentsButtonInputSchema, ObserveCloseCommentsButtonResultSchema } from "./schema.js";

export type ObserveCloseCommentsButtonInput = z.output<typeof ObserveCloseCommentsButtonInputSchema>;
export type ObserveCloseCommentsButtonResult = z.output<typeof ObserveCloseCommentsButtonResultSchema>;