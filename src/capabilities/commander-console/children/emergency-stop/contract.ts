import type { z } from "zod";

import { EmergencyStopInputSchema, EmergencyStopOutputSchema } from "./schema.js";

export type EmergencyStopInput = z.infer<typeof EmergencyStopInputSchema>;
export type EmergencyStopOutput = z.infer<typeof EmergencyStopOutputSchema>;