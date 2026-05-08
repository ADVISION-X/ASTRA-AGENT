import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";

type JsonObject = Record<string, unknown>;

type ScreenshotStoredImageSourceHandoff = {
  kind: "stored_image";
  sourceStorageRef: string;
  sourceArtifactRef: JsonObject;
  sourceProof: JsonObject;
  coordinateSpace: string;
};

const screenshotSourceHandoffs = new Map<string, ScreenshotStoredImageSourceHandoff>();

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonObject, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

function buildSourceProof(input: {
  output: JsonObject;
  runtimeProof: JsonObject;
  artifactRef: JsonObject;
  sourceStorageRef: string;
  sourceHash: string;
}) {
  return {
    proofRef: readString(input.runtimeProof, "proofId") ?? readString(input.output, "evidenceId") ?? input.sourceStorageRef,
    sourceKind: "stored_image",
    sourceStorageRef: input.sourceStorageRef,
    sourceArtifactRef: input.artifactRef,
    sourceScreenshotEvidenceId: readString(input.output, "evidenceId"),
    sourceHash: input.sourceHash,
    coordinateSpace: readString(input.output, "coordinateSpace"),
    sourceWidth: input.output.width ?? null,
    sourceHeight: input.output.height ?? null,
    missionId: readString(input.runtimeProof, "missionId"),
    runId: readString(input.runtimeProof, "runId"),
    sessionId: readString(input.runtimeProof, "sessionId"),
    roundId: input.runtimeProof.roundId ?? null,
    videoVisitId: input.runtimeProof.videoVisitId ?? null,
    stepId: input.runtimeProof.stepId ?? null,
    capabilityCallId: input.runtimeProof.capabilityCallId ?? null,
    pageStateProofRef: input.runtimeProof.pageStateProofRef ?? null,
    browserSessionRef: input.runtimeProof.browserSessionRef ?? null,
  };
}

function resolveScreenshotSourceHandoffFields(result: WorkbenchAbilityExecutionResult) {
  if (result.abilityGroupId !== "screenshot" || result.status !== "success" || !isObject(result.output) || !isObject(result.runtimeProof)) {
    return null;
  }

  const artifactRef = result.output.artifactRef;
  if (!isObject(artifactRef)) {
    return null;
  }

  return { output: result.output, runtimeProof: result.runtimeProof, artifactRef };
}

function resolveScreenshotSourceIdentity(input: { output: JsonObject; artifactRef: JsonObject }) {
  const artifactRef = input.artifactRef;
  const sourceStorageRef = readString(artifactRef, "storageRef");
  const sourceHash = readString(artifactRef, "sha256");
  const coordinateSpace = readString(input.output, "coordinateSpace");
  return sourceStorageRef && sourceHash && coordinateSpace
    ? { sourceStorageRef, sourceHash, coordinateSpace }
    : null;
}

function buildScreenshotSourceHandoff(result: WorkbenchAbilityExecutionResult): ScreenshotStoredImageSourceHandoff | null {
  const fields = resolveScreenshotSourceHandoffFields(result);
  if (!fields) {
    return null;
  }

  const identity = resolveScreenshotSourceIdentity(fields);
  if (!identity) {
    return null;
  }

  const { sourceStorageRef, sourceHash, coordinateSpace } = identity;
  const artifactRef = fields.artifactRef;
  return {
    kind: "stored_image",
    sourceStorageRef,
    sourceArtifactRef: artifactRef,
    sourceProof: buildSourceProof({ output: fields.output, runtimeProof: fields.runtimeProof, artifactRef, sourceStorageRef, sourceHash }),
    coordinateSpace,
  };
}

export function recordScreenshotSourceHandoff(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): void {
  const handoff = buildScreenshotSourceHandoff(input.result);
  if (!handoff) {
    return;
  }

  screenshotSourceHandoffs.set(input.outputRef, handoff);
  const evidenceId = isObject(input.result.output) ? readString(input.result.output, "evidenceId") : null;
  if (evidenceId) {
    screenshotSourceHandoffs.set(evidenceId, handoff);
  }
}

export function resolveScreenshotSourceHandoff(refs: readonly (string | null)[]): ScreenshotStoredImageSourceHandoff | null {
  for (const ref of refs) {
    if (!ref) {
      continue;
    }
    const handoff = screenshotSourceHandoffs.get(ref);
    if (handoff) {
      return handoff;
    }
  }
  return null;
}
