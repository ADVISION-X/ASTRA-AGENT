import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  GPT_PROFILE_TRIGGER_SELECTOR,
} from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { PROFILE_TOPOLOGY_QUERIES, profileClosedReady, profileOpenReady,
  projectTopology, topology } from "./observation.js";

const CLOSE_POSTCONDITION = Object.freeze({
  queries: Object.freeze(PROFILE_TOPOLOGY_QUERIES.map((query) => Object.freeze({
    ...query, expectedEligibleCount: query.queryId === "popup" ? 0 : 1,
  }))),
  timeoutMs: 5_000,
});

export const closeGptExecutionProfileHandler: GptChildHandler<"close_gpt_execution_profile"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await topology(browser);
    if (profileClosedReady(observed)) return success({
      value: { state: "profile-popup-closed" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (!profileOpenReady(observed)) {
      throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID");
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR, expectedMatches: 1,
      postClickObservation: CLOSE_POSTCONDITION,
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const readback = projectTopology(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation, PROFILE_TOPOLOGY_QUERIES,
    ));
    if (!profileClosedReady(readback)) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
    const browserFact = requireConfirmedBrowserFact(intent, context);
    return success({
      value: { state: "profile-popup-closed" },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
