import { createHash } from "node:crypto";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput, declaredFacts, numberInput, requireBrowser, requireConfirmedBrowserFact,
  requireExactInputKeys, stringInput, success,
} from "../child-handler.js";
import {
  projectCoherentObservation, readCoherentObservation, type GptCoherentFactProjection,
} from "../gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR, GPT_COMPOSER_FORM_SELECTOR,
} from "../contracts/attachment.contract.js";
import { GPT_COMPOSER_SELECTOR, GPT_SEND_SELECTOR, GPT_USER_TURN_SELECTOR } from "../gpt-page-selectors.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";
import { waitForGptDirectMutationSettlement } from "../direct-mutation-settlement.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const promptIdentity = (text: string) => Object.freeze({
  length: text.length, prefix: text.slice(0, 80), suffix: text.slice(-80), hash: hash(text),
});

const hashInput = (intent: AnyIntent, key: string): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value as `sha256:${string}`;
};

const filesInput = (intent: AnyIntent): readonly Readonly<{ providerDisplayName: string }>[] =>
  Object.freeze(arrayInput(intent, "files").map((file) => {
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
  }));

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

const readDraftState = async (
  browser: BrowserTargetLease,
  options: Readonly<{ includeSend?: boolean; includeTurns?: boolean; includeAttachments?: boolean }> = {},
): Promise<DraftState> => {
  const queries = [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
    ...(options.includeSend ? [{ queryId: "send", selector: GPT_SEND_SELECTOR, maxMatches: 2,
      fields: ["tagName" as const, "disabled" as const, "ariaDisabled" as const] }] : []),
    ...(options.includeTurns ? [{ queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "exactGptUserPromptHash" as const] }] : []),
    ...(options.includeAttachments ? [{ queryId: "attachment-items", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR },
      maxMatches: 20, fields: ["ariaLabel" as const] }] : []),
  ];
  const observation = await readCoherentObservation(browser, queries);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const send = row("send");
  const userTurns = row("user-turns")?.matches.map((match) => {
    if (typeof match.testId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(match.testId)
      || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, promptHash: match.exactGptUserPromptHash });
  }) ?? [];
  const attachmentLabels = row("attachment-items")?.matches.map((match) => {
    if (typeof match.ariaLabel !== "string") throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    return match.ariaLabel.normalize("NFC");
  }) ?? [];
  const rawComposerHash = composer.matches[0]?.exactEditableTextHash;
  if (rawComposerHash !== undefined
    && (typeof rawComposerHash !== "string" || !HASH.test(rawComposerHash))) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  const attachments = row("attachment-items");
  const sendMatch = send?.matches[0];
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: typeof rawComposerHash === "string" ? rawComposerHash : null,
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

const requireExactComposer = (state: DraftState): void => {
  if (state.composerRaw !== 1 || state.composerEligible !== 1 || state.composerHash === null) {
    throw executionFailure("failed", `GPT_COMPOSER_INVALID:raw=${state.composerRaw}:eligible=${state.composerEligible}`);
  }
};

const waitForFreshDraftState = (
  browser: BrowserTargetLease,
  options: Parameters<typeof readDraftState>[1],
  ready: (state: DraftState) => boolean,
  hardFailure: (state: DraftState) => boolean,
): Promise<DraftState> => waitForGptDirectMutationSettlement(
  browser, () => readDraftState(browser, options), ready, hardFailure,
);

const canonicalConversationOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); } catch { return null; }
};

const submissionMatch = (state: DraftState, promptHash: string) =>
  state.userTurns.filter((turn) => turn.promptHash === promptHash);

