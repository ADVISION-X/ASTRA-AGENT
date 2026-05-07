import type { z } from "zod";

import { ObserveMetricLikeCountInputSchema, ObserveMetricLikeCountResultSchema } from "./schema.js";

export type ObserveMetricLikeCountInput = z.output<typeof ObserveMetricLikeCountInputSchema>;
export type ObserveMetricLikeCountResult = z.output<typeof ObserveMetricLikeCountResultSchema>;