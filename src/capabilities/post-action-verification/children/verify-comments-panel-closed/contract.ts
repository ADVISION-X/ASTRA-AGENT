import type { z } from "zod";

import type { PostActionVerificationChildCapability } from "../../contract.js";
import { VerifyCommentsPanelClosedInputSchema, VerifyCommentsPanelClosedOutputSchema } from "./schema.js";

export type VerifyCommentsPanelClosedInput = z.output<typeof VerifyCommentsPanelClosedInputSchema>;
export type VerifyCommentsPanelClosedOutput = z.output<typeof VerifyCommentsPanelClosedOutputSchema>;

export type VerifyCommentsPanelClosedCapability = PostActionVerificationChildCapability;
