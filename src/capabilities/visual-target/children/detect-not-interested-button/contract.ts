import type { z } from "zod";

import { DetectNotInterestedButtonInputSchema, DetectNotInterestedButtonResultSchema } from "./schema.js";

export type DetectNotInterestedButtonInput = z.output<typeof DetectNotInterestedButtonInputSchema>;
export type DetectNotInterestedButtonResult = z.output<typeof DetectNotInterestedButtonResultSchema>;