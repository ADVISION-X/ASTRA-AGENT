import type { z } from "zod";

import { ScrollDesktopScreenInputSchema, ScrollDesktopScreenResultSchema } from "../../schema.js";

export type ScrollDesktopScreenInput = z.output<typeof ScrollDesktopScreenInputSchema>;
export type ScrollDesktopScreenResult = z.output<typeof ScrollDesktopScreenResultSchema>;