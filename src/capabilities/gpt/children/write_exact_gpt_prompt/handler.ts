import type { GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, stringInput, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { gptComposerHash, promptIdentity, readDraftState, requireExactComposer, type DraftState } from "./observation.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

const mismatchFailure = (expectedHash: `sha256:${string}`, state: DraftState, fact: GptChildBrowserFact): never => {
  const observedHash = state.composerHash ?? "missing";
  throw gptExecutionFailure("GPT_PROMPT_WRITE_UNCONFIRMED", { mutationOutcome: fact.mutationOutcome,
    evidence: { evidenceRef: fact.evidenceRef, evidenceHash: fact.evidenceHash },
    browserEffect: { effectScope: fact.effectScope, childCapabilityId: fact.childCapabilityId, browserOutcome: fact.browserOutcome },
    proofFacts: { ...state.facts, decision: "FAIL_CLOSED", mutationOutcome: fact.mutationOutcome,
      factResultIds: [...state.facts.factResultIds, `gpt-composer-expected-hash:${expectedHash.slice(7)}`,
        `gpt-composer-observed-hash:${observedHash.startsWith("sha256:") ? observedHash.slice(7) : observedHash}`, fact.evidenceRef],
      authorityRefHashes: [...state.facts.authorityRefHashes, fact.evidenceHash], browserFact: fact,
      nativeFailureCode: "GPT_PROMPT_WRITE_UNCONFIRMED" } });
};

export const writeExactGptPromptHandler: GptChildHandler<"write_exact_gpt_prompt"> = async (intent, context) => {
  requireExactInputKeys(intent, ["prompt"]);
  const prompt = stringInput(intent, "prompt"), expectedHash = gptComposerHash(prompt), browser = requireBrowser(context);
  const observed = await readDraftState(browser, context.signal);
  requireExactComposer(observed);
  if (observed.composerHash === expectedHash) return success({ value: promptIdentity(prompt),
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  await browser.executeDomIntent({ kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: prompt,
    clearBeforeType: true, expectedMatches: 1 });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const readback = await readDraftState(browser, context.signal), { fact } = projected;
  requireExactComposer(readback);
  if (readback.composerHash !== expectedHash) mismatchFailure(expectedHash, readback, fact);
  return success({ value: promptIdentity(prompt), ...declaredFacts({ ...readback.facts,
    decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
    factResultIds: [...readback.facts.factResultIds, fact.evidenceRef],
    authorityRefHashes: [...readback.facts.authorityRefHashes, fact.evidenceHash], browserFact: fact, nativeFailureCode: null }) });
};
