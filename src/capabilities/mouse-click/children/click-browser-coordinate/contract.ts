import type { z } from "zod";

import { ClickBrowserCoordinateInputSchema, ClickBrowserCoordinateResultSchema } from "../../schema.js";

export type ClickBrowserCoordinateInput = z.output<typeof ClickBrowserCoordinateInputSchema>;
export type ClickBrowserCoordinateResult = z.output<typeof ClickBrowserCoordinateResultSchema>;