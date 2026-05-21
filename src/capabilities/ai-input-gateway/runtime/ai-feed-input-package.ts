import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import type { AiFeedInput } from "../schema.js";

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

const assertFileLimits = async (input: AiFeedInput): Promise<string[]> => {
  const fileRefs = input.inputRefs.filter((ref) => ref.filePath);
  if (fileRefs.length > input.maxFileCount) {
    throw new Error(`AI feed file count exceeds maxFileCount=${input.maxFileCount}.`);
  }
  for (const ref of fileRefs) {
    const filePath = ref.filePath;
    if (!filePath) continue;
    const info = await stat(filePath);
    if (info.size > input.maxFileBytes) {
      throw new Error(`AI feed file exceeds maxFileBytes=${input.maxFileBytes}: ${ref.id}.`);
    }
  }
  return fileRefs
    .map((ref) => ref.filePath)
    .filter((filePath): filePath is string => Boolean(filePath))
    .filter((filePath, index, all) => all.indexOf(filePath) === index)
    .filter((filePath) => isImageRef(fileRefs.find((ref) => ref.filePath === filePath)?.mimeType, filePath));
};

export const buildAiFeedInputPackage = async (
  input: AiFeedInput,
): Promise<AiFeedInputPackage> => {
  assertPromptSafe(input);
  const imagePaths = await assertFileLimits(input);
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
  };
};
