/**
 * facebook-non-product-video-flow-smoke.ts
 *
 * Structural smoke test for the product_no flow:
 *   1. SCROLL_BROWSER_VIEWPORT_ONCE (skip to next video — no save)
 *
 * Uses in-process stub ports — no Chrome, no AI, no network.
 * Verifies:
 *   - dispatchRegisteredAbilitySequence handles scroll-only sequence
 *   - NO evidence record written to forensics (product_no = skip)
 *   - NO post-comment screenshot taken (no clicks in sequence)
 *   - ability_result logged for scroll
 */

import { dispatchRegisteredAbilitySequence } from "../../src/capabilities/orchestration/runtime/dispatch-sequence.js";
import type { DispatchSequenceContext } from "../../src/capabilities/orchestration/runtime/dispatch-sequence.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../../src/capabilities/orchestration/contract.js";
import { createInitialMissionState } from "../../src/capabilities/orchestration/runtime/mission-state.js";
import { upsertMissionState } from "../../src/capabilities/orchestration/runtime/mission-state.js";

// ── Stubs ────────────────────────────────────────────────────────────────────

const MISSION_ID = "smoke-product-no-mission";
const RUN_ID = "smoke-product-no-run";
const ROUND_ID = "smoke-product-no-round";

const appendedRecords: unknown[] = [];
const dispatched: { abilityGroupId: string; childCapabilityId: string }[] = [];
let screenshotCaptureCount = 0;

const stubNerveBus = {
  dispatchAbilityCommand: async (cmd: Record<string, unknown>) => {
    dispatched.push({
      abilityGroupId: cmd["abilityGroupId"] as string,
      childCapabilityId: cmd["childCapabilityId"] as string,
    });
    return { status: "success" as const, failureReason: null };
  },
} as unknown as DispatchSequenceContext["nerveBus"];

const stubForensics = {
  appendRecord: async (record: unknown) => {
    appendedRecords.push(record);
    return { status: "success" as const, failureReason: null };
  },
} as unknown as DispatchSequenceContext["forensics"];

const stubGeometryGuard = {
  execute: async () => ({
    guardDecision: "allow" as const,
    normalizedClickPoint: { x: 640, y: 360 },
    normalizedBbox: null,
    geometryGuardRef: "geo-stub-ref",
    runtimeProof: { proofId: "geo-proof-stub" },
    output: { outputRef: "geo-output-stub" },
    failureReason: null,
    reviewRequiredReason: null,
  }),
} as unknown as DispatchSequenceContext["geometryGuard"];

const stubScreenshotAbilityGroup = {
  execute: async () => {
    screenshotCaptureCount++;
    return {
      status: "success" as const,
      screenshotRef: "/tmp/unexpected-stub.png",
      aiReadableImagePath: "/tmp/unexpected-stub.png",
      screenshotProof: {
        proofId: "proof-stub",
        abilityGroupId: "screenshot",
        childCapabilityId: "capture-browser-viewport",
        missionId: MISSION_ID,
        runId: RUN_ID,
        sessionId: null,
        roundId: ROUND_ID,
        stepId: "step-stub",
        capabilityCallId: "cap-stub",
        nerveBusEnvelopeId: "nbe-stub",
        inputRef: "in-stub",
        screenshotRef: "/tmp/unexpected-stub.png",
        artifactRef: null,
        coordinateGridScreenshotRef: null,
        gridSpecRef: null,
        capturePhaseMs: null,
        gridRenderPhaseMs: null,
        artifactWritePhaseMs: null,
        totalScreenshotStepMs: 50,
        status: "success",
        failureReason: null,
        reviewRequiredReason: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 50,
      },
      failureReason: null,
      reviewRequiredReason: null,
    };
  },
} as unknown as DispatchSequenceContext["screenshotAbilityGroup"];

const ctx: DispatchSequenceContext = {
  nerveBus: stubNerveBus,
  forensics: stubForensics,
  geometryGuard: stubGeometryGuard,
  screenshotAbilityGroup: stubScreenshotAbilityGroup,
};

// ── Seed mission state ────────────────────────────────────────────────────────

const initialState = createInitialMissionState({
  missionId: MISSION_ID,
  runId: RUN_ID,
  humanGoal: "Mine Facebook seed product videos",
  requestedPlatform: "facebook-web",
  selectedPlatforms: ["facebook-web"],
  targetProfileRef: "fb://reels",
  targetUrl: "https://www.facebook.com/reels/",
  targetTitle: "Facebook Reels",
});
upsertMissionState({ ...initialState, status: "running" });

