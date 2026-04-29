import type { z } from "zod";

import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./schema.js";

export type OpenTikTokRequest = z.output<typeof OpenTikTokRequestSchema>;
export type OpenTikTokResult = z.output<typeof OpenTikTokResultSchema>;