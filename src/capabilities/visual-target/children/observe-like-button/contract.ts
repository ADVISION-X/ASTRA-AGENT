import type { z } from "zod";

import { ObserveLikeButtonInputSchema, ObserveLikeButtonResultSchema } from "./schema.js";

export type ObserveLikeButtonInput = z.output<typeof ObserveLikeButtonInputSchema>;
export type ObserveLikeButtonResult = z.output<typeof ObserveLikeButtonResultSchema>;