import path from "node:path";

import { createGeometryGuardAbilityGroup } from "../../dist/src/capabilities/geometry-guard/index.js";
import { createScreenshotAbilityGroup } from "../../dist/src/capabilities/screenshot/ability-group.js";
import { createFilesystemScreenshotArtifactPort } from "../../dist/src/capabilities/screenshot/ports/screenshot-artifact-port.js";
import { createBrowserControllerScreenshotCapturePort } from "../../dist/src/capabilities/screenshot/ports/screenshot-capture-port.js";
import { createSystemScreenshotClockPort } from "../../dist/src/capabilities/screenshot/ports/screenshot-clock-port.js";
import { createSharpScreenshotImageProcessingPort } from "../../dist/src/capabilities/screenshot/ports/screenshot-image-processing-port.js";
import { CurrentChromeBrowserController } from "../../dist/src/lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../dist/src/lib/browser/local-browser-session.js";
import { EvidenceStoreService } from "../../dist/src/lib/storage/evidence-store/evidence-store-service.js";

import { assert } from "./delivery-smoke-support.mjs";

const createBrowserController = (tempDataDir, folderName) =>
  new CurrentChromeBrowserController({
    sessionConfig: createLocalBrowserSessionConfig({ platform: "tiktok-web" }),
    screenshotDir: path.join(tempDataDir, folderName),
    headlessRequested: false,
  });

const createGeometryGuardRequest = (geometry) => ({
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
  bbox: { x: 0, y: 0, width: geometry.viewportWidth, height: geometry.viewportHeight },
  clickPoint: { x: Math.round(geometry.viewportWidth * 0.5), y: Math.round(geometry.viewportHeight * 0.5) },
  imageSize: { width: geometry.screenshotWidth, height: geometry.screenshotHeight },
  viewportSize: { width: geometry.viewportWidth, height: geometry.viewportHeight },
  screenSize: null,
  deviceScaleFactor: geometry.scaleFactor,
  scaleMapping: null,
  safetyPolicy: { allowReviewRequired: false, minimumConfidence: null, coordinateConfidence: null, requireSourceRef: false },
  dataQualityFlags: [],
});

const createScreenshotSupport = (tempDataDir, browserController) => ({
  screenshotAbilityGroup: createScreenshotAbilityGroup({
    capturePort: createBrowserControllerScreenshotCapturePort(browserController),
    artifactPort: createFilesystemScreenshotArtifactPort(path.join(tempDataDir, "screenshot-smoke")),
    imageProcessingPort: createSharpScreenshotImageProcessingPort(),
    clockPort: createSystemScreenshotClockPort(),
  }),
  evidenceStore: new EvidenceStoreService(path.join(tempDataDir, "evidence-smoke")),
});

const assertGeometrySnapshot = (geometry, guardResult) => {
  assert(guardResult.status === "success" && guardResult.guardDecision === "allow", `geometry guard smoke check failed: ${guardResult.statusMessage}`);
  assert(geometry.currentUrl.length > 0 && geometry.currentUrl !== "about:blank", "geometry snapshot must include the current URL");
  assert(geometry.pageTitle.length > 0, "geometry snapshot must include the page title");
  assert(geometry.screenshotWidth > 0 && geometry.screenshotHeight > 0, "geometry snapshot must include screenshot dimensions");
  assert(geometry.visibleContentBounds.width > 0 && geometry.visibleContentBounds.height > 0, "geometry snapshot must include visible content bounds");
};

const persistCaptureEvidence = async (capture, evidenceStore, realPlatformUrl, readFile) => {
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
};

export async function verifyEvidenceAndGeometry(tempDataDir, realPlatformUrl, readFile) {
  const browserController = createBrowserController(tempDataDir, "current-chrome-captures");
  const { screenshotAbilityGroup, evidenceStore } = createScreenshotSupport(tempDataDir, browserController);

  await evidenceStore.init();
  try {
    await browserController.open({ url: realPlatformUrl, title: "Delivery Verify Real Platform" });

    const geometry = await browserController.getGeometrySnapshot();
    const geometryGuard = createGeometryGuardAbilityGroup();
    const guardResult = await geometryGuard.execute(createGeometryGuardRequest(geometry));
    assertGeometrySnapshot(geometry, guardResult);

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
    await persistCaptureEvidence(captureResult.output, evidenceStore, realPlatformUrl, readFile);
  } finally {
    await browserController.close();
  }
}

export async function verifyRealCoordinateClick(realPlatformUrl, tempDataDir) {
  const browserController = createBrowserController(tempDataDir, "current-chrome-coordinate-captures");

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