import type { z } from "zod";

import { ScrollBrowserViewportInputSchema, ScrollBrowserViewportResultSchema } from "../../schema.js";

export type ScrollBrowserViewportInput = z.output<typeof ScrollBrowserViewportInputSchema>;
export type ScrollBrowserViewportResult = z.output<typeof ScrollBrowserViewportResultSchema>;