import { createHash } from "node:crypto";
import { open, stat } from "node:fs/promises";

import type { AiFeedInput } from "../schema.js";

export type UploadableAiFeedInputRef = {
  id: string;
  filePath: string;
  mimeType: string | null;
  summary: string;
};

const SENSITIVE_INPUT_PATTERNS = [
  /\bcookie\b/iu,
  /\bsessionStorage\b/u,
  /\blocalStorage\b/u,
  /\bpassword\b/iu,
  /\btoken\b/iu,
  /\bsecret\b/iu,
] as const;

export type AiFeedInputPackage = {
  inputHash: string;
  inputRefIds: string[];
  imagePaths: string[];
  uploadableFiles: UploadableAiFeedInputRef[];
};

const hashValue = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const assertPromptSafe = (input: AiFeedInput): void => {
  if (input.textPrompt.length > input.maxInputChars) {
    throw new Error(`AI feed prompt exceeds maxInputChars=${input.maxInputChars}.`);
  }
  const forbiddenPattern = SENSITIVE_INPUT_PATTERNS.find((pattern) => pattern.test(input.textPrompt));
  if (forbiddenPattern) {
    throw new Error(`AI feed prompt contains forbidden sensitive token pattern: ${forbiddenPattern.source}.`);
  }
};

const isImageRef = (mimeType: string | undefined, filePath: string): boolean =>
  mimeType?.startsWith("image/") === true
  || /\.(png|jpe?g|webp|gif)$/iu.test(filePath);

const isVideoRef = (mimeType: string | undefined, filePath: string): boolean =>
  mimeType?.startsWith("video/") === true
  || ((mimeType === undefined || mimeType === "application/octet-stream")
    && /\.(mp4|m4v|mov)$/iu.test(filePath));

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
  if (!isVideoRef(mimeType, filePath) && !isImageRef(mimeType, filePath)) {
    throw new Error(`AI feed file is not an approved image or video input: ${filePath}.`);
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
    uploadableFiles.push({
      id: ref.id,
      filePath,
      mimeType: ref.mimeType ?? null,
      summary: ref.summary,
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
      textPrompt: input.textPrompt,
      inputRefs: input.inputRefs.map((ref) => ({
        id: ref.id,
        kind: ref.kind,
        summary: ref.summary,
        filePath: ref.filePath ?? null,
        mimeType: ref.mimeType ?? null,
      })),
    })),
    inputRefIds: input.inputRefs.map((ref) => ref.id),
    imagePaths,
    uploadableFiles,
  };
};
