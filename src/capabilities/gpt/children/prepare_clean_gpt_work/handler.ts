import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys,
  numberInput, success, type GptChildHandler } from "../../web/child-handler.js";
import { isGptRootUrl } from "../../web/contracts/target-document.contract.js";
import { readConfirmedCoherentObservation, projectCoherentObservation,
  type GptCoherentObservation } from "../../web/gpt-dom-observation.js";
import { WORK_MODE_SELECTOR, WORK_ROOT_QUERIES, WORK_MODE_QUERIES } from "./selectors.js";

const emptyHash = `sha256:${createHash("sha256").update("").digest("hex")}`;
const row = (observation: GptCoherentObservation, id: string) => {
  const found = observation.rows.find(item => item.queryId === id);
  if (!found) throw executionFailure("failed", "GPT_WORK_OBSERVATION_INCOMPLETE");
  return found;
};
const emptyRoot = (observation: GptCoherentObservation): boolean => isGptRootUrl(observation.currentUrl)
  && row(observation, "composer").rawCount === 1 && row(observation, "composer").eligibleCount === 1
  && row(observation, "composer").matches[0]?.exactEditableTextHash === emptyHash
  && ["user", "assistant", "attachments", "generating"].every(id => row(observation, id).rawCount === 0);
const selected = (observation: GptCoherentObservation, mode: "work" | "chat"): boolean => {
  const other = mode === "work" ? "chat" : "work";
  return [mode, other].every(id => row(observation, id).rawCount === 1 && row(observation, id).eligibleCount === 1)
    && row(observation, mode).matches[0]?.ariaPressed === "true"
    && row(observation, other).matches[0]?.ariaPressed === "false";
};
const disposition = (observation: GptCoherentObservation) => {
  if (!isGptRootUrl(observation.currentUrl)
    || ["user", "assistant", "attachments", "generating"].some(id => row(observation, id).rawCount !== 0)) return "HARD_FAIL" as const;
  if (["composer", "work", "chat"].some(id => row(observation, id).rawCount === 0)) return "TRANSIENT_DOM" as const;
  return emptyRoot(observation) && (selected(observation, "work") || selected(observation, "chat"))
    ? "STABLE_ACT" as const : "HARD_FAIL" as const;
};
export const prepareCleanGptWorkHandler: GptChildHandler<"prepare_clean_gpt_work"> = async (intent, context) => {
  requireExactInputKeys(intent, ["timeoutMs"]);
  const timeout = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000) throw executionFailure("failed", "GPT_WORK_TIMEOUT_INVALID");
  const browser = requireBrowser(context);
  const before = await readConfirmedCoherentObservation(browser, WORK_ROOT_QUERIES, disposition, context.signal);
  if (!emptyRoot(before)) throw executionFailure("failed", "GPT_WORK_FRESH_COMPOSER_REQUIRED");
  if (selected(before, "work")) return success({ value: { mode: "work", draftEmpty: true },
    ...declaredFacts({ ...projectCoherentObservation(before, "composer"), decision: "DONE",
      mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  if (!selected(before, "chat")) throw executionFailure("failed", "GPT_WORK_MODE_AMBIGUOUS");
  await browser.executeDomIntent({ kind: "click", selector: WORK_MODE_SELECTOR, expectedTextEquals: "工作", expectedMatches: 1,
    postClickObservation: { queries: WORK_MODE_QUERIES.map(query => ({ ...query, expectedEligibleCount: 1 })),
      clickedCandidateAttribute: { name: "aria-pressed", equals: "true" } } });
  const fact = projectBrowserFact(intent, context);
  if (!fact || fact.fact.browserOutcome !== "CONFIRMED" || fact.outcome.physicalInputCount !== 1) {
    throw executionFailure("failed", "GPT_WORK_MODE_INPUT_UNCONFIRMED");
  }
  const after = await readConfirmedCoherentObservation(browser, WORK_ROOT_QUERIES, disposition, context.signal);
  if (!emptyRoot(after) || !selected(after, "work") || before.currentUrl !== after.currentUrl
    || projectCoherentObservation(before, "composer").authorityRefHashes.slice(0, 2).join("|")
      !== projectCoherentObservation(after, "composer").authorityRefHashes.slice(0, 2).join("|")) {
    throw executionFailure("failed", "GPT_WORK_MODE_POSTCONDITION_INVALID");
  }
  return success({ value: { mode: "work", draftEmpty: true }, ...declaredFacts({
    ...projectCoherentObservation(after, "composer"), decision: "ACT",
    mutationOutcome: fact.fact.mutationOutcome, browserFact: fact.fact, nativeFailureCode: null }) });
};
