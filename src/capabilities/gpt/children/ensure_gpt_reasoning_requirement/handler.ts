import {
  typedBrowserExecutionFailure,
  type BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import { failureCode } from "../../../../lib/execution-failure.js";

import type {
  GptChildBrowserFact,
  GptReasoningRequirementResult,
} from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  reasoningTierUiValue,
} from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import {
  profileNativeCause,
  profileOpenReady,
  topology,
  topologyCode,
  type ProfileTopology,
} from "./observation.js";
import type { GptExecutionProfile, GptReasoningTier } from "../../schema.js";

type ReasoningResolution = Readonly<{
  tier: GptReasoningTier;
  value: number;
  degraded: boolean;
}>;

const integerField = (value: string | null): number | null =>
  value !== null && /^(?:0|[1-9][0-9]*)$/u.test(value) ? Number(value) : null;

const observedReasoningScale = (value: ProfileTopology): GptReasoningRequirementResult["observedScale"] =>
  Object.freeze({
    min: integerField(value.reasoningMinimum),
    max: integerField(value.reasoningMaximum),
    currentBefore: integerField(value.reasoningCurrent),
  });

const resolveReasoningRequirement = (
  profile: GptExecutionProfile,
  observedMaximum: 2 | 4,
): ReasoningResolution | null => {
  const requirement = profile.reasoningRequirement;
  const requestedValue = reasoningTierUiValue[requirement.requestedTier];
  if (requirement.selectionPolicy === "exact") {
    return requestedValue <= observedMaximum
      ? Object.freeze({ tier: requirement.requestedTier, value: requestedValue, degraded: false })
      : null;
  }
  return observedMaximum === 4
    ? Object.freeze({ tier: "pro_standard", value: 4, degraded: false })
    : Object.freeze({ tier: "high", value: 2, degraded: true });
};

const reasoningRequirementResult = (input: Readonly<{
  profile: GptExecutionProfile;
  observedScale: GptReasoningRequirementResult["observedScale"];
  resolution: ReasoningResolution | null;
  currentValue: number | null;
  mutationOutcome: GptReasoningRequirementResult["mutationOutcome"];
  browserOutcome: GptReasoningRequirementResult["browserOutcome"];
  gptPostcondition: GptReasoningRequirementResult["gptPostcondition"];
}>): GptReasoningRequirementResult => Object.freeze({
  requestedTier: input.profile.reasoningRequirement.requestedTier,
  requestedValue: reasoningTierUiValue[input.profile.reasoningRequirement.requestedTier],
  selectionPolicy: input.profile.reasoningRequirement.selectionPolicy,
  observedScale: input.observedScale,
  resolvedTier: input.resolution?.tier ?? null,
  resolvedValue: input.resolution?.value ?? null,
  degraded: input.resolution?.degraded ?? false,
  currentValue: input.currentValue,
  mutationOutcome: input.mutationOutcome,
  browserOutcome: input.browserOutcome,
  gptPostcondition: input.gptPostcondition,
});

const reasoningProofFacts = (
  value: ProfileTopology,
  mutationOutcome: GptReasoningRequirementResult["mutationOutcome"],
  browserFact: GptChildBrowserFact | null,
) => Object.freeze({
  ...value.facts,
  decision: "FAIL_CLOSED" as const,
  mutationOutcome,
  browserFact,
  nativeFailureCode: profileNativeCause(value),
});

const failReasoningRequirement = (input: Readonly<{
  code: string;
  profile: GptExecutionProfile;
  topology: ProfileTopology;
  observedScale: GptReasoningRequirementResult["observedScale"];
  resolution: ReasoningResolution | null;
  currentValue: number | null;
  mutationOutcome?: GptReasoningRequirementResult["mutationOutcome"];
  browserFact?: GptChildBrowserFact | null;
  browserOutcome?: GptReasoningRequirementResult["browserOutcome"];
  gptPostcondition?: GptReasoningRequirementResult["gptPostcondition"];
  includeTopology?: boolean;
  cause?: unknown;
}>): never => {
  const mutationOutcome = input.mutationOutcome ?? input.browserFact?.mutationOutcome ?? "no";
  const browserOutcome = input.browserOutcome ?? input.browserFact?.browserOutcome ?? null;
  throw gptExecutionFailure(
    input.includeTopology === false ? input.code : `${input.code}:${topologyCode(input.topology)}`,
    {
      mutationOutcome,
      ...(input.browserFact ? { browserEffect: Object.freeze({
        effectScope: input.browserFact.effectScope,
        childCapabilityId: input.browserFact.childCapabilityId,
        browserOutcome: input.browserFact.browserOutcome,
      }) } : {}),
      proofFacts: reasoningProofFacts(input.topology, mutationOutcome, input.browserFact ?? null),
      reasoningRequirementResult: reasoningRequirementResult({
        profile: input.profile,
        observedScale: input.observedScale,
        resolution: input.resolution,
        currentValue: input.currentValue,
        mutationOutcome,
        browserOutcome,
        gptPostcondition: input.gptPostcondition ?? "failed",
      }),
      ...(input.cause === undefined ? {} : { cause: input.cause }),
    },
  );
};

