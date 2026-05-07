import type { z } from "zod";

import { ObserveSaveButtonInputSchema, ObserveSaveButtonResultSchema } from "./schema.js";

export type ObserveSaveButtonInput = z.output<typeof ObserveSaveButtonInputSchema>;
export type ObserveSaveButtonResult = z.output<typeof ObserveSaveButtonResultSchema>;