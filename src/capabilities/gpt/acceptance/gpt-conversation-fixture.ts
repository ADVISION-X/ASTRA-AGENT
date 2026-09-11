import { createHash } from "node:crypto";

import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";

export const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const EMPTY_HASH = hash("");
export const conversationUrl = "https://chatgpt.com/c/gpt-browser-handoff";
export const childConversationUrl = "https://chatgpt.com/c/gpt-browser-handoff-child";
export const marker = "[GRASSEYE:gpt-browser-handoff]";
export const prompt = `${marker}\napproved prompt`;
export const promptHash = hash(prompt);
export const conversationIdentityHash = hash(
  `${conversationUrl}\n${marker}\nconversation-turn-1\n${promptHash}`,
);
export const responseText = "approved assistant response";
export const responseHash = hash(responseText);
export const approvedFile = Object.freeze({
  artifactRef: "artifact:approved",
  displayName: "approved.pdf",
  providerDisplayName: "approved-0123456789ab.pdf",
  sha256: hash("approved-file"),
  bytes: 10,
});

type Fact = Readonly<{
  rawCount: number;
  eligibleCount: number;
  matches?: readonly Readonly<Record<string, unknown>>[];
}>;

const exact = (matches: readonly Readonly<Record<string, unknown>>[] = [{}]): Fact => ({
  rawCount: matches.length,
  eligibleCount: matches.length,
  matches,
});
const absent = (): Fact => ({ rawCount: 0, eligibleCount: 0, matches: [] });

export const conversationFacts = (input: Readonly<{
  composerHash?: string;
  promptHash?: string;
  assistant?: boolean;
  attachment?: boolean;
  menuOpen?: boolean;
  destinationOpen?: boolean;
}> = {}): Readonly<Record<string, Fact>> => ({
  composer: exact([{ exactEditableTextHash: input.composerHash ?? EMPTY_HASH }]),
  "identity-turn": input.promptHash
    ? exact([{ exactGptUserPromptHash: input.promptHash }])
    : absent(),
  "user-turns": input.promptHash
    ? exact([{ testId: "conversation-turn-1", exactGptUserPromptHash: input.promptHash }])
    : absent(),
  "assistant-turns": input.assistant
    ? exact([{ testId: "conversation-turn-2", semanticTextHash: responseHash }])
    : absent(),
  attachments: input.attachment ? exact() : absent(),
  generating: absent(),
  "source-trigger": exact([{
    id: "source-turn-trigger",
    ariaExpanded: input.menuOpen ? "true" : "false",
    ariaControls: input.menuOpen ? "source-turn-menu" : "",
  }]),
  "checkpoint-menu": input.menuOpen
    ? exact([{ id: "source-turn-menu", ariaLabelledBy: "source-turn-trigger" }]) : absent(),
  "open-fork-leaf": input.menuOpen ? exact([{
    id: "open-fork-trigger",
    ariaExpanded: input.destinationOpen ? "true" : "false",
    ariaControls: input.destinationOpen ? "fork-destination-menu" : "",
  }]) : absent(),
  "destination-menu": input.destinationOpen
    ? exact([{ id: "fork-destination-menu", ariaLabelledBy: "open-fork-trigger" }]) : absent(),
  "fork-to-new-chat-leaf": input.destinationOpen ? exact() : absent(),
});

export const responseFacts = (): Readonly<Record<string, Fact>> => ({
  "user-turns": exact([{ testId: "conversation-turn-1", exactGptUserPromptHash: promptHash }]),
  "assistant-turns": exact([{ testId: "conversation-turn-2", semanticTextHash: responseHash }]),
  generating: absent(),
  "rate-root": absent(),
  "rate-dialog": absent(),
  "rate-heading": absent(),
  "rate-ack": absent(),
});

export const sourceInput = Object.freeze({
  sourceAssistantTurnId: "conversation-turn-2",
  sourceCanonicalConversationUrl: conversationUrl,
  sourcePromptHash: promptHash,
  sourceResponseHash: responseHash,
  sourceTurnMarker: marker,
  timeoutMs: 1_000,
});

export const freshHarness = () => createGptAcceptanceHarness("gpt-browser-handoff");
