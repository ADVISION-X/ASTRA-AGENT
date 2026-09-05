import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  gptComposerHash,
  promptIdentity,
  readDraftState,
  requireExactComposer,
  type DraftState,
} from "./observation.js";
import { waitForGptDirectMutationSettlement } from "../../web/direct-mutation-settlement.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

const mismatchFailure = (
  intent: GptChildCapabilityIntent<"write_exact_gpt_prompt">,
  browser: BrowserTargetLease,
  expectedHash: `sha256:${string}`,
  observed: DraftState,
) => {
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  const observedHash = observed.composerHash ?? "missing";
  return gptExecutionFailure("GPT_PROMPT_WRITE_UNCONFIRMED", {
    mutationOutcome: browserFact.mutationOutcome,
    evidence: { evidenceRef: browserFact.evidenceRef, evidenceHash: browserFact.evidenceHash },
    browserEffect: {
      effectScope: browserFact.effectScope,
      childCapabilityId: browserFact.childCapabilityId,
      browserOutcome: browserFact.browserOutcome,
    },
    proofFacts: Object.freeze({
      ...observed.facts,
      decision: "FAIL_CLOSED",
      factResultIds: Object.freeze([
        ...observed.facts.factResultIds,
        `gpt-composer-expected-hash:${expectedHash.slice(7)}`,
        `gpt-composer-observed-hash:${observedHash.startsWith("sha256:") ? observedHash.slice(7) : observedHash}`,
        browserFact.evidenceRef,
      ]),
      authorityRefHashes: Object.freeze([...observed.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: browserFact.mutationOutcome,
      browserFact,
      nativeFailureCode: "GPT_PROMPT_WRITE_UNCONFIRMED",
    }),
  });
};

export const writeExactGptPromptHandler: GptChildHandler<"write_exact_gpt_prompt"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["prompt"]);
    const prompt = stringInput(intent, "prompt");
    const promptHash = gptComposerHash(prompt);
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
    const readback = await waitForGptDirectMutationSettlement(
      browser,
      () => readDraftState(browser),
      (state) => state.composerRaw === 1 && state.composerEligible === 1 && state.composerHash === promptHash,
      (state) => state.composerRaw > 1 || (state.composerRaw === 1 && state.composerEligible !== 1),
    );
    requireExactComposer(readback);
    if (readback.composerHash !== promptHash) throw mismatchFailure(intent, browser, promptHash, readback);
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: promptIdentity(prompt),
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
