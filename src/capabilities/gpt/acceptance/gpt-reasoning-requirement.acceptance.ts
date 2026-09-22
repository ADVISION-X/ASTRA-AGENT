import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { buildGptExecutionProfile } from "../index.js";
import {
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "./gpt-page-fixture-selectors.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { execute, profile, profileFacts } from "./gpt-exact-target-profile-fixture.js";
import {
  exerciseReasoningEvidenceReadback,
} from "./gpt-failure-evidence-readback.acceptance-support.js";

const exactReasoningProfile = (startTier: "high" | "extra_high" | "pro_standard") => buildGptExecutionProfile({
  profileRef: `acceptance:gpt-profile:${startTier}`,
  startModelDisplayName: "GPT-5.6 Sol",
  startReasoningTier: startTier,
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});
const reasoningInput = (executionProfile: typeof profile) => Object.freeze({
  profile: executionProfile,
  actualModelDisplayName: executionProfile.startModelDisplayName,
  modelTargetRefHash: `sha256:${"2".repeat(64)}` as const,
  modelDocumentRefHash: `sha256:${"3".repeat(64)}` as const,
});

const runReasoning = async (input: Readonly<{
  executionProfile: typeof profile;
  maximum: number;
  current: number;
  readbackCurrent?: number;
}>) => {
  let current = input.current;
  let keypresses = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      assert.equal(intent.queries.some((query) => ["popup", "simple-panel", "trigger"].includes(query.queryId)),
        false, "G17 must not gate reasoning on the old profile shell");
      assert.equal(intent.queries.some((query) => query.queryId === "pro-fifth-label"
        && query.textEquals === "Pro，第 5 项，共 5 项。"), true);
      return coherentObservationPacket(intent, profileFacts(intent, true, current, true, input.maximum));
    }
    if (intent.kind === "keypress") {
      keypresses += 1;
      const target = Math.min(reasoningTierUiValue[input.executionProfile.startReasoningTier], input.maximum);
      const delta = target - input.current;
      assert.equal(intent.selector, GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
        "the actionable target must remain the visible enabled capability menu item");
      assert.equal(intent.key, delta < 0 ? "ArrowLeft" : "ArrowRight");
      assert.equal(intent.repeat, Math.abs(delta));
      assert.equal(intent.postKeypressMatch.readEligibility, "non-actionable-aria-state");
      assert.equal(intent.postKeypressMatch.selector,
        `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${target}']`);
      current = input.readbackCurrent ?? target;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_REASONING_INTENT:${intent.kind}`);
  });
  const result = await execute(
    "select_gpt_reasoning_from_start_v3", fixture.browser, reasoningInput(input.executionProfile),
  );
  return Object.freeze({ result, fixture, keypresses });
};

for (const reasoningCase of [
  Object.freeze({ maximum: 4, current: 4, resolvedTier: "pro_standard" as const,
    resolvedValue: 4, degraded: false, mutation: "no" as const }),
  Object.freeze({ maximum: 3, current: 3, resolvedTier: "extra_high" as const,
    resolvedValue: 3, degraded: true, mutation: "no" as const }),
  Object.freeze({ maximum: 2, current: 0, resolvedTier: "high" as const,
    resolvedValue: 2, degraded: true, mutation: "confirmed" as const }),
  Object.freeze({ maximum: 2, current: 2, resolvedTier: "high" as const,
    resolvedValue: 2, degraded: true, mutation: "no" as const }),
]) {
  const { result, fixture, keypresses } = await runReasoning({ executionProfile: profile, ...reasoningCase });
  assert.equal(result.status, "success", result.failureCode ?? "adaptive reasoning selection failed");
  assert.deepEqual(result.reasoningRequirementResult, {
    startTier: "pro_standard",
    startValue: 4,
    observedScale: { min: 0, max: reasoningCase.maximum, currentBefore: reasoningCase.current },
    resolvedTier: reasoningCase.resolvedTier,
    resolvedValue: reasoningCase.resolvedValue,
    degraded: reasoningCase.degraded,
    currentValue: reasoningCase.resolvedValue,
    mutationOutcome: reasoningCase.mutation,
    browserOutcome: reasoningCase.mutation === "confirmed" ? "CONFIRMED" : null,
    gptPostcondition: "passed",
  });
  assert.equal(result.value?.state, reasoningCase.mutation === "confirmed" ? "selected" : "already-selected");
  assert.equal(result.proof.committedMutation, reasoningCase.mutation);
  assert.equal(keypresses, reasoningCase.mutation === "confirmed" ? 1 : 0);
  assert.equal(fixture.physicalMutations(), reasoningCase.mutation === "confirmed" ? 1 : 0);
  if (reasoningCase.mutation === "confirmed") {
    await exerciseReasoningEvidenceReadback(result, reasoningInput(profile));
  }
}

{
  const { result, fixture } = await runReasoning({ executionProfile: profile, maximum: 4, current: 1 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_REASONING_TIER_UNAVAILABLE",
    "max=4 without the current Pro fifth-label fact must not be called Pro-available");
  assert.equal(fixture.physicalMutations(), 0);
}

for (const maximum of [2, 4]) {
  const exactHigh = exactReasoningProfile("high");
  const { result, fixture } = await runReasoning({ executionProfile: exactHigh, maximum, current: 2 });
  assert.equal(result.status, "success", result.failureCode ?? "exact high must remain available");
  assert.deepEqual(result.reasoningRequirementResult, {
    startTier: "high", startValue: 2,
    observedScale: { min: 0, max: maximum, currentBefore: 2 },
    resolvedTier: "high", resolvedValue: 2, degraded: false, currentValue: 2,
    mutationOutcome: "no", browserOutcome: null, gptPostcondition: "passed",
  });
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const exactExtraHigh = exactReasoningProfile("extra_high");
  const { result, fixture, keypresses } = await runReasoning({
    executionProfile: exactExtraHigh, maximum: 4, current: 2,
  });
  assert.equal(result.status, "success");
  assert.deepEqual(result.reasoningRequirementResult, {
    startTier: "extra_high", startValue: 3,
    observedScale: { min: 0, max: 4, currentBefore: 2 },
    resolvedTier: "extra_high", resolvedValue: 3, degraded: false, currentValue: 3,
    mutationOutcome: "confirmed", browserOutcome: "CONFIRMED", gptPostcondition: "passed",
  });
  assert.equal(keypresses, 1);
  assert.equal(fixture.physicalMutations(), 1);
}

for (const fallback of [
  Object.freeze({ tier: "extra_high" as const, maximum: 2, resolvedTier: "high", resolvedValue: 2 }),
  Object.freeze({ tier: "pro_standard" as const, maximum: 2, resolvedTier: "high", resolvedValue: 2 }),
  Object.freeze({ tier: "pro_standard" as const, maximum: 3, resolvedTier: "extra_high", resolvedValue: 3 }),
]) {
  const startProfile = exactReasoningProfile(fallback.tier);
  const { result, fixture } = await runReasoning({ executionProfile: startProfile, maximum: fallback.maximum, current: 1 });
  assert.equal(result.status, "success", result.failureCode ?? "fallback failed");
  assert.equal(result.reasoningRequirementResult?.resolvedTier, fallback.resolvedTier);
  assert.equal(result.reasoningRequirementResult?.resolvedValue, fallback.resolvedValue);
  assert.equal(result.reasoningRequirementResult?.degraded, true);
  assert.equal(fixture.physicalMutations(), 1);
}

for (const maximum of [1, 5]) {
  const { result, fixture } = await runReasoning({ executionProfile: profile, maximum, current: 0 });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(result.reasoningRequirementResult?.resolvedValue, null);
  assert.equal(fixture.physicalMutations(), 0, `unknown 0..${maximum} scale must fail without mutation`);
}

for (const malformed of [
  Object.freeze({ name: "nonzero-minimum", minimum: 1, current: 1, maximum: 4 }),
  Object.freeze({ name: "current-out-of-range", minimum: 0, current: 5, maximum: 4 }),
]) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent,
      profileFacts(intent, true, malformed.current, true, malformed.maximum, malformed.minimum));
    throw new Error(`MALFORMED_REASONING_SCALE_MUST_NOT_ACT:${malformed.name}:${intent.kind}`);
  });
  const result = await execute("select_gpt_reasoning_from_start_v3", fixture.browser, reasoningInput(profile));
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

for (const state of ["missing", "disabled", "ambiguous"] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind !== "observe") throw new Error(`INVALID_REASONING_STATE_MUST_NOT_ACT:${state}:${intent.kind}`);
    const facts = profileFacts(intent, true, 1);
    if (state === "missing") return coherentObservationPacket(intent, {
      ...facts,
      "reasoning-value": { rawCount: 1, eligibleCount: 1, matches: [{}] },
    });
    const queryId = state === "disabled" ? "enabled-reasoning-control" : "reasoning-value";
    return coherentObservationPacket(intent, {
      ...facts,
      [queryId]: state === "disabled"
        ? { rawCount: 1, eligibleCount: 0, rejections: [{ index: 0, reasons: ["ARIA_DISABLED"] }] }
        : { rawCount: 2, eligibleCount: 2 },
    });
  });
  const result = await execute("select_gpt_reasoning_from_start_v3", fixture.browser, reasoningInput(profile));
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { result, fixture } = await runReasoning({
    executionProfile: profile, maximum: 2, current: 0, readbackCurrent: 1,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_PENDING:"));
  assert.deepEqual(result.reasoningRequirementResult, {
    startTier: "pro_standard", startValue: 4,
    observedScale: { min: 0, max: 2, currentBefore: 0 },
    resolvedTier: "high", resolvedValue: 2, degraded: true, currentValue: 1,
    mutationOutcome: "confirmed", browserOutcome: "CONFIRMED", gptPostcondition: "failed",
  });
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(fixture.physicalMutations(), 1);
}

assert.deepEqual(reasoningTierUiValue, {
  fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4,
});
assert.equal(reasoningTierUiLabel.fast, "极速");
assert.equal(GPT_PROFILE_REASONING_CONTROL_SELECTOR, "[role='menuitem'][aria-label='能力']");
assert.equal(GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])");
assert.equal(GPT_PROFILE_REASONING_VALUE_SELECTOR, "[data-model-reasoning-effort-slider] [role='slider']");
assert.equal(GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])");
