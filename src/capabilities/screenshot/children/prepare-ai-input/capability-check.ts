import path from "node:path";

import { createPrepareAiInputCapability } from "./implementation.js";
import { assertCapabilityCheck, createCapabilityCheckDir, createFakeBrowserController, createSampleImage } from "../../shared/capability-check-support.js";

export async function verifyPrepareAiInputCapability(): Promise<void> {
  const outputRootDir = await createCapabilityCheckDir("screenshot-prepare-ai-input");
  const sourceFilePath = path.join(outputRootDir, "source.png");
  await createSampleImage(sourceFilePath, 2400, 1600);

  const capability = createPrepareAiInputCapability();
  const result = await capability.execute({
    childCapabilityId: "prepare-ai-input",
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
    purpose: "ai input preparation proof",
    maxAiWidth: 768,
    preservePixels: false,
    evidencePolicy: "ai_input",
    contentLines: [],
  }, {
    browserController: createFakeBrowserController(),
    outputRootDir,
    defaultAiMaxWidth: 768,
  });

  assertCapabilityCheck(result.status === "success", "prepare-ai-input should succeed with a stored image");
  assertCapabilityCheck(result.coordinateSpace === "ai_input_pixels", "prepare-ai-input should emit ai_input_pixels coordinate space");
  assertCapabilityCheck((result.width ?? 0) <= 768 && (result.height ?? 0) <= 768, "prepare-ai-input should bound the output dimensions");
}