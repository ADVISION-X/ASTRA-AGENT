import type { z } from "zod";

import { DetectCommentsPanelInputSchema, DetectCommentsPanelResultSchema } from "./schema.js";

export type DetectCommentsPanelInput = z.output<typeof DetectCommentsPanelInputSchema>;
export type DetectCommentsPanelResult = z.output<typeof DetectCommentsPanelResultSchema>;