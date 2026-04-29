import type { z } from "zod";

import { StopMissionInputSchema, StopMissionOutputSchema } from "./schema.js";

export type StopMissionInput = z.infer<typeof StopMissionInputSchema>;
export type StopMissionOutput = z.infer<typeof StopMissionOutputSchema>;