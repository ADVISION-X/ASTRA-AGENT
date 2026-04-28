import { rm } from "node:fs/promises";

import { createCaptureDesktopScreenCapability } from "./implementation.js";
import { assertCapabilityCheck, createCapabilityCheckDir, createFakeBrowserController } from "../../shared/capability-check-support.js";

export async function verifyCaptureDesktopScreenCapability(): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }

  const outputRootDir = await createCapabilityCheckDir("screenshot-desktop-screen");
  try {
    const capability = createCaptureDesktopScreenCapability();
    const result = await capability.execute({
      childCapabilityId: "capture-desktop-screen",
      sessionId: "capability-check",
      roundId: null,
      videoVisitId: null,
      source: { kind: "desktop_screen", screenId: "primary" },
      region: null,
      requestedBy: "capability-check",
      purpose: "desktop screen proof",
      maxAiWidth: null,
      preservePixels: true,
      evidencePolicy: "evidence_original",
      contentLines: [],
    }, {
      browserController: createFakeBrowserController(),
      outputRootDir,
      defaultAiMaxWidth: 768,
    });
    assertCapabilityCheck(result.status === "success", "capture-desktop-screen should succeed on macOS");
    assertCapabilityCheck(result.coordinateSpace === "desktop_screen_pixels", "capture-desktop-screen should expose desktop coordinate space");
  } finally {
    await rm(outputRootDir, { recursive: true, force: true });
  }
}