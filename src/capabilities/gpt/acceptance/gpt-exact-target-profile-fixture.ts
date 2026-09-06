import { buildGptExecutionProfile } from "../index.js";
import { coherentObservationPacket } from "./gpt-exact-target-browser-fixture.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";

export const { gpt, execute } = createGptAcceptanceHarness("gpt-exact-target");

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
    "reasoning-value": {
      rawCount: reasoningReady ? 1 : 0,
      eligibleCount: reasoningEligible ? 1 : 0,
      matches: reasoningEligible
        ? [{
          ariaValueMin: String(reasoningMinimum),
          ariaValueMax: String(reasoningMaximum),
          ariaValueNow: String(reasoningCurrent),
        }] : [],
      rejections: reasoningReady && !reasoningEligible
        ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [],
    },
    trigger: {
      rawCount: 1, eligibleCount: 1,
      matches: [{ id: "profile-trigger", ariaExpanded: open ? "true" : "false" }],
    },
    composer: { rawCount: 1, eligibleCount: 1 },
  });
};