// ── Product-no action sequence ───────────────────────────────────────────────

const input: DispatchRegisteredAbilitySequenceInput = {
  missionId: MISSION_ID,
  runId: RUN_ID,
  roundId: ROUND_ID,
  actions: [
    {
      actionCode: "SCROLL_BROWSER_VIEWPORT_ONCE",
      reason: "Not a product video — scrolling to next",
      abilityGroupId: null,
      childCapabilityId: null,
      gridCell: null,
      required: true,
      requiresGeometryProof: false,
      inputOverrides: {
        scrollDeltaY: 900,
      },
    },
  ],
  currentEvidenceRefs: {
    originalScreenshotRef: "/tmp/original-stub.png",
    coordinateGridScreenshotRef: "/tmp/grid-stub.png",
    gridSpecRef: "grid-spec-stub-ref",
  },
  aiResultRef: "ai-result-stub-ref",
};

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write("\n[facebook-non-product-video-flow-smoke] Running product_no flow smoke test...\n\n");

  const result = await dispatchRegisteredAbilitySequence(input, ctx);

  let passed = true;
  const failures: string[] = [];

  // 1. Overall result must be success
  if (result.status !== "success") {
    passed = false;
    failures.push(`Expected overall status 'success', got '${result.status}': ${result.failureReason ?? ""}`);
  } else {
    process.stdout.write("  [✓] dispatchRegisteredAbilitySequence returned success\n");
  }

  // 2. NerveBus dispatched scroll (scroll-browser-viewport)
  const scrollDispatched = dispatched.some(d =>
    d.childCapabilityId === "scroll-browser-viewport" || d.abilityGroupId === "mouse-scroll"
  );
  if (!scrollDispatched) {
    passed = false;
    failures.push(`SCROLL_BROWSER_VIEWPORT_ONCE was not dispatched through nerveBus. dispatched: ${JSON.stringify(dispatched)}`);
  } else {
    process.stdout.write("  [✓] SCROLL_BROWSER_VIEWPORT_ONCE dispatched through nerveBus\n");
  }

  // 3. NO evidence record written (product_no = no SAVE)
  const evidenceRecords = appendedRecords.filter(r =>
    typeof r === "object" && r !== null &&
    "recordType" in r && (r as Record<string, unknown>)["recordType"] === "evidence"
  );
  if (evidenceRecords.length > 0) {
    passed = false;
    failures.push(`product_no flow should NOT write evidence records, but found ${evidenceRecords.length}`);
  } else {
    process.stdout.write("  [✓] No evidence records written (correct for product_no)\n");
  }

  // 4. NO post-comment screenshot taken (no clicks happened)
  if (screenshotCaptureCount > 0) {
    passed = false;
    failures.push(`product_no flow should NOT trigger post-comment screenshot (no clicks), but screenshotAbilityGroup.execute called ${screenshotCaptureCount} time(s)`);
  } else {
    process.stdout.write("  [✓] No post-comment screenshot taken (correct — no clicks in sequence)\n");
  }

  // 5. ability_result logged for scroll
  const scrollResult = appendedRecords.find(r => {
    if (typeof r !== "object" || r === null) return false;
    const rec = r as Record<string, unknown>;
    const payload = rec["recordPayload"] as Record<string, unknown> | undefined;
    return rec["recordType"] === "ability_result" && payload?.["actionCode"] === "SCROLL_BROWSER_VIEWPORT_ONCE";
  });
  if (!scrollResult) {
    passed = false;
    failures.push("ability_result for SCROLL_BROWSER_VIEWPORT_ONCE not found in forensics records");
  } else {
    process.stdout.write("  [✓] ability_result for scroll logged in forensics\n");
  }

  if (passed) {
    process.stdout.write("\n[facebook-non-product-video-flow-smoke] PASS — product_no flow wired correctly\n\n");
    process.exit(0);
  } else {
    process.stdout.write("\n[facebook-non-product-video-flow-smoke] FAIL\n");
    for (const f of failures) {
      process.stdout.write(`  ✗ ${f}\n`);
    }
    process.stdout.write("\n");
    process.exit(1);
  }
}

await main();
