import { createHash } from "node:crypto";
import { open, readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

import type { AiFeedInput } from "../schema.js";

export type UploadableAiFeedInputRef = {
  id: string;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  summary: string;
  sha256: `sha256:${string}`;
  byteCount: number;
};

export type AiFeedInputPackage = {
  inputHash: string;
  inputRefIds: string[];
  imagePaths: string[];
  uploadableFiles: UploadableAiFeedInputRef[];
};

const hashValue = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const fileHash = (value: Buffer): `sha256:${string}` =>
  `sha256:${hashValue(value)}`;

const normalizeDeclaredHash = (value: string): `sha256:${string}` =>
  (value.startsWith("sha256:") ? value : `sha256:${value}`) as `sha256:${string}`;

const assertPromptSafe = (input: AiFeedInput): void => {
  if (input.textPrompt.length > input.maxInputChars) {
    throw new Error(`AI feed prompt exceeds maxInputChars=${input.maxInputChars}.`);
  }
};

const isImageRef = (mimeType: string | undefined, filePath: string): boolean =>
  mimeType?.startsWith("image/") === true
  || /\.(png|jpe?g|webp|gif)$/iu.test(filePath);

const isVideoRef = (mimeType: string | undefined, filePath: string): boolean =>
  mimeType?.startsWith("video/") === true
  || ((mimeType === undefined || mimeType === "application/octet-stream")
    && /\.(mp4|m4v|mov)$/iu.test(filePath));

const isDocumentEvidenceRef = (mimeType: string | undefined, filePath: string): boolean =>
  mimeType === "application/json"
  || mimeType === "application/zip"
  || mimeType === "application/x-ndjson"
  || mimeType === "text/markdown"
  || mimeType === "text/plain"
  || /\.(json|jsonl|md|txt|zip)$/iu.test(filePath);

const hasMp4Header = async (filePath: string): Promise<boolean> => {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    const readResult = await handle.read(buffer, 0, 12, 0);
    if (readResult.bytesRead < 12) {
      return false;
    }
    return buffer.subarray(4, 12).toString("ascii").includes("ftyp");
  } finally {
    await handle.close();
  }
};

const assertUploadableFile = async (filePath: string, mimeType: string | undefined): Promise<void> => {
  if (isVideoRef(mimeType, filePath) && !(await hasMp4Header(filePath))) {
    throw new Error(`AI feed video file is not a valid MP4 container: ${filePath}.`);
  }
  if (!isVideoRef(mimeType, filePath) && !isImageRef(mimeType, filePath) && !isDocumentEvidenceRef(mimeType, filePath)) {
    throw new Error(`AI feed file is not an approved image, video, or evidence document input: ${filePath}.`);
  }
};

const assertFileLimits = async (input: AiFeedInput): Promise<{
  imagePaths: string[];
  uploadableFiles: UploadableAiFeedInputRef[];
}> => {
  const fileRefs = input.inputRefs.filter((ref) => ref.filePath);
  if (fileRefs.length > input.maxFileCount) {
    throw new Error(`AI feed file count exceeds maxFileCount=${input.maxFileCount}.`);
  }
  const uploadableFiles: UploadableAiFeedInputRef[] = [];
  for (const ref of fileRefs) {
    const filePath = ref.filePath;
    if (!filePath) continue;
    const info = await stat(filePath);
    if (info.size > input.maxFileBytes) {
      throw new Error(`AI feed file exceeds maxFileBytes=${input.maxFileBytes}: ${ref.id}.`);
    }
    await assertUploadableFile(filePath, ref.mimeType);
    const bytes = await readFile(filePath);
    const actualFileName = basename(filePath);
    const actualSha256 = fileHash(bytes);
    if (ref.fileName !== undefined && ref.fileName !== actualFileName) {
      throw new Error(`AI_FEED_FILE_NAME_MISMATCH:${ref.id}:expected=${ref.fileName}:actual=${actualFileName}`);
    }
    if (ref.byteCount !== undefined && ref.byteCount !== bytes.byteLength) {
      throw new Error(`AI_FEED_FILE_BYTE_COUNT_MISMATCH:${ref.id}:expected=${ref.byteCount}:actual=${bytes.byteLength}`);
    }
    if (ref.sha256 !== undefined && normalizeDeclaredHash(ref.sha256) !== actualSha256) {
      throw new Error(`AI_FEED_FILE_SHA256_MISMATCH:${ref.id}`);
    }
    uploadableFiles.push({
      id: ref.id,
      filePath,
      fileName: actualFileName,
      mimeType: ref.mimeType ?? null,
      summary: ref.summary,
      sha256: actualSha256,
      byteCount: bytes.byteLength,
    });
  }
  const imagePaths = fileRefs
    .map((ref) => ref.filePath)
    .filter((filePath): filePath is string => Boolean(filePath))
    .filter((filePath, index, all) => all.indexOf(filePath) === index)
    .filter((filePath) => isImageRef(fileRefs.find((ref) => ref.filePath === filePath)?.mimeType, filePath));
  return {
    imagePaths,
    uploadableFiles,
  };
};

export const buildAiFeedInputPackage = async (
  input: AiFeedInput,
): Promise<AiFeedInputPackage> => {
  assertPromptSafe(input);
  const { imagePaths, uploadableFiles } = await assertFileLimits(input);
  return {
    inputHash: hashValue(JSON.stringify({
      providerKind: input.providerKind,
      promptPackageId: input.promptPackageId,
      promptContractId: input.promptContractId,
      expectedOutputSchemaRef: input.expectedOutputSchemaRef,
      providerContinuationRef: input.providerContinuationRef ?? null,
      textPrompt: input.textPrompt,
      inputRefs: input.inputRefs.map((ref) => ({
        id: ref.id,
        kind: ref.kind,
        summary: ref.summary,
        filePath: ref.filePath ?? null,
        fileName: ref.fileName ?? null,
        mimeType: ref.mimeType ?? null,
        sha256: ref.sha256 ?? null,
        byteCount: ref.byteCount ?? null,
      })),
      fileIntegrity: uploadableFiles.map(({ id, sha256, byteCount }) => ({ id, sha256, byteCount })),
    })),
    inputRefIds: input.inputRefs.map((ref) => ref.id),
    imagePaths,
    uploadableFiles,
  };
};
