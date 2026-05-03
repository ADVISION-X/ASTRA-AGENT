import { stat } from "node:fs/promises";
import path from "node:path";

import type {
  ScreenshotAbilityInput,
  ScreenshotChildCapabilityId,
  ScreenshotImageKind,
} from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import {
  evaluateScreenshotArtifactBudget,
  resolveScreenshotArtifactLifecyclePlan,
  resolveScreenshotRetentionClass,
} from "./screenshot-artifact-lifecycle.js";

type StoredArtifact = Awaited<ReturnType<ScreenshotRuntimeContext["artifactPort"]["storeArtifact"]>>;
type ArtifactStorageGateResult = {
  decision: { status: "passed" | "failed"; reason: string | null };
  artifactRef: StoredArtifact["artifactRef"] | null;
  artifactLifecycleManifestRef: string | null;
  retentionClass: ReturnType<typeof resolveScreenshotRetentionClass> | null;
  expiresAt: string | null;
  deleteAfter: string | null;
  artifactHash: string | null;
  byteSize: number | null;
  promotionStatus: StoredArtifact["promotionStatus"] | null;
  cleanupEligible: boolean | null;
  outputHash: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
};

function buildArtifactStorageFailure(reason: string, message: string, detail: string | null = null) {
  const code = reason === "artifact_path_outside_root"
    ? "artifact_path_invalid"
    : reason === "artifact_budget_exceeded"
      ? "artifact_budget_exceeded"
      : reason === "artifact_lifecycle_invalid"
        ? "artifact_lifecycle_invalid"
        : "artifact_write_failed";

  return {
    decision: { status: "failed" as const, reason },
    artifactRef: null,
    artifactLifecycleManifestRef: null,
    retentionClass: null,
    expiresAt: null,
    deleteAfter: null,
    artifactHash: null,
    byteSize: null,
    promotionStatus: null,
    cleanupEligible: null,
    outputHash: null,
    failure: createScreenshotFailure({
      code,
      message,
      detail,
    }),
  };
}

function isArtifactStorageInsideRoot(rootDir: string, storageRef: string) {
  const relativePath = path.relative(rootDir, path.resolve(storageRef));
  return !relativePath.startsWith("..") && !relativePath.startsWith("/");
}

