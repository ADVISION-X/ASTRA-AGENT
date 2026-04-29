// This is runtime live proof, not law enforcement.
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { waitForHealth } from "../startup/lib/health-check.mjs";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "dist", "node_modules", ".grasseye-data"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireRealPlatformTarget() {
  if (process.env.GRASSEYE_PLATFORM_TARGET !== "tiktok-web") {
    throw new Error("acceptance:delivery-smoke requires GRASSEYE_PLATFORM_TARGET=tiktok-web.");
  }

  return process.env.GRASSEYE_PLATFORM_TARGET;
}

function getRealPlatformUrl() {
  return process.env.GRASSEYE_REAL_PLATFORM_URL ?? "https://www.tiktok.com/foryou";
}

async function importDist(relativePath) {
  const absolutePath = path.join(repoRoot, "dist", relativePath);
  return import(pathToFileURL(absolutePath).href);
}

async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name) || entry.name === "tests" || entry.name === "__tests__") {
        if (entry.name === "tests" || entry.name === "__tests__") {
          violations.push(path.posix.join(relativeDir, entry.name));
        }
        continue;
      }

      violations.push(...await scanForForbiddenTestFiles(rootDir, path.posix.join(relativeDir, entry.name)));
      continue;
    }

    const relativePath = path.posix.join(relativeDir, entry.name);
    if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entry.name)) {
      violations.push(relativePath);
    }
  }

  return violations;
}

async function verifyLocalAiHealth() {
  const { LocalAiGateway } = await importDist("src/lib/local-ai/local-ai-gateway.js");
  const localAi = new LocalAiGateway();
  const health = await localAi.getHealth();
  assert(health.ok, `local AI config must be readable: ${health.detail}`);
}

