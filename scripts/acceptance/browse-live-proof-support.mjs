import { readdir } from "node:fs/promises";
import path from "node:path";

const ignoredDirs = new Set([".git", "dist", "node_modules", ".grasseye-data"]);

export function requireRealPlatformTarget() {
  const platformTarget = process.env.GRASSEYE_PLATFORM_TARGET?.trim() || "tiktok-web";
  if (platformTarget !== "tiktok-web") {
    throw new Error("acceptance:browse-live-proof requires GRASSEYE_PLATFORM_TARGET=tiktok-web.");
  }

  return platformTarget;
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const isForbiddenTestDirectory = (entryName) => entryName === "tests" || entryName === "__tests__";

const isForbiddenTestFile = (entryName) => /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entryName);

const collectEntryViolations = async (rootDir, relativeDir, entry) => {
  if (entry.isDirectory()) {
    if (ignoredDirs.has(entry.name)) {
      return [];
    }

    const relativePath = path.posix.join(relativeDir, entry.name);
    if (isForbiddenTestDirectory(entry.name)) {
      return [relativePath];
    }

    return scanForForbiddenTestFiles(rootDir, relativePath);
  }

  return isForbiddenTestFile(entry.name) ? [path.posix.join(relativeDir, entry.name)] : [];
};

export async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    violations.push(...await collectEntryViolations(rootDir, relativeDir, entry));
  }

  return violations;
}

export async function waitForCompletion(workbench, maxAttempts = 240, intervalMs = 250) {
  let lastStatus = "unknown";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await workbench.getOperatorSnapshot();
    const status = snapshot.agent.currentTask?.status;
    lastStatus = status ?? "idle";
    if (!status || ["completed", "paused", "stopped", "failed", "review_required"].includes(status)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`browse live proof task did not settle in time; lastStatus=${lastStatus}`);
}

const findFirstEventIndex = (events, predicate) => events.findIndex(predicate);

const hasLaterEvent = (events, startIndex, predicate) =>
  events.some((event, index) => index > startIndex && predicate(event));

const assertBrowseRuntimeSnapshotShape = (browseRuntimeSnapshot) => {
  for (const key of [
    "runtimeStatus",
    "currentStep",
    "currentUrl",
    "targetUrl",
    "pageSafetyState",
    "feedReadyStatus",
    "videoStableStatus",
    "currentVideoVisitId",
    "geometryStatus",
    "latestVideoEvidenceId",
    "latestAIResult",
    "latestProductPresenceDecision",
    "latestBrowseLedgerEntryId",
    "latestEvidencePacketId",
    "latestStructuredActionLogId",
    "latestActionLogId",
    "latestRoundOutcome",
    "reviewRequiredReason",
    "counters",
  ]) {
    assert(Object.hasOwn(browseRuntimeSnapshot, key), `browse runtime snapshot is missing ${key}`);
  }
};

const assertStructuredActionProof = (browserSession, structuredActionLogs) => {
  const openTargetPageLog = structuredActionLogs.find((entry) => entry.step === "open_target_page") ?? null;
  assert(browserSession.open === true, "browse live proof must operate on an open current Chrome session");
  assert(browserSession.currentUrl !== "about:blank", "browse live proof must leave about:blank and enter the real platform page");
  assert(browserSession.loginState !== "review_required", "browse live proof must not fall back to the removed review-required downgrade path");
  assert(openTargetPageLog, "browse live proof must include open_target_page structured action proof");

  for (const step of [
    "open_target_page",
    "detect_login_or_safety",
    "wait_feed_ready",
    "single_video_round_start",
    "wait_video_stable",
    "identify_current_video",
    "calibrate_geometry",
    "screenshot_video_area",
    "record_video_evidence",
    "ask_ai_product_presence",
    "validate_ai_output",
    "branch",
  ]) {
    assert(structuredActionLogs.some((entry) => entry.step === step), `structured proof log must include ${step}`);
  }
};

const assertScrollRuntimeProof = (structuredActionLogs, structuredRuntimeEvents) => {
  const hasFinalizeStep = structuredActionLogs.some((entry) => ["finalize_browse_ledger", "finalize_evidence_packet", "finalize_failed_or_review_record"].includes(entry.step));
  const scrollRuntimeEvents = structuredRuntimeEvents.filter((entry) => entry.step === "scroll_next_video");
  assert(scrollRuntimeEvents.length > 0, "structured runtime proof must include scroll_next_video runtime events");

  const successfulScrollEvents = scrollRuntimeEvents.filter((entry) => entry.status === "success" && entry.videoVisitId);
  if (successfulScrollEvents.length === 0) {
    const guardedScrollFailure = scrollRuntimeEvents.some((entry) => entry.status === "review_required" || entry.status === "failed" || entry.eventType === "step_timeout");
    assert(hasFinalizeStep || guardedScrollFailure, "browse live proof must either finalize the round or stop through a governed review_required/failed scroll runtime event");
    assert(guardedScrollFailure, "scroll_next_video must either succeed or terminate through a governed failed/review_required runtime event");
    return;
  }

  assert(hasFinalizeStep, "structured proof log must include a finalize step after a settled round");
  const scrollIndexes = structuredActionLogs.map((entry, index) => (entry.step === "scroll_next_video" ? index : -1)).filter((index) => index >= 0);
  assert(scrollIndexes.length > 0, "structured proof log must include scroll_next_video after a successful scroll");
  assert(
    scrollIndexes.some((scrollIndex) => structuredActionLogs.some((entry, index) => index > scrollIndex && entry.step === "wait_video_stable")),
    "structured proof log must reach next wait_video_stable after scroll_next_video succeeds",
  );
  assert(
    successfulScrollEvents.some((scrollEvent) => structuredRuntimeEvents.some((entry) => entry.createdAt > scrollEvent.createdAt && entry.step === "identify_current_video" && entry.status === "success" && entry.videoVisitId && entry.videoVisitId !== scrollEvent.videoVisitId)),
    "structured runtime proof must identify a different videoVisitId after scroll_next_video succeeds",
  );
};

