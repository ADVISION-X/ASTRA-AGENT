import { failureCode } from "../../../../lib/execution-failure.js";
import { typedBrowserExecutionFailure } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildBrowserFact, GptReasoningRequirementResult } from "../../contract.js";
import type { GptExecutionProfile } from "../../schema.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { profileNativeCause, reasoningControlReady, topology, topologyCode, type ProfileTopology } from "./observation.js";
import { GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR, GPT_PROFILE_REASONING_CLICK_SELECTOR,
  GPT_PROFILE_REASONING_THUMB_SELECTOR, GPT_PROFILE_REASONING_VALUE_SELECTOR } from "./selectors.js";

const integer = (value: string | null): number | null => value !== null && /^(?:0|[1-9][0-9]*)$/u.test(value) ? Number(value) : null;
const scale = (observed: ProfileTopology): GptReasoningRequirementResult["observedScale"] => Object.freeze({
  min: integer(observed.reasoningMinimum), max: integer(observed.reasoningMaximum), currentBefore: integer(observed.reasoningCurrent) });
const failRequirement = (input: Readonly<{ code: string; profile: GptExecutionProfile; observed: ProfileTopology;
  observedScale: GptReasoningRequirementResult["observedScale"]; resolvedValue: number | null; currentValue: number | null;
  fact?: GptChildBrowserFact; cause?: unknown }>): never => {
  const browserFailure = typedBrowserExecutionFailure(input.cause), fact = input.fact;
  const mutationOutcome = fact?.mutationOutcome ?? browserFailure?.mutationOutcome ?? "no";
  const browserOutcome = fact?.browserOutcome ?? browserFailure?.browserEffect?.browserOutcome ?? null;
  throw gptExecutionFailure(`${input.code}:${topologyCode(input.observed)}`, { mutationOutcome,
    ...(fact ? { browserEffect: { effectScope: fact.effectScope, childCapabilityId: fact.childCapabilityId, browserOutcome: fact.browserOutcome } } : {}),
    proofFacts: { ...input.observed.facts, decision: "FAIL_CLOSED", mutationOutcome, browserFact: fact ?? null,
      nativeFailureCode: profileNativeCause(input.observed) },
    reasoningRequirementResult: { requestedValue: input.profile.requestedReasoningValue, observedScale: input.observedScale,
      resolvedValue: input.resolvedValue, currentValue: input.currentValue, mutationOutcome, browserOutcome,
      gptPostcondition: browserOutcome === "DISPATCHED" ? "pending" : "failed" },
    ...(input.cause === undefined ? {} : { cause: input.cause }) });
};

export const selectGptReasoningFromStartV3Handler: GptChildHandler<"select_gpt_reasoning_from_start_v3"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]);
  const profile = profileFromIntent(intent), browser = requireBrowser(context), observed = await topology(browser, context.signal);
  const observedScale = scale(observed);
  if (!reasoningControlReady(observed)) failRequirement({ code: "GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID",
    profile, observed, observedScale, resolvedValue: null, currentValue: observedScale.currentBefore });
  if (profile.requireExactReasoning && profile.requestedReasoningValue > observedScale.max!) {
    failRequirement({ code: "GPT_EXECUTION_PROFILE_REASONING_EXACT_UNAVAILABLE", profile, observed, observedScale,
      resolvedValue: null, currentValue: observedScale.currentBefore });
  }
  const resolvedValue = profile.requireExactReasoning ? profile.requestedReasoningValue
    : Math.min(profile.requestedReasoningValue, observedScale.max!);
  const currentBefore = observedScale.currentBefore!;
  const delta = resolvedValue - currentBefore;
  try {
    await browser.executeDomIntent(delta === 0
      ? { kind: "click", selector: GPT_PROFILE_REASONING_CLICK_SELECTOR, expectedMatches: 1,
        requiredClickPointSelector: GPT_PROFILE_REASONING_THUMB_SELECTOR,
        postClickMatch: { selector: `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${resolvedValue}']`,
          expectedMatches: 1, readEligibility: "non-actionable-aria-state" } }
      : { kind: "keypress", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR, key: delta < 0 ? "ArrowLeft" : "ArrowRight",
        repeat: Math.abs(delta) as 1 | 2 | 3 | 4 | 5, expectedMatches: 1,
        postKeypressMatch: { selector: `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${resolvedValue}']`,
          expectedMatches: 1, readEligibility: "non-actionable-aria-state" } });
  } catch (cause) {
    const projected = projectBrowserFact(intent, context);
    failRequirement({ code: failureCode(cause, "GPT_EXECUTION_PROFILE_REASONING_MUTATION_FAILED"), profile, observed,
      observedScale, resolvedValue, currentValue: projected?.outcome.physicalInputCount === 0 ? currentBefore : null,
      ...(projected ? { fact: projected.fact } : {}), cause });
  }
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount !== 1
    || projected.fact.mutationOutcome !== "confirmed") throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  const readback = await topology(browser, context.signal), readbackScale = scale(readback), { fact } = projected;
  if (!reasoningControlReady(readback) || readbackScale.min !== observedScale.min || readbackScale.max !== observedScale.max
    || readbackScale.currentBefore !== resolvedValue) failRequirement({ code: "GPT_EXECUTION_PROFILE_REASONING_PENDING", profile,
      observed: readback, observedScale, resolvedValue, currentValue: readbackScale.currentBefore, fact });
  return success({ value: { requestedValue: profile.requestedReasoningValue, observedScale, resolvedValue, currentValue: resolvedValue,
    mutationOutcome: "confirmed", browserOutcome: "CONFIRMED", gptPostcondition: "passed", state: "selected" },
    ...declaredFacts({ ...readback.facts, decision: "ACT", mutationOutcome: "confirmed", browserFact: fact, nativeFailureCode: null,
      factResultIds: [...readback.facts.factResultIds, fact.evidenceRef], authorityRefHashes: [...readback.facts.authorityRefHashes, fact.evidenceHash] }) });
};
