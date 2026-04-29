import type { z } from "zod";

import { OpenFacebookRequestSchema, OpenFacebookResultSchema } from "./schema.js";

export type OpenFacebookRequest = z.output<typeof OpenFacebookRequestSchema>;
export type OpenFacebookResult = z.output<typeof OpenFacebookResultSchema>;