import { createHash } from "node:crypto";

export type GptConversationIdentityInput = Readonly<{
  canonicalConversationUrl: string;
  turnMarker: string;
  userTurnId: string;
  promptHash: `sha256:${string}`;
}>;

/** One GPT-owned identity formula shared by submission reconciliation and response waits. */
export const gptConversationIdentityHash = (
  input: GptConversationIdentityInput,
): `sha256:${string}` => `sha256:${createHash("sha256").update(
  `${input.canonicalConversationUrl}\n${input.turnMarker}\n${input.userTurnId}\n${input.promptHash}`,
).digest("hex")}`;
