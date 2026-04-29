import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyVideoChangedAfterScrollInputSchema, VerifyVideoChangedAfterScrollOutputSchema } from "./schema.js";

export type VerifyVideoChangedAfterScrollInput = z.output<typeof VerifyVideoChangedAfterScrollInputSchema>;
export type VerifyVideoChangedAfterScrollOutput = z.output<typeof VerifyVideoChangedAfterScrollOutputSchema>;

export type VerifyVideoChangedAfterScrollCapability = PostActionVerificationChildCapability;
