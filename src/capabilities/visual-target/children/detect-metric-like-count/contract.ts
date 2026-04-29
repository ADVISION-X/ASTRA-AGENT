import type { z } from "zod";

import { DetectMetricLikeCountInputSchema, DetectMetricLikeCountResultSchema } from "./schema.js";

export type DetectMetricLikeCountInput = z.output<typeof DetectMetricLikeCountInputSchema>;
export type DetectMetricLikeCountResult = z.output<typeof DetectMetricLikeCountResultSchema>;