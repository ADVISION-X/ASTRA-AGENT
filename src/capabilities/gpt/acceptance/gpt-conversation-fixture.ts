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
}> = {}): Readonly<Record<string, Fact>> => ({
  composer: exact([{ exactEditableTextHash: input.composerHash ?? EMPTY_HASH }]),
  "user-turns": input.promptHash
    ? exact([{ testId: "conversation-turn-1", exactGptUserPromptHash: input.promptHash }])
    : absent(),
  "assistant-turns": input.assistant
    ? exact([{ testId: "conversation-turn-2", semanticTextHash: responseHash }])
    : absent(),
  attachments: input.attachment ? exact() : absent(),
  generating: absent(),
  "source-trigger": exact([{ ariaExpanded: input.menuOpen ? "true" : "false" }]),
  "active-menu": input.menuOpen ? exact() : absent(),
  "fork-leaf": input.menuOpen ? exact() : absent(),
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

export const draftFacts = (input: Readonly<{
  composerHash: string;
  submitted?: boolean;
  submittedHash?: string;
  attachment?: boolean;
  sendDisabled?: boolean;
}>): Readonly<Record<string, Fact>> => ({
  composer: exact([{ exactEditableTextHash: input.composerHash }]),
  send: exact([{ tagName: "BUTTON", disabled: input.sendDisabled ?? false,
    ariaDisabled: input.sendDisabled ?? false }]),
  "user-turns": input.submitted || input.submittedHash
    ? exact([{ testId: "conversation-turn-1", exactGptUserPromptHash: input.submittedHash ?? promptHash }])
    : absent(),
  "attachment-items": input.attachment
    ? exact([{ ariaLabel: approvedFile.providerDisplayName }])
    : absent(),
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