const exactAttachmentSet = (
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

const promptWriteMismatchFailure = (
  intent: AnyIntent,
  browser: BrowserTargetLease,
  expectedHash: `sha256:${string}`,
  observed: DraftState,
) => {
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  const observedHash = observed.composerHash ?? "missing";
  const proofFacts = Object.freeze({
    ...observed.facts,
    decision: "FAIL_CLOSED",
    factResultIds: Object.freeze([
      ...observed.facts.factResultIds,
      `gpt-composer-expected-hash:${expectedHash.slice(7)}`,
      `gpt-composer-observed-hash:${observedHash.startsWith("sha256:") ? observedHash.slice(7) : observedHash}`,
      browserFact.evidenceRef,
    ]),
    authorityRefHashes: Object.freeze([
      ...observed.facts.authorityRefHashes, browserFact.evidenceHash,
    ]),
    mutationOutcome: browserFact.mutationOutcome,
    browserFact,
    nativeFailureCode: "GPT_PROMPT_WRITE_UNCONFIRMED",
  });
  return gptExecutionFailure("GPT_PROMPT_WRITE_UNCONFIRMED", {
    mutationOutcome: browserFact.mutationOutcome,
    evidence: { evidenceRef: browserFact.evidenceRef, evidenceHash: browserFact.evidenceHash },
    browserEffect: {
      effectScope: browserFact.effectScope,
      childCapabilityId: browserFact.childCapabilityId,
      browserOutcome: browserFact.browserOutcome,
    },
    proofFacts,
  });
};

const timeoutInput = (intent: AnyIntent): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

export const composerSubmissionChildHandlers = {
  async write_exact_gpt_prompt(intent, context) {
    requireExactInputKeys(intent, ["prompt"]);
    const prompt = stringInput(intent, "prompt");
    const promptHash = hash(prompt);
    const browser = requireBrowser(context);
    const observed = await readDraftState(browser);
    requireExactComposer(observed);
    if (observed.composerHash === promptHash) return success({
      value: promptIdentity(prompt),
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_PROMPT_WRITE_PENDING");
    await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: prompt,
      clearBeforeType: true, expectedMatches: 1,
    });
    const readback = await waitForFreshDraftState(
      browser,
      {},
      (state) => state.composerRaw === 1 && state.composerEligible === 1
        && state.composerHash === promptHash,
      (state) => state.composerRaw > 1 || (state.composerRaw === 1 && state.composerEligible !== 1),
    );
    requireExactComposer(readback);
    if (readback.composerHash !== promptHash) {
      throw promptWriteMismatchFailure(intent, browser, promptHash, readback);
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: promptIdentity(prompt),
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  },

  async reconcile_gpt_draft(intent, context) {
    requireExactInputKeys(intent, ["files", "prompt", "turnMarker"]);
    const files = filesInput(intent);
    const prompt = stringInput(intent, "prompt");
    const marker = stringInput(intent, "turnMarker");
    if (!prompt.includes(marker)) throw executionFailure("failed", "GPT_PROMPT_MARKER_MISSING");
    const expectedLabels = files.map((file) => file.providerDisplayName);
    const ready = (state: DraftState): boolean => state.composerRaw === 1
      && state.composerEligible === 1
      && state.composerHash === hash(prompt)
      && state.sendRaw === 1 && state.sendEligible === 1 && state.sendTag === "BUTTON"
      && state.sendDisabled === false && state.sendAriaDisabled === false
      && exactAttachmentSet(state, files);
    const observed = await readDraftState(
      requireBrowser(context), { includeSend: true, includeAttachments: true },
    );
    requireExactComposer(observed);
    if (!ready(observed)) {
      throw executionFailure("failed", "GPT_DRAFT_OR_SEND_READBACK_MISMATCH");
    }
    return success({
      value: { ...promptIdentity(prompt), attachmentDisplayNames: expectedLabels },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  },

  async submit_exact_gpt_turn_once(intent, context) {
    requireExactInputKeys(intent, ["files", "promptHash", "turnMarker"]);
    const files = filesInput(intent);
    const promptHash = hashInput(intent, "promptHash");
    stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observed = await readDraftState(browser, {
      includeSend: true, includeTurns: true, includeAttachments: true,
    });
    requireExactComposer(observed);
    const alreadySubmitted = submissionMatch(observed, promptHash);
    if (alreadySubmitted.length > 1) throw executionFailure("failed", `GPT_SUBMITTED_TURN_COUNT_${alreadySubmitted.length}`);
    if (alreadySubmitted.length === 1 && canonicalConversationOrNull(observed.currentUrl)) return success({
      value: { promptHash, mutationSent: false },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_TURN_SUBMISSION_PENDING");
    if (observed.composerHash !== promptHash
      || observed.sendRaw !== 1 || observed.sendEligible !== 1 || observed.sendTag !== "BUTTON"
      || observed.sendDisabled !== false || observed.sendAriaDisabled !== false
      || !exactAttachmentSet(observed, files)
      || observed.userTurns.length >= 20) {
      throw executionFailure("failed", "GPT_SUBMIT_PRECONDITION_INVALID");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      postClickMatch: { selector: GPT_USER_TURN_SELECTOR,
        expectedMatches: observed.userTurns.length + 1, timeoutMs: 5_000 },
    });
    const readback = await readDraftState(browser, { includeTurns: true });
    requireExactComposer(readback);
    const submitted = submissionMatch(readback, promptHash);
    const canonicalUrl = canonicalConversationOrNull(readback.currentUrl);
    if (submitted.length !== 1 || readback.composerHash !== hash("") || canonicalUrl === null) {
      throw executionFailure("failed", "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { promptHash, mutationSent: true },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  },

  async reconcile_gpt_turn_submission(intent, context) {
    requireExactInputKeys(intent, ["expectedPromptHash", "timeoutMs", "turnMarker"]);
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    const marker = stringInput(intent, "turnMarker");
    const deadline = Date.now() + timeoutInput(intent);
    const browser = requireBrowser(context);
    let lastTransient: unknown = null;
    do {
      try {
        const observed = await readDraftState(browser, { includeTurns: true });
        requireExactComposer(observed);
        const matching = submissionMatch(observed, expectedPromptHash);
        if (matching.length > 1) throw executionFailure("failed", `GPT_SUBMITTED_TURN_COUNT_${matching.length}`);
        const canonicalConversationUrl = canonicalConversationOrNull(observed.currentUrl);
        if (matching.length === 1 && observed.composerHash === hash("") && canonicalConversationUrl) {
          const userTurnId = matching[0]!.testId;
          return success({
            value: { turnMarker: marker, userTurnId, canonicalConversationUrl, promptHash: expectedPromptHash,
              conversationIdentityHash: hash(`${canonicalConversationUrl}\n${marker}\n${userTurnId}\n${expectedPromptHash}`) },
            ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
              browserFact: null, nativeFailureCode: null }),
          });
        }
        lastTransient = null;
      } catch (error) {
        const code = failureCode(error);
        if (!["BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
          "BROWSER_DOM_NODE_STALE", "BROWSER_DOM_READ_INVALID"].includes(code)) throw error;
        lastTransient = error;
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
    } while (Date.now() < deadline);
    if (lastTransient) throw lastTransient;
    throw executionFailure("failed", "GPT_TURN_SUBMISSION_RECONCILIATION_PENDING");
  },
} satisfies GptChildHandlerMap;
