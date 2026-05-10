import type {
  PrepareVisualMissionInput,
  ScreenshotArtifactRef,
  ScreenshotGridSpec,
  ScreenshotStructuredRef,
  ScreenshotVisualMissionInput,
} from "../contract.js";
import { VISUAL_MISSION_COORDINATE_INSTRUCTION } from "../shared/visual-mission-grid.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import { persistScreenshotStructuredDataRef } from "./screenshot-structured-data-ref.js";

type VisualMissionSupplementalOutput = {
  originalScreenshotRef: ScreenshotArtifactRef;
  coordinateGridScreenshotRef: ScreenshotArtifactRef;
  gridSpecRef: ScreenshotStructuredRef;
  visualMissionInputRef: ScreenshotStructuredRef;
  visualMissionInput: ScreenshotVisualMissionInput;
  gridSpec: ScreenshotGridSpec;
};

function resolveOriginalScreenshotRef(request: PrepareVisualMissionInput): ScreenshotArtifactRef {
  const originalScreenshotRef = request.source.sourceProof.sourceArtifactRef;
  if (!originalScreenshotRef) {
    throw new Error("prepare-visual-mission-input requires sourceProof.sourceArtifactRef.");
  }
  return originalScreenshotRef;
}

function buildGridSpecRefId(evidenceId: string): string {
  return `grid-spec:${evidenceId}`;
}

function buildVisualMissionInputRefId(evidenceId: string): string {
  return `visual-mission-input:${evidenceId}`;
}

function buildVisualMissionInputPayload(input: {
  originalScreenshotRef: ScreenshotArtifactRef;
  coordinateGridScreenshotRef: ScreenshotArtifactRef;
  gridSpecRef: ScreenshotStructuredRef;
}): ScreenshotVisualMissionInput {
  return {
    originalScreenshotRef: input.originalScreenshotRef.artifactId,
    coordinateGridScreenshotRef: input.coordinateGridScreenshotRef.artifactId,
    gridSpecRef: input.gridSpecRef.refId,
    coordinateInstruction: VISUAL_MISSION_COORDINATE_INSTRUCTION,
  };
}

export async function buildVisualMissionSupplementalOutput(input: {
  context: ScreenshotRuntimeContext;
  request: PrepareVisualMissionInput;
  evidenceId: string;
  createdAt: string;
  coordinateGridScreenshotRef: ScreenshotArtifactRef;
  gridSpec: ScreenshotGridSpec;
}): Promise<VisualMissionSupplementalOutput> {
  const originalScreenshotRef = resolveOriginalScreenshotRef(input.request);
  const rootDir = input.context.artifactPort.getRootDir();
  const gridSpecRefId = buildGridSpecRefId(input.evidenceId);
  const gridSpec = {
    ...input.gridSpec,
    gridSpecId: gridSpecRefId,
    gridSpecRef: gridSpecRefId,
  };
  const gridSpecRef = await persistScreenshotStructuredDataRef({
    rootDir,
    childCapabilityId: input.request.childCapabilityId,
    fileName: `${input.evidenceId}.grid-spec.json`,
    refId: gridSpecRefId,
    createdAt: input.createdAt,
    payload: gridSpec,
  });
  const visualMissionInput = buildVisualMissionInputPayload({
    originalScreenshotRef,
    coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
    gridSpecRef,
  });
  const visualMissionInputRef = await persistScreenshotStructuredDataRef({
    rootDir,
    childCapabilityId: input.request.childCapabilityId,
    fileName: `${input.evidenceId}.visual-mission-input.json`,
    refId: buildVisualMissionInputRefId(input.evidenceId),
    createdAt: input.createdAt,
    payload: visualMissionInput,
  });

  return {
    originalScreenshotRef,
    coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
    gridSpecRef,
    visualMissionInputRef,
    visualMissionInput,
    gridSpec,
  };
}