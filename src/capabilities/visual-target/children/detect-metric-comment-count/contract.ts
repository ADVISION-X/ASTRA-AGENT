import type { z } from "zod";

import { DetectMetricCommentCountInputSchema, DetectMetricCommentCountResultSchema } from "./schema.js";

export type DetectMetricCommentCountInput = z.output<typeof DetectMetricCommentCountInputSchema>;
export type DetectMetricCommentCountResult = z.output<typeof DetectMetricCommentCountResultSchema>;