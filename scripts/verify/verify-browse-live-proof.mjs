import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "dist", "node_modules", ".grasseye-data"]);

function requireRealPlatformTarget() {
  const platformTarget = process.env.GRASSEYE_PLATFORM_TARGET?.trim() || "tiktok-web";
  if (platformTarget !== "tiktok-web") {
    throw new Error("verify-browse-live-proof requires GRASSEYE_PLATFORM_TARGET=tiktok-web.");
  }

  return platformTarget;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }

      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.name === "tests" || entry.name === "__tests__") {
        violations.push(relativePath);
        continue;
      }

      violations.push(...await scanForForbiddenTestFiles(rootDir, relativePath));
      continue;
    }

    if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entry.name)) {
      violations.push(path.posix.join(relativeDir, entry.name));
    }
  }

  return violations;
}

async function waitForCompletion(workbench, maxAttempts = 240, intervalMs = 250) {
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

async function main() {
  const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
  assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);
  const platformTarget = requireRealPlatformTarget();
  assert(process.env.GRASSEYE_BROWSER_HEADLESS !== "true", "verify-browse-live-proof forbids GRASSEYE_BROWSER_HEADLESS=true in real-platform mode");

  const tempDataDir = await mkdtemp(path.join(tmpdir(), "grasseye-browse-proof-"));
  try {
    const { GrassEyeWorkbench } = await import("../../dist/src/lib/local-runtime/workbench.js");
    const workbench = new GrassEyeWorkbench({
      baseUrl: "http://127.0.0.1:4173",
      dataDir: tempDataDir,
      platformTarget,
      browserHeadless: false,
      browserProfileRef: "tiktok-web:verify-browse-live-proof-profile",
      browserUserDataDir: path.join(tempDataDir, "browser-profile"),
      ...(process.env.GRASSEYE_REAL_PLATFORM_URL ? { realPlatformUrl: process.env.GRASSEYE_REAL_PLATFORM_URL } : {}),
    });

    await workbench.init();
    await workbench.startTask();
    await waitForCompletion(workbench);

    const snapshot = await workbench.getOperatorSnapshot();
    const browseRuntimeSnapshot = snapshot.browseRuntimeSnapshot;
    const browserSession = snapshot.browserSession;
    const structuredActionLogs = snapshot.state.structuredActionLogs;
    const roundStructuralLogs = snapshot.state.roundStructuralLogs;

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

    const openTargetPageLog = structuredActionLogs.find((entry) => entry.step === "open_target_page") ?? null;
    const profileLockedFailure = browserSession.profileStatus === "profile_locked";
    if (profileLockedFailure) {
      assert(browserSession.browserMode === "real_chrome_persistent", "profile-locked path must stay on real_chrome_persistent mode");
      assert(browserSession.loginState === "review_required", "profile-locked path must escalate to review_required login state");
      assert(Boolean(browserSession.reviewRequiredReason), "profile-locked path must expose a reviewRequiredReason");
      assert(structuredActionLogs.some((entry) => entry.step === "task_start" && entry.result === "success"), "profile-locked path must still record task_start success");
      assert(openTargetPageLog?.result === "failed", "profile-locked path must record open_target_page as failed");
      assert(
        (openTargetPageLog?.failureReason ?? browserSession.reviewRequiredReason ?? "").includes("ProcessSingleton"),
        "profile-locked path must preserve the ProcessSingleton failure reason",
      );
      assert(!JSON.stringify(snapshot).includes("fake PASS"), "snapshot proof must not contain fake PASS");
      process.stdout.write("verify-browse-live-proof: PASS\n");
      return;
    }

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
      "scroll_next_video",
    ]) {
      assert(structuredActionLogs.some((entry) => entry.step === step), `structured proof log must include ${step}`);
    }

    assert(
      structuredActionLogs.some((entry) => ["finalize_browse_ledger", "finalize_evidence_packet", "finalize_failed_or_review_record"].includes(entry.step)),
      "structured proof log must include a finalize step",
    );

    const scrollIndexes = structuredActionLogs
      .map((entry, index) => (entry.step === "scroll_next_video" ? index : -1))
      .filter((index) => index >= 0);
    assert(scrollIndexes.length > 0, "structured proof log must include scroll_next_video");
    const hasScrollThenNextWait = scrollIndexes.some((scrollIndex) =>
      structuredActionLogs.some((entry, index) => index > scrollIndex && entry.step === "wait_video_stable"),
    );
    assert(hasScrollThenNextWait, "structured proof log must reach next wait_video_stable after scroll_next_video");

    assert(roundStructuralLogs.length > 0, "browse live proof must record at least one round structural log");

    const productNoRounds = roundStructuralLogs.filter((entry) => entry.productPresenceDecision === "product_no_high_confidence");
    const productYesRounds = roundStructuralLogs.filter((entry) => entry.productPresenceDecision === "product_yes_high_confidence");

    assert(
      productNoRounds.every((entry) => entry.finalArtifactKind === "browse_ledger"),
      "product_no path must finalize into browse ledger by default",
    );
    assert(
      productYesRounds.every((entry) => entry.finalArtifactKind === "evidence_packet"),
      "product_yes path must finalize into evidence packet by default when product_yes occurs",
    );
    assert(!JSON.stringify(snapshot).includes("fake PASS"), "snapshot proof must not contain fake PASS");

    process.stdout.write("verify-browse-live-proof: PASS\n");
  } finally {
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

await main();
