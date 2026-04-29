import type { z } from "zod";

import { ShowOperationalMapProgressInputSchema, ShowOperationalMapProgressOutputSchema } from "./schema.js";

export type ShowOperationalMapProgressInput = z.infer<typeof ShowOperationalMapProgressInputSchema>;
export type ShowOperationalMapProgressOutput = z.infer<typeof ShowOperationalMapProgressOutputSchema>;