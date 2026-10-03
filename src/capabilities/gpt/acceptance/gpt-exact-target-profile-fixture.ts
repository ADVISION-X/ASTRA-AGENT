import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { buildGptExecutionProfile } from "../index.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
export const { execute } = createGptAcceptanceHarness("gpt-exact-target");
export const profile = buildGptExecutionProfile({ profileRef: "acceptance:gpt-profile", startModelDisplayName: "GPT-5.6 Sol",
  requestedReasoningValue: 5, executorIdentityRef: "acceptance:executor", acceptanceRef: "acceptance:gpt-exact-target", acceptanceVersion: "v1" });
export const profileFacts = (intent: Parameters<typeof coherentObservationPacket>[0], open: boolean,
  reasoningCurrent = 0, reasoningReady = open, reasoningMaximum = 4, reasoningMinimum = 0) => {
  const read = reasoningReady && intent.queries.some(query => query.queryId === "reasoning-value" && query.readEligibility === "non-actionable-aria-state");
  return {
    popup: { rawCount: Number(open), eligibleCount: Number(open), matches: open ? [{ ariaLabelledBy: "profile-trigger" }] : [] },
    "simple-panel": { rawCount: Number(open), eligibleCount: Number(open) },
    "reasoning-control": { rawCount: Number(open), eligibleCount: Number(open) },
    "enabled-reasoning-control": { rawCount: Number(open), eligibleCount: Number(open) },
    "reasoning-value": { rawCount: Number(reasoningReady), eligibleCount: Number(read), matches: read
      ? [{ ariaValueMin: String(reasoningMinimum), ariaValueMax: String(reasoningMaximum), ariaValueNow: String(reasoningCurrent) }] : [],
      rejections: reasoningReady && !read ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [] },
    trigger: { rawCount: 1, eligibleCount: 1, matches: [{ id: "profile-trigger", ariaExpanded: String(open) }] },
    "selected-model": { rawCount: Number(open), eligibleCount: Number(open), matches: open ? [{ ariaChecked: "true", inert: true }] : [] },
    composer: { rawCount: 1, eligibleCount: 1 },
  };
};
export const exerciseTransientProfileConfirmations = async (): Promise<void> => {
  for (const readyAt of [2, 3]) {
    let reads = 0;
    const fixture = fakeBrowser(intent => {
      if (intent.kind === "observe") { reads += 1; return coherentObservationPacket(intent, reads < readyAt ? {} : profileFacts(intent, true)); }
      if (intent.kind === "click" && intent.postClickObservation) {
        const queries = intent.postClickObservation.queries.map(({ expectedEligibleCount: _count, ...query }) => query);
        return { mutationCount: 1, postconditionVerified: true, postconditionObservation: coherentObservationPacket({ queries }, profileFacts({ queries }, false)) };
      }
      throw new Error(`UNEXPECTED_PROFILE_CONFIRMATION:${intent.kind}`);
    });
    const result = await execute("close_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "success", result.failureCode ?? "profile confirmation");
    assert.deepEqual(fixture.waitDurations(), readyAt === 2 ? [1500] : [1500, 3000]);
    assert.equal(reads, readyAt); assert.equal(fixture.physicalMutations(), 1);
  }
  const absent = fakeBrowser(intent => {
    assert.equal(intent.kind, "observe"); return coherentObservationPacket(intent as Extract<typeof intent, { kind: "observe" }>, {});
  });
  assert.equal((await execute("close_gpt_execution_profile", absent.browser, { profile })).status, "failed");
  assert.deepEqual(absent.waitDurations(), [1500, 3000]); assert.equal(absent.physicalMutations(), 0);
  const abort = new AbortController(); let reads = 0;
  const cancelled = fakeBrowser(intent => {
    assert.equal(intent.kind, "observe"); reads += 1;
    return coherentObservationPacket(intent as Extract<typeof intent, { kind: "observe" }>, {});
  }, { onWait: () => abort.abort() });
  const result = await execute("close_gpt_execution_profile", cancelled.browser, { profile }, { signal: abort.signal });
  assert.equal(result.failureCode, "GPT_EXECUTION_ABORTED"); assert.equal(reads, 1); assert.equal(cancelled.physicalMutations(), 0);
  let samples = 0;
  const contradiction = fakeBrowser(intent => {
    if (intent.kind !== "observe") throw new Error("CONTRADICTORY_PROFILE_MUST_NOT_CLICK");
    samples += 1; return coherentObservationPacket(intent, samples === 1 ? {} : { ...profileFacts(intent, false), trigger: { rawCount: 2, eligibleCount: 2 } });
  });
  assert.equal((await execute("close_gpt_execution_profile", contradiction.browser, { profile })).status, "failed");
  assert.deepEqual(contradiction.waitDurations(), [1500]); assert.equal(contradiction.physicalMutations(), 0);
};
