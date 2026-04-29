import type { z } from "zod";

import {
  OpenLocalWorkbenchRequestSchema,
  OpenLocalWorkbenchResultSchema,
} from "./schema.js";

export type OpenLocalWorkbenchRequest = z.output<typeof OpenLocalWorkbenchRequestSchema>;
export type OpenLocalWorkbenchResult = z.output<typeof OpenLocalWorkbenchResultSchema>;