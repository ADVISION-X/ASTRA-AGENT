import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyNotInterestedResultInputSchema, VerifyNotInterestedResultOutputSchema } from "./schema.js";

export type VerifyNotInterestedResultInput = z.output<typeof VerifyNotInterestedResultInputSchema>;
export type VerifyNotInterestedResultOutput = z.output<typeof VerifyNotInterestedResultOutputSchema>;

export type VerifyNotInterestedResultCapability = PostActionVerificationChildCapability;
