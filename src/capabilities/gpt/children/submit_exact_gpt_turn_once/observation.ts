import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { arrayInput, stringInput } from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./selectors.js";
import {
  GPT_COMPOSER_SELECTOR,
  GPT_SEND_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "./selectors.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const gptComposerHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const composerHashInput = (
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};

export const composerFilesInput = (
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">,
): readonly Readonly<{ providerDisplayName: string }>[] => Object.freeze(
  arrayInput(intent, "files").map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
    const value = file as Readonly<Record<string, unknown>>;
    if (Object.keys(value).sort().join("|") !== "artifactRef|bytes|displayName|providerDisplayName|sha256"
      || typeof value.artifactRef !== "string" || value.artifactRef.length === 0
      || typeof value.displayName !== "string" || value.displayName.length === 0
      || typeof value.providerDisplayName !== "string" || value.providerDisplayName.length === 0
      || typeof value.sha256 !== "string" || !HASH.test(value.sha256)
      || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 1) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
    return Object.freeze({ providerDisplayName: value.providerDisplayName.normalize("NFC") });
  }),
);

type DraftState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  sendRaw: number;
  sendEligible: number;
  sendTag: string | null;
  sendDisabled: boolean | null;
  sendAriaDisabled: boolean | null;
  userTurns: readonly Readonly<{ testId: string; promptHash: string }>[];
  attachmentRaw: number;
  attachmentEligible: number;
  attachmentLabels: readonly string[];
  facts: GptCoherentFactProjection;
}>;

const userTurnsFromObservation = (
  matches: readonly Readonly<Record<string, unknown>>[],
): readonly Readonly<{ testId: string; promptHash: string }>[] => Object.freeze(matches.map((match) => {
  if (typeof match.testId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(match.testId)
    || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return Object.freeze({ testId: match.testId, promptHash: match.exactGptUserPromptHash });
}));

const attachmentLabelsFromObservation = (
  matches: readonly Readonly<Record<string, unknown>>[],
): readonly string[] => Object.freeze(matches.map((match) => {
  if (typeof match.ariaLabel !== "string") throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  return match.ariaLabel.normalize("NFC");
}));

const exactComposerHash = (match: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = match?.exactEditableTextHash;
  if (value !== undefined && (typeof value !== "string" || !HASH.test(value))) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return typeof value === "string" ? value : null;
};

export const readDraftState = async (
  browser: BrowserTargetLease,
  phase: "precondition" | "postcondition",
): Promise<DraftState> => {
  const queries = [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
    ...(phase === "precondition" ? [{ queryId: "send", selector: GPT_SEND_SELECTOR, maxMatches: 2,
      fields: ["tagName" as const, "disabled" as const, "ariaDisabled" as const] }] : []),
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "exactGptUserPromptHash" as const] },
    ...(phase === "precondition" ? [{ queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR },
      maxMatches: 20, fields: ["ariaLabel" as const] }] : []),
  ];
  const observation = await readCoherentObservation(browser, queries);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const send = row("send");
  const userTurns = userTurnsFromObservation(row("user-turns")?.matches ?? []);
  const attachmentLabels = attachmentLabelsFromObservation(row("attachment-items")?.matches ?? []);
  const attachments = row("attachment-items");
  const sendMatch = send?.matches[0];
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: exactComposerHash(composer.matches[0]),
    sendRaw: send?.rawCount ?? 0,
    sendEligible: send?.eligibleCount ?? 0,
    sendTag: typeof sendMatch?.tagName === "string" ? sendMatch.tagName : null,
    sendDisabled: typeof sendMatch?.disabled === "boolean" ? sendMatch.disabled : null,
    sendAriaDisabled: typeof sendMatch?.ariaDisabled === "boolean" ? sendMatch.ariaDisabled : null,
    userTurns: Object.freeze(userTurns),
    attachmentRaw: attachments?.rawCount ?? 0,
    attachmentEligible: attachments?.eligibleCount ?? 0,
    attachmentLabels: Object.freeze(attachmentLabels),
    facts: projectCoherentObservation(observation, "composer"),
  });
};

export const requireExactComposer = (state: DraftState): void => {
  if (state.composerRaw !== 1 || state.composerEligible !== 1 || state.composerHash === null) {
    throw executionFailure("failed", `GPT_COMPOSER_INVALID:raw=${state.composerRaw}:eligible=${state.composerEligible}`);
  }
};

export const canonicalConversationOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); } catch { return null; }
};

export const submissionMatch = (state: DraftState, promptHash: string) =>
  state.userTurns.filter((turn) => turn.promptHash === promptHash);

export const exactAttachmentSet = (
  state: DraftState,
  files: readonly Readonly<{ providerDisplayName: string }>[],
): boolean => {
  const expected = files.map((file) => file.providerDisplayName);
  return new Set(expected).size === expected.length
    && new Set(state.attachmentLabels).size === state.attachmentLabels.length
    && state.attachmentRaw === expected.length
    && state.attachmentEligible === expected.length
    && state.attachmentLabels.length === expected.length
    && expected.every((label) => state.attachmentLabels.includes(label));
};
