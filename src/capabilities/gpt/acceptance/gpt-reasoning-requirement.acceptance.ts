import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { buildGptExecutionProfile } from "../index.js";
import { GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR, GPT_PROFILE_REASONING_VALUE_SELECTOR } from "./gpt-page-fixture-selectors.js";
import { GPT_PROFILE_REASONING_CLICK_SELECTOR, GPT_PROFILE_REASONING_THUMB_SELECTOR } from
  "../children/select_gpt_reasoning_from_start_v3/selectors.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { execute, profile, profileFacts } from "./gpt-exact-target-profile-fixture.js";

const requestedProfile = (value: number) => buildGptExecutionProfile({
  profileRef: `acceptance:reasoning:${value}`,
  startModelDisplayName: "GPT-5.6 Sol",
  requestedReasoningValue: value,
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});
const reasoningInput = (executionProfile: typeof profile) => Object.freeze({
  profile: executionProfile,
});

const runReasoning = async (input: Readonly<{
  executionProfile: typeof profile;
  maximum: number;
  current: number;
  minimum?: number;
  readbackCurrent?: number;
  enabledControls?: number;
  sliders?: number;
}>) => {
  let current = input.current;
  let keypresses = 0;
  let sliderClicks = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      assert.equal(intent.queries.some((query) => ["pro-fifth-label", "pro-disabled"].includes(query.queryId)),
        false, "Pro label and radio are not part of the numeric contract");
      assert.deepEqual(intent.queries.map((query) => query.queryId),
        ["enabled-reasoning-control", "reasoning-value"],
        "G17 must read only the actionable control and its numeric slider");
      const facts = profileFacts(intent, true, current, true, input.maximum, input.minimum ?? 0);
      return coherentObservationPacket(intent, {
        ...facts,
        ...(input.enabledControls === undefined ? {} : {
          "enabled-reasoning-control": { rawCount: input.enabledControls,
            eligibleCount: input.enabledControls },
        }),
        ...(input.sliders === undefined ? {} : {
          "reasoning-value": { rawCount: input.sliders, eligibleCount: input.sliders,
            matches: input.sliders === 0 ? [] : facts["reasoning-value"]?.matches },
        }),
      });
    }
    if (intent.kind === "keypress") {
      keypresses += 1;
      const target = Math.min(input.executionProfile.requestedReasoningValue, input.maximum);
      const delta = target - input.current;
      assert.equal(intent.selector, GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR);
      assert.equal(intent.key, delta < 0 ? "ArrowLeft" : "ArrowRight");
      assert.equal(intent.repeat, Math.abs(delta));
      assert.equal(intent.postKeypressMatch.selector,
        `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${target}']`);
      current = input.readbackCurrent ?? target;
      return { postconditionVerified: true };
    }
    if (intent.kind === "click") {
      sliderClicks += 1;
      const target = Math.min(input.executionProfile.requestedReasoningValue, input.maximum);
      assert.equal(input.current, target, "slider click is only for an already selected value");
      assert.equal(intent.selector, GPT_PROFILE_REASONING_CLICK_SELECTOR);
      assert.equal(intent.requiredClickPointSelector, GPT_PROFILE_REASONING_THUMB_SELECTOR);
      assert.equal(intent.postClickMatch?.selector,
        `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${target}']`);
      current = input.readbackCurrent ?? target;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_REASONING_INTENT:${intent.kind}`);
  });
  const result = await execute("select_gpt_reasoning_from_start_v3", fixture.browser,
    reasoningInput(input.executionProfile));
  return { result, fixture, keypresses, sliderClicks };
};

for (const c of [
  { requested: 5, maximum: 5, current: 0, target: 5, mutation: "confirmed" },
  { requested: 5, maximum: 4, current: 4, target: 4, mutation: "confirmed" },
  { requested: 5, maximum: 3, current: 1, target: 3, mutation: "confirmed" },
  { requested: 4, maximum: 3, current: 3, target: 3, mutation: "confirmed" },
  { requested: 4, maximum: 5, current: 5, target: 4, mutation: "confirmed" },
  { requested: 0, maximum: 0, current: 0, target: 0, mutation: "confirmed" },
] as const) {
  const executionProfile = requestedProfile(c.requested);
  const { result, fixture, keypresses, sliderClicks } = await runReasoning({
    executionProfile, maximum: c.maximum, current: c.current,
  });
  assert.equal(result.status, "success", result.failureCode ?? "numeric reasoning failed");
  assert.deepEqual(result.reasoningRequirementResult, {
    requestedValue: c.requested,
    observedScale: { min: 0, max: c.maximum, currentBefore: c.current },
    resolvedValue: c.target,
    currentValue: c.target,
    mutationOutcome: c.mutation,
    browserOutcome: "CONFIRMED",
    gptPostcondition: "passed",
  });
  assert.equal(keypresses, c.current === c.target ? 0 : 1);
  assert.equal(sliderClicks, c.current === c.target ? 1 : 0);
  assert.equal(fixture.physicalMutations(), 1);
  assert.equal(result.status, "success");
  assert.equal(result.reasoningRequirementResult?.requestedValue, executionProfile.requestedReasoningValue);
}

for (const enabledControls of [0, 2]) {
  const { result, fixture } = await runReasoning({
    executionProfile: profile, maximum: 4, current: 1, enabledControls,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

for (const sliders of [0, 2]) {
  const { result, fixture } = await runReasoning({
    executionProfile: profile, maximum: 4, current: 1, sliders,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

for (const malformed of [
  { minimum: 1, maximum: 4, current: 1 },
  { minimum: 0, maximum: 4, current: 5 },
  { minimum: 0, maximum: 6, current: 0 },
]) {
  const { result, fixture } = await runReasoning({ executionProfile: profile, ...malformed });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { result, fixture } = await runReasoning({
    executionProfile: profile, maximum: 4, current: 0, readbackCurrent: 1,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_PENDING:"));
  assert.equal(result.reasoningRequirementResult?.resolvedValue, 4);
  assert.equal(result.reasoningRequirementResult?.currentValue, 1);
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { result, fixture, sliderClicks } = await runReasoning({
    executionProfile: requestedProfile(4), maximum: 4, current: 4, readbackCurrent: 3,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_PENDING:"));
  assert.equal(sliderClicks, 1);
  assert.equal(fixture.physicalMutations(), 1);
}
