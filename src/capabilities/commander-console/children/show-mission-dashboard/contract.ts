import type { z } from "zod";

import { ShowMissionDashboardInputSchema, ShowMissionDashboardOutputSchema } from "./schema.js";

export type ShowMissionDashboardInput = z.infer<typeof ShowMissionDashboardInputSchema>;
export type ShowMissionDashboardOutput = z.infer<typeof ShowMissionDashboardOutputSchema>;