export {
  createScreenshotAbilityGroup,
} from "./ability-group.js";
export {
  createFilesystemScreenshotArtifactPort,
} from "./adapters/filesystem-screenshot-artifact-port.js";
export {
  createSharpScreenshotImageProcessingPort,
} from "./adapters/sharp-screenshot-image-processing-port.js";
export {
  createSystemScreenshotClockPort,
} from "./runtime/system-screenshot-clock-port.js";
export {
  decodeGridCell,
} from "./shared/visual-mission-grid.js";

import { createScreenshotAbilityGroup } from "./ability-group.js";
import { createFilesystemScreenshotArtifactPort } from "./adapters/filesystem-screenshot-artifact-port.js";
import type { ScreenshotArtifactRef } from "./contract.js";

function createUnsupportedCapturePort() {
  return {
    portKind: "browser-controller-screenshot-capture-port" as const,
    async getBrowserSessionSnapshot() {
      throw new Error("visual mission smoke does not use browser session capture");
    },
    async captureBrowserViewport() {
      throw new Error("visual mission smoke does not use browser viewport capture");
    },
    async captureDesktopScreen() {
      throw new Error("visual mission smoke does not use desktop capture");
    },
  };
}

export function createAcceptanceScreenshotAbilityGroup(input: {
  artifactRoot: string;
  imageProcessingPort: ReturnType<typeof createSharpScreenshotImageProcessingPort>;
  clockPort: ReturnType<typeof createSystemScreenshotClockPort>;
}) {
  return createScreenshotAbilityGroup({
    capturePort: createUnsupportedCapturePort(),
    artifactPort: createFilesystemScreenshotArtifactPort(input.artifactRoot),
    imageProcessingPort: input.imageProcessingPort,
    clockPort: input.clockPort,
  });
}

function buildVisualMissionSmokeSourceProof(input: {
  fixturePath: string;
  sessionId: string;
  stepId: string;
  capabilityCallId: string;
  sourceEvidenceId: string;
  sourceArtifactRef: ScreenshotArtifactRef;
  sourceHash: string;
  sourceMetadata: { width: number; height: number };
}) {
  return {
    proofRef: "proof:visual-mission-smoke-source",
    sourceKind: "stored_image" as const,
    sourceStorageRef: input.fixturePath,
    sourceArtifactRef: input.sourceArtifactRef,
    inheritedScaleMapping: null,
    sourceScreenshotEvidenceId: input.sourceEvidenceId,
    sourceHash: input.sourceHash,
    coordinateSpace: "browser_viewport_pixels" as const,
    sourceWidth: input.sourceMetadata.width,
    sourceHeight: input.sourceMetadata.height,
    sessionId: input.sessionId,
    roundId: null,
    videoVisitId: null,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    pageStateProofRef: null,
    browserSessionRef: null,
  };
}

function buildVisualMissionSmokeSource(input: Parameters<typeof buildVisualMissionSmokeSourceProof>[0]) {
  return {
    kind: "stored_image" as const,
    sourceStorageRef: input.fixturePath,
    sourceArtifactRef: input.sourceArtifactRef,
    sourceProof: buildVisualMissionSmokeSourceProof(input),
    coordinateSpace: "browser_viewport_pixels" as const,
  };
}

export function buildVisualMissionSmokeRequest(input: {
  fixturePath: string;
  sessionId: string;
  stepId: string;
  capabilityCallId: string;
  sourceEvidenceId: string;
  sourceArtifactRef: ScreenshotArtifactRef;
  sourceHash: string;
  sourceMetadata: { width: number; height: number };
}) {
  return {
    abilityGroupId: "screenshot" as const,
    childCapabilityId: "prepare-visual-mission-input" as const,
    missionId: "mission-visual-mission-smoke",
    runId: "run-visual-mission-smoke",
    sessionId: input.sessionId,
    roundId: null,
    videoVisitId: null,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: "envelope:visual-mission-smoke",
    inputRef: "input:visual-mission-smoke",
    idempotencyKey: "idempotency:visual-mission-smoke",
    timeoutMs: 60_000,
    requestedBy: "acceptance",
    purpose: "visual mission smoke",
    sourceAbilityGroupId: "acceptance",
    sourceChildCapabilityId: null,
    maxAiWidth: null,
    preservePixels: true,
    evidencePolicy: "evidence_original" as const,
    contentLines: [],
    region: null,
    source: buildVisualMissionSmokeSource(input),
  };
}