import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotFailure, ScreenshotRuntimeProof, ScreenshotSourceProof } from "../contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotChildRegistryEntry, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import { executeScreenshotArtifactStoragePhase } from "./screenshot-execution-artifact-phase.js";
import { executeScreenshotCaptureAndImagePhase } from "./screenshot-execution-capture-image-phase.js";
import { screenshotExecutionRuntimeSupport } from "./screenshot-execution-runtime-support.js";
import { screenshotExecutionPhaseSupport } from "./screenshot-execution-phase-support.js";

type ScreenshotDecision = ScreenshotRuntimeProof["privacyDecision"];

export type ScreenshotExecutionGateState = {
  failure: ScreenshotFailure | null;
  decision: ScreenshotDecision;
};

export type ScreenshotExecutionSourceGateState = ScreenshotExecutionGateState & {
  sourceProof: ScreenshotSourceProof | null;
};

export type ScreenshotExecutionBrowserSessionGateState = ScreenshotExecutionGateState & {
  browserSessionRef: string | null;
};

export type ScreenshotExecutionPageStateGateState = ScreenshotExecutionGateState & {
  pageStateProofRef: string | null;
};

export type ScreenshotExecutionGates = {
  sourceGate: ScreenshotExecutionSourceGateState;
  browserSessionGate: ScreenshotExecutionBrowserSessionGateState;
  pageStateGate: ScreenshotExecutionPageStateGateState;
  privacyGate: ScreenshotExecutionGateState;
};

async function executeScreenshotRegionGatePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
}): Promise<{ regionGate: { failure: ScreenshotFailure | null; decision: ScreenshotDecision } } | ScreenshotAbilityResult> {
  const regionGate = screenshotExecutionRuntimeSupport.runRegionProofGate({
    sourceProof: input.gates.sourceGate.sourceProof,
    region: input.plan.kind === "image-processing" && "region" in input.plan ? input.plan.region : null,
  });
  if (regionGate.failure || regionGate.decision.status === "failed") {
    return await screenshotExecutionPhaseSupport.buildScreenshotRegionValidationFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      sourceGate: input.gates.sourceGate,
      browserSessionGate: input.gates.browserSessionGate,
      pageStateGate: input.gates.pageStateGate,
      privacyGate: input.gates.privacyGate,
      regionGate,
    });
  }
  return { regionGate };
}


function validateAndExtractScreenshotMetadata(input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runImageProcessingRunner>> | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotAbilityResult | { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string }> {
  return screenshotExecutionPhaseSupport.resolveScreenshotOutputMetadata({
    plan: input.plan,
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    gates: input.gates,
  }).then((metadataResolution) => (metadataResolution.ok ? metadataResolution.metadata : metadataResolution.failure));
}


export async function executeScreenshotExecutionPhases(input: {
  plan: ScreenshotExecutionPlan;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotAbilityResult> {
  const regionPhase = await executeScreenshotRegionGatePhase(input);
  if ("status" in regionPhase) {
    return regionPhase;
  }
  const capturePhase = await executeScreenshotCaptureAndImagePhase(input);
  if ("status" in capturePhase) {
    return capturePhase;
  }
  const metadataPhase = await validateAndExtractScreenshotMetadata({
    ...input,
    captureRun: capturePhase.captureRun,
    imageRun: capturePhase.imageRun,
  });
  if ("status" in metadataPhase) {
    return metadataPhase;
  }
  return executeScreenshotArtifactStoragePhase({
    ...input,
    captureRun: capturePhase.captureRun,
    imageRun: capturePhase.imageRun,
    phaseTimings: capturePhase.phaseTimings,
    metadata: metadataPhase,
  });
}
