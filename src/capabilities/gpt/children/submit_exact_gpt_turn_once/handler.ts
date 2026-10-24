import { browserExactCallIdentityHash } from "../../../../lib/browser/browser-authority-api.js";
import type { BrowserDomPostconditionQuery } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { composerFilesInput, composerHashInput } from "./observation.js";
import { GPT_ATTACHMENT_ITEM_SELECTOR, GPT_COMPOSER_FORM_SELECTOR, GPT_COMPOSER_SELECTOR,
  GPT_EMPTY_COMPOSER_SELECTOR, GPT_SEND_SELECTOR, GPT_USER_TURN_SELECTOR } from "./selectors.js";

const MESSAGE_QUERIES: readonly BrowserDomPostconditionQuery[] = Object.freeze([
  { queryId: "submitted-user-turn", selector: GPT_USER_TURN_SELECTOR, maxMatches: 1, expectedEligibleCount: 1,
    fields: ["turnKey", "exactGptUserPromptHash"], latestGptUserTurn: true },
  { queryId: "empty-composer", selector: GPT_EMPTY_COMPOSER_SELECTOR, maxMatches: 1, expectedEligibleCount: 1, fields: [] },
]);
const HASH_FIELDS = ["promptHash", "exactCallIdentityHash", "observationRevisionHash", "targetRefHash", "documentRefHash"] as const;

const readConfirmedMessageProof = (payload: unknown, exactCallIdentityHash: `sha256:${string}`) => {
  const proof = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Readonly<Record<string, unknown>> : null;
  if (!proof || proof.exactCallIdentityHash !== exactCallIdentityHash || proof.rawCount !== 1 || proof.eligibleCount !== 1
    || HASH_FIELDS.some(key => typeof proof[key] !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(proof[key]))
    || typeof proof.userTurnId !== "string"
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(proof.userTurnId)) {
    throw executionFailure("failed", "GPT_SUBMIT_BROWSER_RECEIPT_INVALID");
  }
  return { ...proof, userTurnId: proof.userTurnId, promptHash: proof.promptHash as `sha256:${string}`,
    targetRefHash: proof.targetRefHash as `sha256:${string}`, documentRefHash: proof.documentRefHash as `sha256:${string}`,
    observationRevisionHash: proof.observationRevisionHash as `sha256:${string}` };
};

export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> = async (intent, context) => {
  requireExactInputKeys(intent, ["files", "promptHash"]);
  const files = composerFilesInput(intent), approvedHash = composerHashInput(intent, "promptHash");
  const readback = context.confirmedProviderEffectReadback;
  if (!readback) {
    context.assertProviderInputAllowed?.();
    await requireBrowser(context).executeDomIntent({ kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      preClickExactOutgoingTurn: { composerSelector: GPT_COMPOSER_SELECTOR,
        composerFormSelector: GPT_COMPOSER_FORM_SELECTOR, attachmentSelector: GPT_ATTACHMENT_ITEM_SELECTOR,
        userTurnSelector: GPT_USER_TURN_SELECTOR, expectedPromptHash: approvedHash,
        expectedAttachmentLabels: files.map(file => file.providerDisplayName) },
      postClickObservation: { queries: MESSAGE_QUERIES, timeoutMs: 5_000 } });
  }
  const confirmed = projectBrowserFact(intent, context);
  if (!confirmed || confirmed.fact.browserOutcome !== "CONFIRMED"
    || confirmed.fact.mutationOutcome !== "confirmed" || confirmed.outcome.physicalInputCount !== 1
    || (readback && confirmed.outcome !== readback.outcome)) {
    throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const identity = context.browserAtomicIdentity;
  if (!identity) throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  const exactCallIdentityHash = readback?.exactCallIdentityHash ?? browserExactCallIdentityHash({
    jobId: intent.jobId, attemptId: intent.attemptId, writerFenceHash: requireBrowser(context).writerFenceHash, ...identity });
  const proof = readConfirmedMessageProof(confirmed.outcome.terminalPayload, exactCallIdentityHash);
  if (!readback && proof.promptHash !== approvedHash) {
    throw executionFailure("failed", "GPT_SUBMITTED_USER_TURN_PROMPT_HASH_MISMATCH");
  }
  return success({ value: { status: "CONFIRMED", promptHash: proof.promptHash, mutationSent: true, userTurnId: proof.userTurnId },
    ...declaredFacts({ decision: readback ? "DONE" : "ACT", mutationOutcome: readback ? "no" : "confirmed",
      browserFact: confirmed.fact, nativeFailureCode: null, candidateCardinality: { raw: 1, eligible: 1 },
      factResultIds: [confirmed.fact.evidenceRef], authorityRefHashes: [proof.targetRefHash, proof.documentRefHash,
        confirmed.fact.evidenceHash], observationRevisionHash: proof.observationRevisionHash }) });
};
