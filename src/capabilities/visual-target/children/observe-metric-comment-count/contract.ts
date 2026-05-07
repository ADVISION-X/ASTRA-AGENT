import type { z } from "zod";

import { ObserveMetricCommentCountInputSchema, ObserveMetricCommentCountResultSchema } from "./schema.js";

export type ObserveMetricCommentCountInput = z.output<typeof ObserveMetricCommentCountInputSchema>;
export type ObserveMetricCommentCountResult = z.output<typeof ObserveMetricCommentCountResultSchema>;