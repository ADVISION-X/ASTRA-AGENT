import path from "node:path";

import { createCaptureRegionCapability } from "./implementation.js";
import { assertCapabilityCheck, createCapabilityCheckDir, createFakeBrowserController, createSampleImage } from "../../shared/capability-check-support.js";

export async function verifyCaptureRegionCapability(): Promise<void> {
  const outputRootDir = await createCapabilityCheckDir("screenshot-capture-region");
  const sourceFilePath = path.join(outputRootDir, "source.png");
  await createSampleImage(sourceFilePath, 100, 60);

  const capability = createCaptureRegionCapability();
  const result = await capability.execute({
    childCapabilityId: "capture-region",
    sessionId: "capability-check",
    roundId: null,
    videoVisitId: null,
    source: {
      kind: "stored_image",
      storageRef: sourceFilePath,
      sourceScreenshotEvidenceId: "source_evidence",
      coordinateSpace: "source_image_pixels",
    },
    region: {
      x: 10,
      y: 8,
      width: 40,
      height: 20,
      sourceScreenshotEvidenceId: "source_evidence",
      sourceStorageRef: sourceFilePath,
      coordinateSpace: "source_image_pixels",
    },
    requestedBy: "capability-check",
    purpose: "crop region proof",
    maxAiWidth: null,
    preservePixels: true,
    evidencePolicy: "evidence_original",
    contentLines: [],
  }, {
    browserController: createFakeBrowserController(),
    outputRootDir,
    defaultAiMaxWidth: 768,
  });

  assertCapabilityCheck(result.status === "success", "capture-region should succeed with a valid bbox and stored image");
  assertCapabilityCheck(result.width === 40 && result.height === 20, "capture-region should preserve the requested region dimensions");
}