function isLifecycleManifestInsideRoot(rootDir: string, manifestRef: string) {
  const relativePath = path.relative(rootDir, path.resolve(manifestRef));
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function buildArtifactStorageSuccess(storedArtifact: StoredArtifact, outputHash: string): ArtifactStorageGateResult {
  return {
    decision: { status: "passed", reason: null },
    artifactRef: storedArtifact.artifactRef,
    artifactLifecycleManifestRef: storedArtifact.artifactLifecycleManifestRef,
    retentionClass: storedArtifact.retentionClass,
    expiresAt: storedArtifact.expiresAt,
    deleteAfter: storedArtifact.deleteAfter,
    artifactHash: storedArtifact.artifactHash,
    byteSize: storedArtifact.byteSize,
    promotionStatus: storedArtifact.promotionStatus,
    cleanupEligible: storedArtifact.cleanupEligible,
    outputHash,
    failure: null,
  };
}

function resolveStoredArtifactRootFailure(rootDir: string, storedArtifact: StoredArtifact) {
  return !isArtifactStorageInsideRoot(rootDir, storedArtifact.artifactRef.storageRef) || !isLifecycleManifestInsideRoot(rootDir, storedArtifact.artifactLifecycleManifestRef)
    ? buildArtifactStorageFailure("artifact_path_outside_root", "Screenshot artifact storage escaped the governed root directory.")
    : null;
}

function resolveStoredArtifactHashFailure(storedArtifact: StoredArtifact, outputHash: string) {
  return storedArtifact.artifactHash !== outputHash
    ? buildArtifactStorageFailure("artifact_lifecycle_invalid", "Screenshot artifact lifecycle hash must match the stored output hash.")
    : null;
}

async function resolveArtifactOutputState(context: ScreenshotRuntimeContext, outputFilePath: string) {
  const outputHash = await context.imageProcessingPort.hashFile(outputFilePath);
  const artifactFileStats = await stat(outputFilePath);
  return { outputHash, byteSize: artifactFileStats.size };
}

function resolveArtifactBudgetFailure(input: {
  request: ScreenshotAbilityInput;
  byteSize: number;
  lifecyclePlan: ReturnType<typeof resolveScreenshotArtifactLifecyclePlan>;
}) {
  return evaluateScreenshotArtifactBudget({
    request: input.request,
    byteSize: input.byteSize,
    retentionClass: input.lifecyclePlan.retentionClass,
  });
}

function buildStoreArtifactInput(input: {
  request: ScreenshotAbilityInput;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  outputFilePath: string;
  imageKind: ScreenshotImageKind;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
  outputHash: string;
  lifecyclePlan: ReturnType<typeof resolveScreenshotArtifactLifecyclePlan>;
}) {
  return {
    childCapabilityId: input.childCapabilityId,
    evidenceId: input.evidenceId,
    sourceFilePath: input.outputFilePath,
    mimeType: input.mimeType,
    sha256: input.outputHash,
    width: input.width,
    height: input.height,
    imageKind: input.imageKind,
    createdAt: input.createdAt,
    missionId: input.request.missionId,
    runId: input.request.runId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    stepId: input.request.stepId,
    mapPackageId: input.request.mapPackageId,
    mapPackageVersion: input.request.mapPackageVersion,
    selectedMapId: input.request.selectedMapId,
    selectedMapVersion: input.request.selectedMapVersion,
    activationSnapshotRef: input.request.activationSnapshotRef,
    capabilityCallId: input.request.capabilityCallId,
    nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
    requestedBy: input.request.requestedBy,
    purpose: input.request.purpose,
    retentionClass: input.lifecyclePlan.retentionClass,
    promotionStatus: input.lifecyclePlan.promotionStatus,
    expiresAt: input.lifecyclePlan.expiresAt,
    deleteAfter: input.lifecyclePlan.deleteAfter,
    cleanupEligible: input.lifecyclePlan.cleanupEligible,
    cleanupGate: input.lifecyclePlan.cleanupGate,
  };
}

async function persistScreenshotArtifact(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  outputFilePath: string;
  imageKind: ScreenshotImageKind;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
}): Promise<ArtifactStorageGateResult> {
  const rootDir = input.context.artifactPort.getRootDir();
  const { outputHash, byteSize } = await resolveArtifactOutputState(input.context, input.outputFilePath);
  const lifecyclePlan = resolveScreenshotArtifactLifecyclePlan({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    createdAt: input.createdAt,
  });
  const budgetFailure = resolveArtifactBudgetFailure({ request: input.request, byteSize, lifecyclePlan });
  if (budgetFailure) {
    return buildArtifactStorageFailure("artifact_budget_exceeded", budgetFailure.message);
  }

  const storedArtifact = await input.context.artifactPort.storeArtifact(buildStoreArtifactInput({ ...input, outputHash, lifecyclePlan }));

  return resolveStoredArtifactRootFailure(rootDir, storedArtifact)
    ?? resolveStoredArtifactHashFailure(storedArtifact, outputHash)
    ?? buildArtifactStorageSuccess(storedArtifact, outputHash);
}

async function resolveArtifactStorageGate(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  outputFilePath: string;
  imageKind: ScreenshotImageKind;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
}): Promise<ArtifactStorageGateResult> {
  try {
    return await persistScreenshotArtifact(input);
  } catch (error) {
    return buildArtifactStorageFailure(
      "artifact_write_failed",
      "Screenshot artifact persistence failed.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function runArtifactStorageGate(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  childCapabilityId: ScreenshotChildCapabilityId;
  evidenceId: string;
  outputFilePath: string;
  imageKind: ScreenshotImageKind;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
}): Promise<ArtifactStorageGateResult> {
  return resolveArtifactStorageGate(input);
}
