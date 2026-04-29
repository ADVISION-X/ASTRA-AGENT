import type { z } from "zod";

import { ClickDesktopCoordinateInputSchema, ClickDesktopCoordinateResultSchema } from "../../schema.js";

export type ClickDesktopCoordinateInput = z.output<typeof ClickDesktopCoordinateInputSchema>;
export type ClickDesktopCoordinateResult = z.output<typeof ClickDesktopCoordinateResultSchema>;