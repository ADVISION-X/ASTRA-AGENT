import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { arrayInput } from "../../web/child-handler.js";
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
} from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const gptComposerHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const promptIdentity = (text: string) => Object.freeze({
  length: text.length,
  prefix: text.slice(0, 80),
  suffix: text.slice(-80),
  hash: gptComposerHash(text),
});
export const composerFilesInput = (
  intent: GptChildCapabilityIntent<"reconcile_gpt_draft">,
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

export type DraftState = Readonly<{
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  sendRaw: number;
  sendEligible: number;
  sendTag: string | null;
  sendDisabled: boolean | null;
  sendAriaDisabled: boolean | null;
  attachmentRaw: number;
  attachmentEligible: number;
  attachmentLabels: readonly string[];
  facts: GptCoherentFactProjection;
}>;

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
): Promise<DraftState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
    { queryId: "send", selector: GPT_SEND_SELECTOR, maxMatches: 2,
      fields: ["tagName" as const, "disabled" as const, "ariaDisabled" as const] },
    { queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR },
      maxMatches: 20, fields: ["ariaLabel" as const] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const send = row("send")!;
  const attachmentLabels = attachmentLabelsFromObservation(row("attachment-items")?.matches ?? []);
  const attachments = row("attachment-items")!;
  const sendMatch = send?.matches[0];
  return Object.freeze({
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: exactComposerHash(composer.matches[0]),
    sendRaw: send.rawCount,
    sendEligible: send.eligibleCount,
    sendTag: typeof sendMatch?.tagName === "string" ? sendMatch.tagName : null,
    sendDisabled: typeof sendMatch?.disabled === "boolean" ? sendMatch.disabled : null,
    sendAriaDisabled: typeof sendMatch?.ariaDisabled === "boolean" ? sendMatch.ariaDisabled : null,
    attachmentRaw: attachments.rawCount,
    attachmentEligible: attachments.eligibleCount,
    attachmentLabels: Object.freeze(attachmentLabels),
    facts: projectCoherentObservation(observation, "composer"),
  });
};

export const requireExactComposer = (state: DraftState): void => {
  if (state.composerRaw !== 1 || state.composerEligible !== 1 || state.composerHash === null) {
    throw executionFailure("failed", `GPT_COMPOSER_INVALID:raw=${state.composerRaw}:eligible=${state.composerEligible}`);
  }
};
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
