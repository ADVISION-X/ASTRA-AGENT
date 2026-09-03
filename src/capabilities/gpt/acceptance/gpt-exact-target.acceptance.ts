import assert from "../../../../scripts/audit/shared/governance-exam-assert.js";

import {
  buildGptExecutionProfile,
  GPT_CHILD_CAPABILITY_CONTRACTS,
} from "../index.js";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR,
} from "../web/contracts/model-selection-v2.contract.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "../web/contracts/execution-profile.contract.js";
import {
  coherentObservationPacket,
  EXPECTED_GPT_CHILD_IDS,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { assertGptExactTargetSourceShape } from "./gpt-exact-target-source-support.js";

const { gpt, execute } = createGptAcceptanceHarness("gpt-exact-target");
assert.deepEqual(gpt.listChildCapabilityIds(), EXPECTED_GPT_CHILD_IDS);
assert.equal(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).length, 27);
assertGptExactTargetSourceShape(import.meta.url);

const profile = buildGptExecutionProfile({
  profileRef: "acceptance:gpt-profile",
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});

const profileFacts = (open: boolean) => ({
  popup: { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "simple-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "enabled-reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "reasoning-value": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  trigger: {
    rawCount: 1, eligibleCount: 1,
    matches: [{ ariaExpanded: open ? "true" : "false" }],
  },
});

let profileOpen = false;
const profileFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, profileFacts(profileOpen));
  if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) {
    profileOpen = intent.postClickMatch?.expectedMatches === 1;
    return { postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_INTENT:${intent.kind}`);
});
const openedProfile = await execute("open_gpt_execution_profile", profileFixture.browser, { profile });
assert.equal(openedProfile.status, "success", openedProfile.failureCode ?? "profile open failed");
assert.equal(openedProfile.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.equal(profileFixture.physicalMutations(), 1);
const closedProfile = await execute("close_gpt_execution_profile", profileFixture.browser, { profile });
assert.equal(closedProfile.status, "success", closedProfile.failureCode ?? "profile close failed");
assert.equal(profileFixture.physicalMutations(), 2);

const modelFacts = (open: boolean, checked?: "true" | "false") => ({
  popup: { rawCount: 1, eligibleCount: 1 },
  entry: { rawCount: 1, eligibleCount: 1 },
  "expanded-entry": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "openable-entry": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
  "simple-panel": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
  "advanced-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  ...(checked === undefined ? {} : {
    "model-choice": { rawCount: 1, eligibleCount: 1, matches: [{ ariaChecked: checked }] },
  }),
});

for (const initiallyOpen of [true, false]) {
  let open = initiallyOpen;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(open));
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
      open = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_MODEL_OPEN_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "model selector failed");
  assert.equal(open, true);
  assert.equal(fixture.physicalMutations(), initiallyOpen ? 0 : 1);
}

for (const checked of ["true", "false"] as const) {
  let open = true;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(open, checked));
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
      assert.equal(intent.expectedTextEquals, profile.modelDisplayName);
      assert.deepEqual(intent.postClickMatch, {
        selector: GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR,
        expectedMatches: 1,
        timeoutMs: 5_000,
      });
      open = false;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_MODEL_SELECT_INTENT:${intent.kind}`);
  });
  const result = await execute("select_exact_gpt_model_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "model selection failed");
  assert.equal(result.value?.previousChecked, checked);
  assert.equal(fixture.physicalMutations(), 1);
}

const blockedReasoningFixture = fakeBrowser(() => {
  throw new Error("BLOCKED_REASONING_MUST_NOT_TOUCH_BROWSER");
});
const blockedReasoning = await execute(
  "ensure_exact_gpt_reasoning_tier", blockedReasoningFixture.browser, { profile },
);
assert.equal(blockedReasoning.status, "failed");
assert.equal(blockedReasoning.failureCode, "GPT_BROWSER_COHERENT_REASONING_HANDOFF_REQUIRED");
assert.equal(blockedReasoningFixture.documentCalls(), 0);
assert.equal(blockedReasoningFixture.physicalMutations(), 0);
assert.equal(blockedReasoning.proof.internalDecisionCode, "FAIL_CLOSED");

assert.deepEqual(reasoningTierUiValue, {
  fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4, pro_extended: 4,
});
assert.equal(reasoningTierUiLabel.fast, "极速");
assert.equal(GPT_PROFILE_REASONING_CONTROL_SELECTOR, "[role='menuitem'][aria-label='能力']");
assert.equal(GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])");
assert.equal(GPT_PROFILE_REASONING_VALUE_SELECTOR, "[data-model-reasoning-effort-slider] [role='slider']");
assert.equal(GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])");

emitQualityProofObservation({
  lawId: "LAW-GPT-001-V20",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:3", "forbidden:4", "forbidden:5", "forbidden:9", "summary"],
  locator: "acceptance:gpt-exact-target:coherent-ready-subset",
  observedValue: "coherent profile and model Children prove same-revision DONE or one confirmed mutation; missing reasoning handoff fails closed before Browser use",
});
emitQualityProofObservation({
  lawId: "LAW-GPT-001-V20",
  evidenceMode: "exam.property",
  clauses: ["forbidden:10", "forbidden:13", "forbidden:15", "forbidden:16", "summary"],
  locator: "acceptance:gpt-exact-target:browser-handoff-gate",
  observedValue: "external Browser dependency gates are typed and produce zero DOM calls and zero physical mutations",
});
