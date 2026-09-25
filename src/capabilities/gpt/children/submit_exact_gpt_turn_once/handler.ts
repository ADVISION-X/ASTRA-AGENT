import { executionFailure } from "../../../../lib/execution-failure.js";
import { gptExactCallIdentityHash } from "../../contract.js";
import {
  decodeCoherentObservationPacket,
  projectCoherentObservation,
} from "../../web/gpt-dom-observation.js";

import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  composerFilesInput,
  composerHashInput,
  canonicalConversationOrNull,
} from "./observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
  GPT_COMPOSER_SELECTOR,
  GPT_EMPTY_COMPOSER_SELECTOR,
  GPT_SEND_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "./selectors.js";

const submittedTurnObservation = (packet: unknown, selector: string) => {
  const observation = decodeCoherentObservationPacket(packet, [{
    queryId: "submitted-user-turn", selector, maxMatches: 1,
    fields: ["turnKey" as const, "exactGptUserPromptHash" as const], latestGptUserTurn: true,
  }, {
    queryId: "empty-composer", selector: GPT_EMPTY_COMPOSER_SELECTOR,
    maxMatches: 1, fields: [],
  }]);
  const row = observation.rows[0]!;
  const match = row.rawCount === 1 && row.eligibleCount === 1 ? row.matches[0] : undefined;
  const userTurnId = match?.turnKey;
  const observedPromptHash = match?.exactGptUserPromptHash;
  if (typeof userTurnId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(userTurnId)
  ) {
    throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_MISSING");
  }
  if (typeof observedPromptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(observedPromptHash)) {
    throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_INVALID");
  }
  return Object.freeze({ observation, userTurnId,
    promptHash: observedPromptHash as `sha256:${string}` });
};

const terminalPostconditionPacket = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  }
  return (value as Readonly<Record<string, unknown>>).postconditionObservation;
};

const recoveredSubmittedTurn = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  }
  const row = value as Readonly<Record<string, unknown>>;
  const hashes = ["promptHash", "exactCallIdentityHash", "observationRevisionHash",
    "targetRefHash", "documentRefHash"] as const;
  if (typeof row.canonicalConversationUrl !== "string"
    || typeof row.userTurnId !== "string"
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(row.userTurnId)
    || row.rawCount !== 1 || row.eligibleCount !== 1
    || hashes.some((key) => typeof row[key] !== "string"
      || !/^sha256:[a-f0-9]{64}$/u.test(row[key] as string))) {
    throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  }
  return row;
};

type SubmitHandler = GptChildHandler<"submit_exact_gpt_turn_once">;
type SubmitIntent = Parameters<SubmitHandler>[0];
type SubmitContext = Parameters<SubmitHandler>[1];

const recoveredSubmitResult = (
  intent: SubmitIntent,
  context: SubmitContext,
) => {
  const recovered = context.confirmedProviderEffectReadback!;
  const submitted = recoveredSubmittedTurn(recovered.terminalPayload);
  const canonicalConversationUrl = canonicalConversationOrNull(submitted.canonicalConversationUrl as string);
  if (!canonicalConversationUrl) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  const submittedPromptHash = submitted.promptHash as `sha256:${string}`;
  const browserFact = Object.freeze({
    exactCallIdentityHash: gptExactCallIdentityHash(intent),
    providerEffectIdentityHash: recovered.providerEffectIdentityHash,
    childCapabilityId: intent.childCapabilityId,
    effectScope: "provider_effect" as const,
    browserOutcome: "CONFIRMED" as const,
    mutationOutcome: recovered.mutationOutcome,
    terminalAt: recovered.terminalAt,
    evidenceRef: recovered.authorityRef,
    evidenceHash: recovered.authorityHash,
  });
  return success({
    value: { status: "CONFIRMED" as const, promptHash: submittedPromptHash, mutationSent: true as const,
      canonicalConversationUrl, userTurnId: submitted.userTurnId as string },
    ...declaredFacts({
      factResultIds: Object.freeze([
        `gpt-dom-fact:${(submitted.exactCallIdentityHash as string).slice(7)}:${(submitted.observationRevisionHash as string).slice(7)}`,
      ]),
      candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
      authorityRefHashes: Object.freeze([
        submitted.targetRefHash as `sha256:${string}`,
        submitted.documentRefHash as `sha256:${string}`,
      ]),
      observationRevisionHash: submitted.observationRevisionHash as `sha256:${string}`,
      decision: "DONE", mutationOutcome: "no", browserFact, nativeFailureCode: null,
    }),
  });
};

