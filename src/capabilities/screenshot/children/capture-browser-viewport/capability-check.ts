import path from "node:path";

import { createCaptureBrowserViewportCapability } from "./implementation.js";
import { assertCapabilityCheck, createCapabilityCheckDir, createFakeBrowserController, createSampleImage } from "../../shared/capability-check-support.js";

export async function verifyCaptureBrowserViewportCapability(): Promise<void> {
  const outputRootDir = await createCapabilityCheckDir("screenshot-browser-viewport");
  const screenshotPath = path.join(outputRootDir, "viewport.png");
  await createSampleImage(screenshotPath, 1280, 720);

  const capability = createCaptureBrowserViewportCapability();
  const result = await capability.execute({
    childCapabilityId: "capture-browser-viewport",
    sessionId: "capability-check",
    roundId: null,
    videoVisitId: null,
    source: { kind: "browser_viewport" },
    region: null,
    requestedBy: "capability-check",
    purpose: "browser viewport proof",
    maxAiWidth: null,
    preservePixels: true,
    evidencePolicy: "evidence_original",
    contentLines: ["capability-check"],
  }, {
    browserController: createFakeBrowserController({ screenshotPath }),
    outputRootDir,
    defaultAiMaxWidth: 768,
  });

  assertCapabilityCheck(result.status === "success", "capture-browser-viewport should succeed with a governed screenshot source file");
  assertCapabilityCheck(result.coordinateSpace === "browser_viewport_pixels", "capture-browser-viewport should expose browser viewport coordinate space");
}