import type { z } from "zod";

import { ObserveCommentsPanelInputSchema, ObserveCommentsPanelResultSchema } from "./schema.js";

export type ObserveCommentsPanelInput = z.output<typeof ObserveCommentsPanelInputSchema>;
export type ObserveCommentsPanelResult = z.output<typeof ObserveCommentsPanelResultSchema>;