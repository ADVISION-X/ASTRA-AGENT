import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { GPT_PROFILE_TRIGGER_SELECTOR } from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import {
  PROFILE_HYDRATION_TIMEOUT_MS,
  PROFILE_OPEN_POSTCONDITION,
  PROFILE_TOPOLOGY_QUERIES,
  profileFullyAbsent,
  profileNativeCause,
  profileOpenable,
  profileOpenReady,
  projectTopology,
  topology,
  topologyCode,
  type ProfileTopology,
} from "./observation.js";

const failProfileOpen = (
  code: string,
  value: ProfileTopology,
  browserFact: GptChildBrowserFact | null = null,
): never => {
  const mutationOutcome = browserFact?.mutationOutcome ?? "no";
  throw gptExecutionFailure(`${code}:${topologyCode(value)}`, {
    mutationOutcome,
    ...(browserFact ? { browserEffect: Object.freeze({
      effectScope: browserFact.effectScope,
      childCapabilityId: browserFact.childCapabilityId,
      browserOutcome: browserFact.browserOutcome,
    }) } : {}),
    proofFacts: Object.freeze({
      ...value.facts, decision: "FAIL_CLOSED", mutationOutcome, browserFact,
      nativeFailureCode: profileNativeCause(value),
    }),
  });
};

const waitForProfileHydration = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ProfileTopology> => {
  const deadline = Date.now() + PROFILE_HYDRATION_TIMEOUT_MS;
  let observed = await topology(browser);
  const targetRefHash = observed.targetRefHash;
  const documentRefHash = observed.documentRefHash;
  while (profileFullyAbsent(observed)) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    const remaining = deadline - Date.now();
    if (remaining <= 0) failProfileOpen("GPT_EXECUTION_PROFILE_HYDRATION_TIMEOUT", observed);
    await browser.wait({
      durationMs: Math.min(remaining, Math.max(25, Math.min(250, Math.ceil(remaining / 20)))),
    });
    observed = await topology(browser);
    if (observed.targetRefHash !== targetRefHash || observed.documentRefHash !== documentRefHash) {
      failProfileOpen("GPT_EXECUTION_PROFILE_HYDRATION_DOCUMENT_CHANGED", observed);
    }
  }
  return observed;
};

export const openGptExecutionProfileHandler: GptChildHandler<"open_gpt_execution_profile"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await waitForProfileHydration(browser, context.signal);
    if (profileOpenReady(observed)) return success({
      value: { state: "profile-popup-open" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (!profileOpenable(observed)) {
      failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID", observed);
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR, expectedMatches: 1,
      postClickObservation: PROFILE_OPEN_POSTCONDITION,
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const readback = projectTopology(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation,
      PROFILE_TOPOLOGY_QUERIES,
    ));
    const browserFact = requireConfirmedBrowserFact(intent, context);
    if (!profileOpenReady(readback)) {
      failProfileOpen("GPT_EXECUTION_PROFILE_POPUP_INVALID", readback, browserFact);
    }
    return success({
      value: { state: "profile-popup-open" },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
