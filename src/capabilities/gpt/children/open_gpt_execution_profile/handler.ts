import type { GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success, type GptChildHandler } from "../../web/child-handler.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { GPT_PROFILE_TRIGGER_SELECTOR } from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { PROFILE_OPEN_POSTCONDITION, PROFILE_TOPOLOGY_QUERIES, profileNativeCause, profileOpenable,
  profileOpenReady, projectTopology, topology, topologyCode, type ProfileTopology } from "./observation.js";

const failProfileOpen = (code: string, value: ProfileTopology, fact: GptChildBrowserFact | null = null): never => {
  const mutationOutcome = fact?.mutationOutcome ?? "no";
  throw gptExecutionFailure(`${code}:${topologyCode(value)}`, { mutationOutcome,
    ...(fact ? { browserEffect: { effectScope: fact.effectScope, childCapabilityId: fact.childCapabilityId,
      browserOutcome: fact.browserOutcome } } : {}),
    proofFacts: { ...value.facts, decision: "FAIL_CLOSED", mutationOutcome, browserFact: fact,
      nativeFailureCode: profileNativeCause(value) } });
};

export const openGptExecutionProfileHandler: GptChildHandler<"open_gpt_execution_profile"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]); profileFromIntent(intent);
  const browser = requireBrowser(context), observed = await topology(browser, context.signal);
  if (profileOpenReady(observed)) return success({ value: { state: "profile-popup-open" },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  if (!profileOpenable(observed)) failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID", observed);
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1, postClickObservation: PROFILE_OPEN_POSTCONDITION });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const packet = mutation && typeof mutation === "object" && !Array.isArray(mutation)
    ? (mutation as Readonly<Record<string, unknown>>).postconditionObservation : null;
  const readback = projectTopology(decodeCoherentObservationPacket(packet, PROFILE_TOPOLOGY_QUERIES)), { fact } = projected;
  if (!profileOpenReady(readback)) failProfileOpen("GPT_EXECUTION_PROFILE_POPUP_INVALID", readback, fact);
  return success({ value: { state: "profile-popup-open" }, ...declaredFacts({ ...readback.facts,
    decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
    factResultIds: [...readback.facts.factResultIds, fact.evidenceRef],
    authorityRefHashes: [...readback.facts.authorityRefHashes, fact.evidenceHash], browserFact: fact, nativeFailureCode: null }) });
};
