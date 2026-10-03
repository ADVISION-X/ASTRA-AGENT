import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success, type GptChildHandler } from "../../web/child-handler.js";
import { GPT_PROFILE_TRIGGER_SELECTOR } from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { PROFILE_TOPOLOGY_QUERIES, profileClosedReady, profileOpenReady, projectTopology, topology } from "./observation.js";

const CLOSE_POSTCONDITION = Object.freeze({ queries: Object.freeze(PROFILE_TOPOLOGY_QUERIES.map(query =>
  Object.freeze({ ...query, expectedEligibleCount: query.queryId === "popup" ? 0 : 1 }))) });

export const closeGptExecutionProfileHandler: GptChildHandler<"close_gpt_execution_profile"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]); profileFromIntent(intent);
  const browser = requireBrowser(context), observed = await topology(browser, context.signal);
  if (profileClosedReady(observed)) return success({ value: { state: "profile-popup-closed" },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  if (!profileOpenReady(observed)) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID");
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1, postClickObservation: CLOSE_POSTCONDITION });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) {
    throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const packet = mutation && typeof mutation === "object" && !Array.isArray(mutation)
    ? (mutation as Readonly<Record<string, unknown>>).postconditionObservation : null;
  const readback = projectTopology(decodeCoherentObservationPacket(packet, PROFILE_TOPOLOGY_QUERIES));
  if (!profileClosedReady(readback)) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  const { fact } = projected;
  return success({ value: { state: "profile-popup-closed" }, ...declaredFacts({ ...readback.facts,
    decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
    factResultIds: [...readback.facts.factResultIds, fact.evidenceRef],
    authorityRefHashes: [...readback.facts.authorityRefHashes, fact.evidenceHash], browserFact: fact, nativeFailureCode: null }) });
};