async function verifyEvidenceAndGeometry(tempDataDir, realPlatformUrl) {
  const [{ CurrentChromeBrowserController }, { createLocalBrowserSessionConfig }, { createScreenshotAbilityGroup }, { createFilesystemScreenshotArtifactPort }, { createBrowserControllerScreenshotCapturePort }, { createSharpScreenshotImageProcessingPort }, { createSystemScreenshotClockPort }, { EvidenceStoreService }, { createGeometryGuardAbilityGroup }] = await Promise.all([
    importDist("src/lib/browser/current-chrome-browser-controller.js"),
    importDist("src/lib/browser/local-browser-session.js"),
    importDist("src/capabilities/screenshot/ability-group.js"),
    importDist("src/capabilities/screenshot/ports/screenshot-artifact-port.js"),
    importDist("src/capabilities/screenshot/ports/screenshot-capture-port.js"),
    importDist("src/capabilities/screenshot/ports/screenshot-image-processing-port.js"),
    importDist("src/capabilities/screenshot/ports/screenshot-clock-port.js"),
    importDist("src/lib/storage/evidence-store/evidence-store-service.js"),
    importDist("src/capabilities/geometry-guard/index.js"),
  ]);

  const sessionConfig = createLocalBrowserSessionConfig({
    platform: "tiktok-web",
  });
  const browserController = new CurrentChromeBrowserController({
    sessionConfig,
    screenshotDir: path.join(tempDataDir, "current-chrome-captures"),
    headlessRequested: false,
  });
  const screenshotAbilityGroup = createScreenshotAbilityGroup({
    capturePort: createBrowserControllerScreenshotCapturePort(browserController),
    artifactPort: createFilesystemScreenshotArtifactPort(path.join(tempDataDir, "screenshot-smoke")),
    imageProcessingPort: createSharpScreenshotImageProcessingPort(),
    clockPort: createSystemScreenshotClockPort(),
  });
  const evidenceStore = new EvidenceStoreService(path.join(tempDataDir, "evidence-smoke"));

  await evidenceStore.init();
  try {
    await browserController.open({ url: realPlatformUrl, title: "Delivery Verify Real Platform" });

    const geometry = await browserController.getGeometrySnapshot();
    const geometryGuard = createGeometryGuardAbilityGroup();
    const guardResult = await geometryGuard.execute({
      abilityGroupId: "geometry-guard",
      childCapabilityId: "validate-browser-viewport-bounds",
      sessionId: "delivery-smoke",
      roundId: null,
      videoVisitId: null,
      requestedBy: "acceptance",
      purpose: "delivery smoke geometry validation",
      sourceScreenshotEvidenceRef: null,
      sourceTargetRef: null,
      sourceAiResultRef: null,
      sourceCoordinateSpace: "browserViewport",
      requestedExecutionSpace: "browserViewport",
      bbox: {
        x: 0,
        y: 0,
        width: geometry.viewportWidth,
        height: geometry.viewportHeight,
      },
      clickPoint: {
        x: Math.round(geometry.viewportWidth * 0.5),
        y: Math.round(geometry.viewportHeight * 0.5),
      },
      imageSize: {
        width: geometry.screenshotWidth,
        height: geometry.screenshotHeight,
      },
      viewportSize: {
        width: geometry.viewportWidth,
        height: geometry.viewportHeight,
      },
      screenSize: null,
      deviceScaleFactor: geometry.scaleFactor,
      scaleMapping: null,
      safetyPolicy: {
        allowReviewRequired: false,
        minimumConfidence: null,
        coordinateConfidence: null,
        requireSourceRef: false,
      },
      dataQualityFlags: [],
    });

    assert(guardResult.status === "success" && guardResult.guardDecision === "allow", `geometry guard smoke check failed: ${guardResult.statusMessage}`);
    assert(geometry.currentUrl.length > 0 && geometry.currentUrl !== "about:blank", "geometry snapshot must include the current URL");
    assert(geometry.pageTitle.length > 0, "geometry snapshot must include the page title");
    assert(geometry.screenshotWidth > 0 && geometry.screenshotHeight > 0, "geometry snapshot must include screenshot dimensions");
    assert(geometry.visibleContentBounds.width > 0 && geometry.visibleContentBounds.height > 0, "geometry snapshot must include visible content bounds");

    const captureResult = await screenshotAbilityGroup.captureBrowserViewport({
      sessionId: "delivery-smoke",
      roundId: null,
      videoVisitId: null,
      requestedBy: "acceptance",
      purpose: "delivery-verify-region",
      maxAiWidth: null,
      preservePixels: true,
      evidencePolicy: "evidence_original",
      region: null,
      contentLines: ["delivery verification artifact"],
    });
    assert(captureResult.status === "success" && captureResult.output, `screenshot ability group smoke check failed: ${captureResult.failureReason?.message ?? "unknown failure"}`);
    const capture = captureResult.output;

    const evidence = await evidenceStore.saveImageEvidence({
      kind: "video-screenshot",
      taskRunId: "task_verify_delivery",
      roundId: "round_verify_delivery",
      platformId: "tiktok-web",
      sourceId: "verify-delivery-source",
      sourceUrl: capture.pageUrl ?? realPlatformUrl,
      regionLabel: capture.regionLabel,
      regionType: capture.regionType,
      summary: "delivery verification artifact",
      width: capture.width,
      height: capture.height,
      contentLines: capture.contentLines,
      sourceFilePath: capture.artifactRef.storageRef,
    });
    const state = await evidenceStore.listState();
    const artifactText = await readFile(evidence.filePath, "utf8");

    assert(state.videoEvidence.some((item) => item.id === evidence.id), "saved screenshot evidence must be persisted in state.json");
    assert(artifactText.includes("delivery verification artifact"), "saved screenshot artifact must be readable from disk");
  } finally {
    await browserController.close();
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
}

async function waitForTaskToSettle(snapshotUrl, maxAttempts = 240) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await fetchJson(snapshotUrl);
    const status = snapshot.agent?.currentTask?.status;
    if (status && ["completed", "paused", "stopped", "review_required", "failed"].includes(status)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("acceptance:delivery-smoke task did not settle in time");
}

async function verifyRealCoordinateClick(realPlatformUrl, tempDataDir) {
  const [{ CurrentChromeBrowserController }, { createLocalBrowserSessionConfig }] = await Promise.all([
    importDist("src/lib/browser/current-chrome-browser-controller.js"),
    importDist("src/lib/browser/local-browser-session.js"),
  ]);
  const sessionConfig = createLocalBrowserSessionConfig({
    platform: "tiktok-web",
  });
  const browserController = new CurrentChromeBrowserController({
    sessionConfig,
    screenshotDir: path.join(tempDataDir, "current-chrome-coordinate-captures"),
    headlessRequested: false,
  });

  try {
    await browserController.open({
      url: realPlatformUrl,
      title: "Delivery Verify Coordinate Click",
    });
    const geometry = await browserController.getGeometrySnapshot();
    const clickResult = await browserController.click({
      targetLabel: "real platform coordinate smoke",
      point: {
        x: Math.round(geometry.viewportWidth * 0.5),
        y: Math.round(geometry.viewportHeight * 0.5),
      },
    });

    assert(clickResult.ok, `real coordinate click must succeed: ${clickResult.message}`);
    assert(clickResult.message.includes("clicked"), "real coordinate click must report a clicked action");
  } finally {
    await browserController.close();
  }
}

async function verifyRuntimeEndpoints(tempDataDir, platformTarget, realPlatformUrl) {
  const port = 4187;
  const serverProcess = spawn(process.execPath, ["dist/src/app/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GRASSEYE_HOST: "127.0.0.1",
      GRASSEYE_PORT: String(port),
      GRASSEYE_DATA_DIR: path.join(tempDataDir, "runtime-smoke"),
      GRASSEYE_PLATFORM_TARGET: platformTarget,
      GRASSEYE_BROWSER_HEADLESS: "false",
      GRASSEYE_REAL_PLATFORM_URL: realPlatformUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const healthUrl = `http://127.0.0.1:${port}/api/runtime/health`;
    const snapshotUrl = `http://127.0.0.1:${port}/api/runtime/snapshot`;
    const startUrl = `http://127.0.0.1:${port}/api/tasks/start`;

    const health = await waitForHealth({ url: healthUrl, timeoutMs: 30000, intervalMs: 250, serviceProcess: serverProcess });
    assert(Array.isArray(health.components) && health.components.length >= 5, "health endpoint must report the core runtime components");
    await verifyRealCoordinateClick(realPlatformUrl, tempDataDir);

    await fetchJson(startUrl, { method: "POST" });
    const runtimeSnapshot = await waitForTaskToSettle(snapshotUrl);
    const delivery = runtimeSnapshot.delivery;

    for (const key of [
      "currentRoundStep",
      "currentUrl",
      "targetUrl",
      "pageReadyStatus",
      "geometryGuardStatus",
      "viewport",
      "calibration",
      "latestScreenshotEvidenceId",
      "latestAiResultId",
      "latestActionLogId",
      "latestRoundTraceStep",
      "latestRoundTraceStatus",
      "latestRoundTraceDetail",
      "noCandidateReason",
      "evidencePacketCount",
      "browseLedgerCount",
      "roundLifecycleEventCount",
      "roundStructuralLogCount",
      "advancedAiExportCount",
      "latestBrowseSummary",
    ]) {
      assert(Object.hasOwn(delivery, key), `runtime snapshot delivery is missing ${key}`);
    }

    assert(runtimeSnapshot.mode.dataMode === "Real Platform", "runtime snapshot must stay in real-platform mode");
    assert(runtimeSnapshot.mode.platformId === "tiktok-web", "runtime snapshot must report the real platform id");
    assert(runtimeSnapshot.agent.currentTask, "runtime snapshot must expose an active or settled task");
    assert(runtimeSnapshot.agent.currentTask.status !== "failed", `real-platform delivery smoke failed: ${runtimeSnapshot.agent.currentTask.note ?? "unknown reason"}`);
    assert(delivery.pageReadyStatus !== "idle", "delivery snapshot must advance beyond idle after starting the task");
    assert(delivery.actionLogCount > 0 || Boolean(delivery.latestActionLogId), "delivery snapshot must expose runtime action proof");
  } finally {
    serverProcess.kill("SIGINT");
    await new Promise((resolve) => {
      serverProcess.once("exit", resolve);
      setTimeout(resolve, 5000);
    });

    assert(serverProcess.exitCode === 0 || serverProcess.exitCode === null, `delivery smoke server exited abnormally: ${stderr.trim() || "unknown error"}`);
  }
}

async function main() {
  const platformTarget = requireRealPlatformTarget();
  const realPlatformUrl = getRealPlatformUrl();
  const distServerPath = path.join(repoRoot, "dist", "src", "app", "server.js");
  await readFile(distServerPath, "utf8");

  const tempDataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-verify-delivery-"));

  try {
    const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
    assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);

    await verifyLocalAiHealth();
    await verifyEvidenceAndGeometry(tempDataDir, realPlatformUrl);
    await verifyRuntimeEndpoints(tempDataDir, platformTarget, realPlatformUrl);

    process.stdout.write("acceptance:delivery-smoke: PASS\n");
  } finally {
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

await main();