const selectedReasoningResult = (input: Readonly<{
  profile: GptExecutionProfile;
  observedScale: GptReasoningRequirementResult["observedScale"];
  resolution: ReasoningResolution;
  currentValue: number;
  mutationOutcome: "no" | "confirmed";
  browserOutcome: "CONFIRMED" | null;
  state: "already-selected" | "selected";
}>) => Object.freeze({
  ...reasoningRequirementResult({
    profile: input.profile,
    observedScale: input.observedScale,
    resolution: input.resolution,
    currentValue: input.currentValue,
    mutationOutcome: input.mutationOutcome,
    browserOutcome: input.browserOutcome,
    gptPostcondition: "passed",
  }),
  state: input.state,
});

const executeReasoningMutation = async (input: Readonly<{
  browser: BrowserTargetLease;
  profile: GptExecutionProfile;
  observed: ProfileTopology;
  observedScale: GptReasoningRequirementResult["observedScale"];
  resolution: ReasoningResolution;
  currentBefore: number;
}>): Promise<void> => {
  const delta = input.resolution.value - input.currentBefore;
  try {
    await input.browser.executeDomIntent({
      kind: "keypress",
      selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
      key: delta < 0 ? "ArrowLeft" : "ArrowRight",
      repeat: Math.abs(delta) as 1 | 2 | 3 | 4,
      expectedMatches: 1,
      postKeypressMatch: {
        selector: `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${input.resolution.value}']`,
        expectedMatches: 1,
        readEligibility: "non-actionable-aria-state",
      },
    });
  } catch (error) {
    const browserFailure = typedBrowserExecutionFailure(error);
    const mutationOutcome = browserFailure?.mutationOutcome ?? "no";
    const browserOutcome = browserFailure?.browserEffect?.browserOutcome ?? null;
    failReasoningRequirement({
      code: failureCode(error, "GPT_EXECUTION_PROFILE_REASONING_MUTATION_FAILED"),
      profile: input.profile,
      topology: input.observed,
      observedScale: input.observedScale,
      resolution: input.resolution,
      currentValue: mutationOutcome === "no" ? input.currentBefore : null,
      mutationOutcome,
      browserOutcome,
      gptPostcondition: browserOutcome === "DISPATCHED" ? "pending" : "failed",
      includeTopology: false,
      cause: error,
    });
  }
};

export const ensureGptReasoningRequirementHandler:
GptChildHandler<"ensure_gpt_reasoning_requirement"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]);
  const profile = profileFromIntent(intent);
  const browser = requireBrowser(context);
  const observed = await topology(browser, context.signal);
  const observedScale = observedReasoningScale(observed);
  if (!profileOpenReady(observed)) {
    failReasoningRequirement({
      code: "GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID", profile, topology: observed,
      observedScale, resolution: null, currentValue: observedScale.currentBefore,
    });
  }
  const resolution = resolveReasoningRequirement(profile, observedScale.max as 2 | 4);
  if (!resolution) {
    failReasoningRequirement({
      code: "GPT_REASONING_TIER_UNAVAILABLE", profile, topology: observed,
      observedScale, resolution: null, currentValue: observedScale.currentBefore, includeTopology: false,
    });
  }
  const resolved = resolution as ReasoningResolution;
  const currentBefore = observedScale.currentBefore!;
  if (currentBefore === resolved.value) return success({
    value: selectedReasoningResult({
      profile, observedScale, resolution: resolved, currentValue: currentBefore,
      mutationOutcome: "no", browserOutcome: null, state: "already-selected",
    }),
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
      browserFact: null, nativeFailureCode: null }),
  });
  await executeReasoningMutation({ browser, profile, observed, observedScale, resolution: resolved, currentBefore });
  const readback = await topology(browser, context.signal);
  const readbackScale = observedReasoningScale(readback);
  const browserFact = requireConfirmedBrowserFact(intent, context);
  if (!profileOpenReady(readback) || readbackScale.min !== observedScale.min
    || readbackScale.max !== observedScale.max || readbackScale.currentBefore !== resolved.value) {
    failReasoningRequirement({
      code: "GPT_EXECUTION_PROFILE_REASONING_PENDING", profile, topology: readback,
      observedScale, resolution: resolved, currentValue: readbackScale.currentBefore, browserFact,
    });
  }
  return success({
    value: selectedReasoningResult({
      profile, observedScale, resolution: resolved, currentValue: resolved.value,
      mutationOutcome: "confirmed", browserOutcome: "CONFIRMED", state: "selected",
    }),
    ...declaredFacts({ ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
  });
};
