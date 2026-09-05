import {
  typedBrowserExecutionFailure,
  type BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import {
  executionFailure,
  failureCode,
} from "../../../../lib/execution-failure.js";
/*
 * Browser remains the mechanical observation/mutation Owner. This module alone
 * resolves the Product-frozen reasoning policy against the approved UI scales.
 */
import type {
  GptChildHandlerMap,
} from "../child-handler.js";
import type { GptChildObservation } from "../child-handler.js";
import type {
  GptChildBrowserFact,
  GptChildCapabilityIntent,
  GptReasoningRequirementResult,
} from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  recordInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import {
  decodeCoherentObservationPacket,
} from "../gpt-dom-observation.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  reasoningTierUiValue,
} from "../contracts/execution-profile.contract.js";
import {
  assertGptExecutionProfileIntegrity,
  type GptExecutionProfile,
  type GptReasoningTier,
} from "../../schema.js";
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
} from "./execution-profile-observation.js";

const profileFromIntent = (intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0]): GptExecutionProfile =>
  assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));

const failProfileOpen = (
  code: string,
  value: ProfileTopology,
  browserFact: GptChildBrowserFact | null = null,
): never => {
  const mutationOutcome = browserFact?.mutationOutcome ?? "no";
  const nativeFailureCode = profileNativeCause(value);
  throw gptExecutionFailure(`${code}:${topologyCode(value)}`, {
    mutationOutcome,
    ...(browserFact ? {
      browserEffect: Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }),
    } : {}),
    proofFacts: Object.freeze({
      ...value.facts,
      decision: "FAIL_CLOSED",
      mutationOutcome,
      browserFact,
      nativeFailureCode,
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
      ...(input.browserFact ? {
        browserEffect: Object.freeze({
          effectScope: input.browserFact.effectScope,
          childCapabilityId: input.browserFact.childCapabilityId,
          browserOutcome: input.browserFact.browserOutcome,
        }),
      } : {}),
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

const openProfilePopup = async (
  intent: GptChildCapabilityIntent<"open_gpt_execution_profile">,
  browser: BrowserTargetLease,
  observed: ProfileTopology,
): Promise<GptChildObservation<"open_gpt_execution_profile">> => {
  if (profileOpenReady(observed)) {
    return success({
      value: { state: "profile-popup-open" as const },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (!profileOpenable(observed)) {
    failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID", observed);
  }
  const mutation = await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickObservation: PROFILE_OPEN_POSTCONDITION,
  });
  const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
    ? mutation as Readonly<Record<string, unknown>> : {};
  const readback = projectTopology(decodeCoherentObservationPacket(
    mutationRecord.postconditionObservation,
    PROFILE_TOPOLOGY_QUERIES,
  ));
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  if (!profileOpenReady(readback)) {
    failProfileOpen("GPT_EXECUTION_PROFILE_POPUP_INVALID", readback, browserFact);
  }
  return success({
    value: { state: "profile-popup-open" as const },
    ...declaredFacts({
      ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
    }),
  });
};

const closeProfilePopup = async (
  intent: GptChildCapabilityIntent<"close_gpt_execution_profile">,
  browser: BrowserTargetLease,
  readbackOnly: boolean,
): Promise<GptChildObservation<"close_gpt_execution_profile">> => {
  const observed = await topology(browser);
  if (observed.popup === 0) {
    return success({
      value: { state: "profile-popup-closed" as const },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (observed.popup !== 1 || observed.trigger !== 1 || observed.triggerExpanded !== "true") {
    throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID");
  }
  if (readbackOnly) {
    throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  }
  await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
  });
  const readback = await topology(browser);
  if (readback.popup !== 0) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return success({
    value: { state: "profile-popup-closed" as const },
    ...declaredFacts({
      ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
    }),
  });
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
        timeoutMs: 5_000,
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

const ensureReasoningRequirement: NonNullable<
  GptChildHandlerMap["ensure_gpt_reasoning_requirement"]
> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]);
  const profile = profileFromIntent(intent);
  const browser = requireBrowser(context);
  const observed = await topology(browser);
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
  if (currentBefore === resolved.value) {
    return success({
      value: selectedReasoningResult({
        profile, observedScale, resolution: resolved, currentValue: currentBefore,
        mutationOutcome: "no", browserOutcome: null, state: "already-selected",
      }),
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (context.mutationMode === "readback") {
    failReasoningRequirement({
      code: "GPT_EXECUTION_PROFILE_REASONING_PENDING", profile, topology: observed,
      observedScale, resolution: resolved, currentValue: currentBefore, includeTopology: false,
    });
  }
  await executeReasoningMutation({ browser, profile, observed, observedScale, resolution: resolved, currentBefore });
  const readback = await topology(browser);
  const readbackScale = observedReasoningScale(readback);
  const browserFact = requireConfirmedBrowserFact(intent, browser);
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
    ...declaredFacts({
      ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
    }),
  });
};

export const executionProfileChildHandlers = {
  async open_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await waitForProfileHydration(browser, context.signal);
    if (!profileOpenReady(observed) && context.mutationMode === "readback") {
      failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_PENDING", observed);
    }
    return openProfilePopup(intent, browser, observed);
  },

  ensure_gpt_reasoning_requirement: ensureReasoningRequirement,

  async close_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    return closeProfilePopup(intent, requireBrowser(context), context.mutationMode === "readback");
  },
} satisfies GptChildHandlerMap;
