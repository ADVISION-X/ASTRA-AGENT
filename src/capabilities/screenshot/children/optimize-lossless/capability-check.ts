import path from "node:path";

import { createOptimizeLosslessCapability } from "./implementation.js";
import { assertCapabilityCheck, createCapabilityCheckDir, createFakeBrowserController, createSampleImage } from "../../shared/capability-check-support.js";

export async function verifyOptimizeLosslessCapability(): Promise<void> {
  const outputRootDir = await createCapabilityCheckDir("screenshot-optimize-lossless");
  const sourceFilePath = path.join(outputRootDir, "source.png");
  await createSampleImage(sourceFilePath, 80, 60);

  const capability = createOptimizeLosslessCapability();
  const result = await capability.execute({
    childCapabilityId: "optimize-lossless",
    sessionId: "capability-check",
    roundId: null,
    videoVisitId: null,
    source: {
      kind: "stored_image",
      storageRef: sourceFilePath,
      sourceScreenshotEvidenceId: "source_evidence",
      coordinateSpace: "source_image_pixels",
    },
    region: null,
    requestedBy: "capability-check",
    purpose: "lossless optimization proof",
    maxAiWidth: null,
    preservePixels: true,
    evidencePolicy: "evidence_optimized",
    contentLines: [],
  }, {
    browserController: createFakeBrowserController(),
    outputRootDir,
    defaultAiMaxWidth: 768,
  });

  assertCapabilityCheck(result.status === "success", "optimize-lossless should succeed with a stored image");
  assertCapabilityCheck(result.imageKind === "evidence_optimized", "optimize-lossless should emit evidence_optimized output");
}