const assertRoundOutcomes = (roundStructuralLogs) => {
  if (roundStructuralLogs.length === 0) {
    return;
  }

  const productNoRounds = roundStructuralLogs.filter((entry) => entry.productPresenceDecision === "product_no_high_confidence");
  const productYesRounds = roundStructuralLogs.filter((entry) => entry.productPresenceDecision === "product_yes_high_confidence");
  assert(productNoRounds.every((entry) => entry.finalArtifactKind === "browse_ledger"), "product_no path must finalize into browse ledger by default");
  assert(productYesRounds.every((entry) => entry.finalArtifactKind === "evidence_packet"), "product_yes path must finalize into evidence packet by default when product_yes occurs");
};

const assertLocalAiUnavailableChain = (structuredRuntimeEvents) => {
  const localAiUnavailableIndex = findFirstEventIndex(structuredRuntimeEvents, (entry) => entry.eventType === "local_ai_runtime_unavailable");
  if (localAiUnavailableIndex < 0) {
    return;
  }

  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "ask_ai_product_presence_failed"), "local_ai_runtime_unavailable must be followed by ask_ai_product_presence_failed");
  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "branch_decision_completed" && entry.decision === "local_ai_unavailable"), "local_ai_runtime_unavailable must be followed by branch_decision_completed with decision=local_ai_unavailable");
  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "finalize_failed_or_review_record_completed" && entry.roundOutcome === "local_ai_unavailable" && entry.finalizationType === "failed_record"), "local_ai_runtime_unavailable must be followed by finalize_failed_or_review_record_completed with failed_record finalization");
  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "review_required" && Boolean(entry.reviewRequiredReason)), "local_ai_runtime_unavailable must be followed by review_required with a governed reason");
  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "task_stopped" && entry.status === "review_required" && Boolean(entry.reviewRequiredReason)), "local_ai_runtime_unavailable must be followed by task_stopped with review_required status");
  assert(hasLaterEvent(structuredRuntimeEvents, localAiUnavailableIndex, (entry) => entry.eventType === "runtime_snapshot_summary" && entry.snapshotSummary?.runtimeStatus === "review_required" && Boolean(entry.snapshotSummary?.reviewRequiredReason)), "local_ai_runtime_unavailable must be followed by runtime_snapshot_summary with review_required reason");
};

const assertSingleFrameFallbackEvents = (structuredRuntimeEvents) => {
  const singleFrameFallbackEvents = structuredRuntimeEvents.filter((entry) => entry.samplingStrategy === "single_frame_fallback");
  if (singleFrameFallbackEvents.length === 0) {
    return;
  }

  assert(singleFrameFallbackEvents.some((entry) => entry.expectedFrameCount === 3 && entry.validFrameCount === 1), "single_frame_fallback runtime proof must include expectedFrameCount=3 and validFrameCount=1");
  assert(singleFrameFallbackEvents.some((entry) => Boolean(entry.fallbackReason)), "single_frame_fallback runtime proof must include fallbackReason");
  assert(singleFrameFallbackEvents.some((entry) => Array.isArray(entry.missingFrames) && entry.missingFrames.length > 0), "single_frame_fallback runtime proof must include missingFrames");
};

export function validateBrowseLiveProofSnapshot(snapshot) {
  assertBrowseRuntimeSnapshotShape(snapshot.browseRuntimeSnapshot);
  assertStructuredActionProof(snapshot.browserSession, snapshot.state.structuredActionLogs);
  assertScrollRuntimeProof(snapshot.state.structuredActionLogs, snapshot.state.structuredRuntimeEvents);
  assertRoundOutcomes(snapshot.state.roundStructuralLogs);
  assertLocalAiUnavailableChain(snapshot.state.structuredRuntimeEvents);
  assertSingleFrameFallbackEvents(snapshot.state.structuredRuntimeEvents);
  assert(!JSON.stringify(snapshot).includes("fake PASS"), "snapshot proof must not contain fake PASS");
}