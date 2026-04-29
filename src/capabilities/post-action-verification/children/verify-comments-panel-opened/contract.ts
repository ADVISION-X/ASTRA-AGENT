import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyCommentsPanelOpenedInputSchema, VerifyCommentsPanelOpenedOutputSchema } from "./schema.js";

export type VerifyCommentsPanelOpenedInput = z.output<typeof VerifyCommentsPanelOpenedInputSchema>;
export type VerifyCommentsPanelOpenedOutput = z.output<typeof VerifyCommentsPanelOpenedOutputSchema>;

export type VerifyCommentsPanelOpenedCapability = PostActionVerificationChildCapability;