export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "promptHash"]);
    const files = composerFilesInput(intent);
    const promptHash = composerHashInput(intent, "promptHash");
    const recovered = context.confirmedProviderEffectReadback;
    if (recovered) return recoveredSubmitResult(intent, context);
    const browser = requireBrowser(context);
    const submittedSelector = GPT_USER_TURN_SELECTOR;
    const dispatched = context.dispatchedProviderEffectReadback;
    if (dispatched) {
      const submitted = submittedTurnObservation(await browser.executeDomIntent({ kind: "observe", queries: [{
        queryId: "submitted-user-turn", selector: submittedSelector, maxMatches: 1,
        fields: ["turnKey", "exactGptUserPromptHash"], latestGptUserTurn: true,
      }, { queryId: "empty-composer", selector: GPT_EMPTY_COMPOSER_SELECTOR, maxMatches: 1, fields: [] }] }), submittedSelector);
      if (submitted.promptHash !== promptHash) throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      const canonicalConversationUrl = canonicalConversationOrNull(submitted.observation.currentUrl);
      if (!canonicalConversationUrl) throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      await browser.resolvePendingMutation({ schemaVersion: "grasseye.browser.outcome-resolution.v1",
        outcome: "TERMINAL_SUCCESS", mutationOutcome: "confirmed",
        positiveEvidenceRef: `gpt-dom-observation:${submitted.observation.observationRevisionHash}`,
        negativeEvidenceRef: `gpt-dom-observation:${submitted.observation.observationRevisionHash}#prompt-mismatch-absent`,
        uniqueTargetRef: browser.target.targetRef, boundedAt: submitted.observation.observedAt });
      const facts = projectCoherentObservation(submitted.observation, "submitted-user-turn");
      const browserFact = requireConfirmedBrowserFact(intent, context);
      return success({ value: { status: "CONFIRMED", promptHash, mutationSent: true,
        canonicalConversationUrl, userTurnId: submitted.userTurnId },
      ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }) });
    }
    context.assertProviderInputAllowed?.();
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      preClickExactOutgoingTurn: {
        composerSelector: GPT_COMPOSER_SELECTOR,
        composerFormSelector: GPT_COMPOSER_FORM_SELECTOR,
        attachmentSelector: GPT_ATTACHMENT_ITEM_SELECTOR,
        userTurnSelector: GPT_USER_TURN_SELECTOR,
        expectedPromptHash: promptHash,
        expectedAttachmentLabels: Object.freeze(files.map((file) => file.providerDisplayName)),
      },
      postClickObservation: { queries: [{
        queryId: "submitted-user-turn", selector: submittedSelector,
        maxMatches: 1, fields: ["turnKey", "exactGptUserPromptHash"], expectedEligibleCount: 1,
        latestGptUserTurn: true,
      }, {
        queryId: "empty-composer", selector: GPT_EMPTY_COMPOSER_SELECTOR,
        maxMatches: 1, fields: [], expectedEligibleCount: 1,
      }], timeoutMs: 5_000 },
    });
    const submitted = submittedTurnObservation(terminalPostconditionPacket(mutation), submittedSelector);
    if (submitted.promptHash !== promptHash) {
      throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_MISMATCH");
    }
    const canonicalConversationUrl = canonicalConversationOrNull(submitted.observation.currentUrl);
    if (!canonicalConversationUrl) {
      throw executionFailure("failed", "GPT_SUBMITTED_CONVERSATION_URL_INVALID");
    }
    const browserFact = requireConfirmedBrowserFact(intent, context);
    const facts = projectCoherentObservation(submitted.observation, "submitted-user-turn");
    return success({
      value: { status: "CONFIRMED", promptHash, mutationSent: true,
        canonicalConversationUrl, userTurnId: submitted.userTurnId },
      ...declaredFacts({ ...facts, decision: "ACT",
        factResultIds: Object.freeze([...facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
