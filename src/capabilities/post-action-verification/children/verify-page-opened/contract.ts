import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyPageOpenedInputSchema, VerifyPageOpenedOutputSchema } from "./schema.js";

export type VerifyPageOpenedInput = z.output<typeof VerifyPageOpenedInputSchema>;
export type VerifyPageOpenedOutput = z.output<typeof VerifyPageOpenedOutputSchema>;
export type VerifyPageOpenedCapability = PostActionVerificationChildCapability;
