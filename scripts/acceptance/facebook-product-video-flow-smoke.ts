/**
 * facebook-product-video-flow-smoke.ts
 *
 * Structural smoke test for the product_yes flow:
 *   1. LEFT_CLICK (open comments)
 *   2. SAVE_CURRENT_VIDEO_EVIDENCE_ONCE (like + save evidence)
 *
 * Uses in-process stub ports — no Chrome, no AI, no network.
 * Verifies:
 *   - dispatchRegisteredAbilitySequence handles click → SAVE sequence
 *   - Forensics receives an evidence record with system-injected refs
 *   - ability_result records include reason and gridCell
 *   - post-comment screenshot is attempted before SAVE
 */

import { dispatchRegisteredAbilitySequence } from "../../src/capabilities/orchestration/runtime/dispatch-sequence.js";
import type { DispatchSequenceContext } from "../../src/capabilities/orchestration/runtime/dispatch-sequence.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../../src/capabilities/orchestration/contract.js";
import { createInitialMissionState } from "../../src/capabilities/orchestration/runtime/mission-state.js";
import { upsertMissionState } from "../../src/capabilities/orchestration/runtime/mission-state.js";

// ── Stubs ────────────────────────────────────────────────────────────────────

const MISSION_ID = "smoke-product-yes-mission";
const RUN_ID = "smoke-product-yes-run";
const ROUND_ID = "smoke-product-yes-round";

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
    normalizedBbox: { x: 600, y: 340, width: 80, height: 40 },
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
      screenshotRef: "/tmp/post-comment-stub.png",
      aiReadableImagePath: "/tmp/post-comment-stub.png",
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
        screenshotRef: "/tmp/post-comment-stub.png",
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

// ── Product-yes action sequence ───────────────────────────────────────────────

const input: DispatchRegisteredAbilitySequenceInput = {
  missionId: MISSION_ID,
  runId: RUN_ID,
  roundId: ROUND_ID,
  actions: [
    {
      actionCode: "LEFT_CLICK_GRID_CELL_ONCE",
      abilityGroupId: null,
      childCapabilityId: null,
      gridCell: "C4",
      required: true,
      requiresGeometryProof: true,
      inputOverrides: {
        reason: "Click to open comments",
      },
    },
    {
      actionCode: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE",
      abilityGroupId: null,
      childCapabilityId: null,
      gridCell: null,
      required: true,
      requiresGeometryProof: false,
      inputOverrides: {
        evidenceLabel: "product-video-1",
        reason: "Identified as product video with skincare items",
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
  process.stdout.write("\n[facebook-product-video-flow-smoke] Running product_yes flow smoke test...\n\n");

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

  // 2. NerveBus dispatch called for click (not for SAVE — SAVE uses forensics directly)
  const clickDispatched = dispatched.some(d => d.childCapabilityId.includes("click") || d.abilityGroupId === "mouse-click");
  if (!clickDispatched) {
    passed = false;
    failures.push(`LEFT_CLICK_GRID_CELL_ONCE was not dispatched through nerveBus. dispatched: ${JSON.stringify(dispatched)}`);
  } else {
    process.stdout.write("  [✓] LEFT_CLICK_GRID_CELL_ONCE dispatched through nerveBus\n");
  }

  // 3. Post-comment screenshot taken (because click happened before SAVE)
  if (screenshotCaptureCount === 0) {
    passed = false;
    failures.push("Post-comment screenshot was NOT taken before SAVE (screenshotAbilityGroup.execute never called)");
  } else {
    process.stdout.write(`  [✓] Post-comment screenshot taken (${screenshotCaptureCount} capture(s))\n`);
  }

  // 4. Forensics received an evidence record with SAVE_CURRENT_VIDEO_EVIDENCE_ONCE
  const evidenceRecord = appendedRecords.find(r =>
    typeof r === "object" && r !== null &&
    "recordType" in r && (r as Record<string, unknown>)["recordType"] === "evidence"
  );
  if (!evidenceRecord) {
    passed = false;
    failures.push(`No 'evidence' type record found in forensics. Records: ${appendedRecords.length}`);
  } else {
    process.stdout.write("  [✓] Forensics received evidence record from SAVE\n");
    const rec = evidenceRecord as Record<string, unknown>;
    const payload = rec["recordPayload"] as Record<string, unknown> | undefined;
    if (payload?.["postCommentScreenshotRef"]) {
      process.stdout.write("  [✓] evidence record includes postCommentScreenshotRef\n");
    } else {
      process.stdout.write("  [⚠] postCommentScreenshotRef not in evidence record payload\n");
    }
  }

  // 5. ability_result records include reason and gridCell
  const abilityResults = appendedRecords.filter(r =>
    typeof r === "object" && r !== null &&
    "recordType" in r && (r as Record<string, unknown>)["recordType"] === "ability_result"
  );
  if (abilityResults.length === 0) {
    passed = false;
    failures.push("No ability_result records found in forensics");
  } else {
    process.stdout.write(`  [✓] ${abilityResults.length} ability_result record(s) in forensics\n`);
    const clickResult = abilityResults.find(r => {
      const payload = (r as Record<string, unknown>)["recordPayload"] as Record<string, unknown> | undefined;
      return payload?.["actionCode"] === "LEFT_CLICK_GRID_CELL_ONCE";
    });
    if (clickResult) {
      const payload = (clickResult as Record<string, unknown>)["recordPayload"] as Record<string, unknown>;
      if (payload["gridCell"] === "C4") {
        process.stdout.write("  [✓] ability_result for click includes gridCell=C4\n");
      } else {
        passed = false;
        failures.push(`ability_result gridCell expected 'C4', got '${payload["gridCell"]}'`);
      }
      if (payload["reason"]) {
        process.stdout.write(`  [✓] ability_result for click includes reason: '${payload["reason"]}'\n`);
      } else {
        passed = false;
        failures.push("ability_result for click missing reason field");
      }
    }
  }

  if (passed) {
    process.stdout.write("\n[facebook-product-video-flow-smoke] PASS — product_yes flow wired correctly\n\n");
    process.exit(0);
  } else {
    process.stdout.write("\n[facebook-product-video-flow-smoke] FAIL\n");
    for (const f of failures) {
      process.stdout.write(`  ✗ ${f}\n`);
    }
    process.stdout.write("\n");
    process.exit(1);
  }
}

await main();
