import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ScreenshotArtifactLifecycleManifestSchema,
  ScreenshotStoredArtifactSchema,
} from "../schema.js";
import type { ScreenshotArtifactPort } from "../ports/screenshot-artifact-port.js";
import { SCREENSHOT_ARTIFACT_PORT_KIND } from "../shared/screenshot-artifact.js";
import { SCREENSHOT_ARTIFACT_LIFECYCLE_MANIFEST_VERSION } from "../shared/screenshot-artifact-lifecycle-schema.js";

type StoreArtifactInput = Parameters<ScreenshotArtifactPort["storeArtifact"]>[0];

function createRootGuard(resolvedRootDir: string) {
  return (candidatePath: string): string => {
    const resolvedPath = path.resolve(candidatePath);
    const relativePath = path.relative(resolvedRootDir, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("artifact target escaped governed screenshot root");
    }
    return resolvedPath;
  };
}

function resolveArtifactExtension(mimeType: string) {
  return mimeType === "image/jpeg" ? ".jpg" : ".png";
}

async function copyArtifactIfMissing(sourceFilePath: string, targetPath: string) {
  try {
    await copyFile(sourceFilePath, targetPath, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
    if (code !== "EEXIST") {
      throw error;
    }
  }
}

function resolveArtifactDirectories(input: {
  resolvedRootDir: string;
  assertInsideRoot: (candidatePath: string) => string;
  childCapabilityId: string;
}) {
  return {
    artifactDir: input.assertInsideRoot(path.join(input.resolvedRootDir, "blobs")),
    manifestDir: input.assertInsideRoot(path.join(input.resolvedRootDir, "manifests", input.childCapabilityId)),
  };
}

function buildArtifactRef(input: StoreArtifactInput, fileName: string, targetPath: string) {
  return {
    artifactId: `${input.evidenceId}:artifact`,
    evidenceId: input.evidenceId,
    storageRef: targetPath,
    fileName,
    mimeType: input.mimeType,
    sha256: input.sha256,
    width: input.width,
    height: input.height,
    imageKind: input.imageKind,
    createdAt: input.createdAt,
  };
}

function buildLifecycleManifest(input: {
  storeInput: StoreArtifactInput;
  artifactRef: ReturnType<typeof buildArtifactRef>;
  artifactLifecycleManifestRef: string;
  byteSize: number;
}) {
  return ScreenshotArtifactLifecycleManifestSchema.parse({
    manifestVersion: SCREENSHOT_ARTIFACT_LIFECYCLE_MANIFEST_VERSION,
    artifactLifecycleManifestRef: input.artifactLifecycleManifestRef,
    artifactId: input.artifactRef.artifactId,
    evidenceId: input.storeInput.evidenceId,
    childCapabilityId: input.storeInput.childCapabilityId,
    missionId: input.storeInput.missionId,
    runId: input.storeInput.runId,
    sessionId: input.storeInput.sessionId,
    roundId: input.storeInput.roundId,
    videoVisitId: input.storeInput.videoVisitId,
    stepId: input.storeInput.stepId,
    capabilityCallId: input.storeInput.capabilityCallId,
    nerveBusEnvelopeId: input.storeInput.nerveBusEnvelopeId,
    requestedBy: input.storeInput.requestedBy,
    purpose: input.storeInput.purpose,
    storageRef: input.artifactRef.storageRef,
    artifactHash: input.storeInput.sha256,
    byteSize: input.byteSize,
    retentionClass: input.storeInput.retentionClass,
    promotionStatus: input.storeInput.promotionStatus,
    createdAt: input.storeInput.createdAt,
    expiresAt: input.storeInput.expiresAt,
    deleteAfter: input.storeInput.deleteAfter,
    cleanupEligible: input.storeInput.cleanupEligible,
    cleanupGate: input.storeInput.cleanupGate,
  });
}

function buildStoredArtifact(input: {
  artifactRef: ReturnType<typeof buildArtifactRef>;
  lifecycleManifest: ReturnType<typeof buildLifecycleManifest>;
}) {
  return ScreenshotStoredArtifactSchema.parse({
    artifactRef: input.artifactRef,
    artifactLifecycleManifestRef: input.lifecycleManifest.artifactLifecycleManifestRef,
    retentionClass: input.lifecycleManifest.retentionClass,
    expiresAt: input.lifecycleManifest.expiresAt,
    deleteAfter: input.lifecycleManifest.deleteAfter,
    artifactHash: input.lifecycleManifest.artifactHash,
    byteSize: input.lifecycleManifest.byteSize,
    promotionStatus: input.lifecycleManifest.promotionStatus,
    cleanupEligible: input.lifecycleManifest.cleanupEligible,
  });
}

async function storeFilesystemArtifact(input: {
  resolvedRootDir: string;
  assertInsideRoot: (candidatePath: string) => string;
  storeInput: StoreArtifactInput;
}) {
  const { artifactDir, manifestDir } = resolveArtifactDirectories({
    resolvedRootDir: input.resolvedRootDir,
    assertInsideRoot: input.assertInsideRoot,
    childCapabilityId: input.storeInput.childCapabilityId,
  });
  await mkdir(artifactDir, { recursive: true });
  await mkdir(manifestDir, { recursive: true });

  const fileName = `${input.storeInput.sha256}${resolveArtifactExtension(input.storeInput.mimeType)}`;
  const targetPath = input.assertInsideRoot(path.join(artifactDir, fileName));
  await copyArtifactIfMissing(input.storeInput.sourceFilePath, targetPath);

  const artifactRef = buildArtifactRef(input.storeInput, fileName, targetPath);
  const artifactStats = await stat(targetPath);
  const artifactLifecycleManifestRef = input.assertInsideRoot(path.join(manifestDir, `${input.storeInput.evidenceId}.lifecycle.json`));
  const lifecycleManifest = buildLifecycleManifest({
    storeInput: input.storeInput,
    artifactRef,
    artifactLifecycleManifestRef,
    byteSize: artifactStats.size,
  });
  await writeFile(artifactLifecycleManifestRef, JSON.stringify(lifecycleManifest, null, 2), "utf8");

  return buildStoredArtifact({ artifactRef, lifecycleManifest });
}

export function createFilesystemScreenshotArtifactPort(outputRootDir: string): ScreenshotArtifactPort {
  const resolvedRootDir = path.resolve(outputRootDir);
  const assertInsideRoot = createRootGuard(resolvedRootDir);

  return {
    portKind: SCREENSHOT_ARTIFACT_PORT_KIND,
    getRootDir() {
      return resolvedRootDir;
    },
    async storeArtifact(input) {
      return storeFilesystemArtifact({
        resolvedRootDir,
        assertInsideRoot,
        storeInput: input,
      });
    },
  };
}