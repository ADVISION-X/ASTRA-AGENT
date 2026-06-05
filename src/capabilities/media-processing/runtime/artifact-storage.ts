import { mkdir, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  MediaProcessingArtifact,
  ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import { sha256File } from "./hash-stream.js";

export type MediaProcessingArtifactBuildInput = {
  input: ParsedMediaProcessingAbilityInput;
  filePath: string;
  contentType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  format: string;
  derivativeKind: MediaProcessingArtifact["derivativeKind"];
};

export const mediaProcessingRunDir = (
  dataDir: string,
  input: Pick<ParsedMediaProcessingAbilityInput, "runId" | "capabilityCallId">,
): string => path.join(
    dataDir,
    "runtime-data",
    "media-processing-artifacts",
    input.runId,
    input.capabilityCallId,
  );

export const ensureMediaProcessingRunDir = async (
  dataDir: string,
  input: Pick<ParsedMediaProcessingAbilityInput, "runId" | "capabilityCallId">,
): Promise<string> => {
  const runDir = mediaProcessingRunDir(dataDir, input);
  await mkdir(runDir, { recursive: true });
  return runDir;
};

export const buildMediaProcessingArtifact = async (
  artifactInput: MediaProcessingArtifactBuildInput,
): Promise<MediaProcessingArtifact> => {
  const details = await stat(artifactInput.filePath);
  const sha256 = await sha256File(artifactInput.filePath);
  const artifactRef = `media_processing_artifact_${randomUUID()}`;
  return {
    artifactRef,
    storageRef: artifactInput.filePath,
    filePath: artifactInput.filePath,
    contentType: artifactInput.contentType,
    byteSize: details.size,
    sha256,
    width: artifactInput.width,
    height: artifactInput.height,
    durationMs: artifactInput.durationMs,
    format: artifactInput.format,
    derivativeKind: artifactInput.derivativeKind,
  };
};

export const writeMediaProcessingProof = async (
  dataDir: string,
  input: ParsedMediaProcessingAbilityInput,
  proof: unknown,
): Promise<string> => {
  const runDir = await ensureMediaProcessingRunDir(dataDir, input);
  const proofPath = path.join(runDir, "proof.json");
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
  return proofPath;
};
