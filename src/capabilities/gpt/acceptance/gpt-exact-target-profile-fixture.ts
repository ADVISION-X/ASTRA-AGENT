import { buildGptExecutionProfile } from "../index.js";
import { coherentObservationPacket } from "./gpt-exact-target-browser-fixture.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";

export const { execute } = createGptAcceptanceHarness("gpt-exact-target");

export const profile = buildGptExecutionProfile({
  profileRef: "acceptance:gpt-profile",
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: {
    selectionPolicy: "exact-or-observed-maximum",
    requestedTier: "pro_standard",
  },
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});

const reasoningValueFacts = (
  ready: boolean,
  eligible: boolean,
  current: number,
  maximum: number,
  minimum: number,
) => ({
  rawCount: ready ? 1 : 0,
  eligibleCount: eligible ? 1 : 0,
  matches: eligible ? [{
    ariaValueMin: String(minimum), ariaValueMax: String(maximum), ariaValueNow: String(current),
  }] : [],
  rejections: ready && !eligible ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [],
});

export const profileFacts = (
  intent: Parameters<typeof coherentObservationPacket>[0],
  open: boolean,
  reasoningCurrent = 0,
  reasoningReady = open,
  reasoningMaximum = 4,
  reasoningMinimum = 0,
) => {
  const reasoningQuery = intent.queries.find((query) => query.queryId === "reasoning-value");
  const reasoningEligible = reasoningReady
    && reasoningQuery?.readEligibility === "non-actionable-aria-state";
  return ({
    popup: { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0,
      matches: open ? [{ ariaLabelledBy: "profile-trigger" }] : [] },
    "simple-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "enabled-reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "reasoning-value": reasoningValueFacts(
      reasoningReady, reasoningEligible, reasoningCurrent, reasoningMaximum, reasoningMinimum,
    ),
    trigger: {
      rawCount: 1, eligibleCount: 1,
      matches: [{ id: "profile-trigger", ariaExpanded: open ? "true" : "false" }],
    },
    composer: { rawCount: 1, eligibleCount: 1 },
  });
};
