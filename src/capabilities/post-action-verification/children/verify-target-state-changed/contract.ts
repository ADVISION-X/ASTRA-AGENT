import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyTargetStateChangedInputSchema, VerifyTargetStateChangedOutputSchema } from "./schema.js";

export type VerifyTargetStateChangedInput = z.output<typeof VerifyTargetStateChangedInputSchema>;
export type VerifyTargetStateChangedOutput = z.output<typeof VerifyTargetStateChangedOutputSchema>;

export type VerifyTargetStateChangedCapability = PostActionVerificationChildCapability;
