import type { z } from "zod";

import { ObserveNotInterestedButtonInputSchema, ObserveNotInterestedButtonResultSchema } from "./schema.js";

export type ObserveNotInterestedButtonInput = z.output<typeof ObserveNotInterestedButtonInputSchema>;
export type ObserveNotInterestedButtonResult = z.output<typeof ObserveNotInterestedButtonResultSchema>;