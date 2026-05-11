// model-safe-image.ts
// Local AI model-safe image normalization — internal to local-ai boundary only.
// NOT exported from index.ts.  NOT a capability.  NOT a Forensics artifact writer.
//
// Responsibility: resize oversized screenshots to safe pixel dimensions before
// passing to the vision model.  Original Screenshot artifacts are NEVER touched.
//
// qwen2.5vl:3b vision patch budget:
//   224×224 px per patch. Max safe long edge = 5 patches/side → 5×224 = 1120 px.
//   Two-image prompts: 5×5 × 2 images = 50 patches — within 3B context window.
//   At 2446 px: 11×11 patches/image × 2 = 242 patches → GGML_ASSERT crash.

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum long edge (px) accepted by qwen2.5vl:3b without GGML patch overflow. */
export const MAX_VISION_IMAGE_LONG_EDGE_PX = 1120;

/** Maximum byte size gate — rejects abnormally large source files before processing. */
const MAX_VISION_IMAGE_BYTES = 1_000_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelSafeImageInput = {
  /** Base64-encoded model-input image (resized if necessary). */
  base64: string;
  mimeType: "image/png";
  /** Original image dimensions (from the source file). */
  originalWidth: number;
  originalHeight: number;
  /** Dimensions of the image that will be sent to the model. */
  modelInputWidth: number;
  modelInputHeight: number;
  /** True if the image was resized from original before model invocation. */
  wasResized: boolean;
  /** Byte size of the original source file. */
  originalBytes: number;
  /** Byte size of the model input buffer. */
  modelInputBytes: number;
  /** SHA-256 of the original source file buffer. */
  originalHash: string;
  /** SHA-256 of the model input buffer (matches original when not resized). */
  modelInputHash: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Read a screenshot file and return a model-safe base64 payload.
 * Resizes in-memory when the long edge exceeds MAX_VISION_IMAGE_LONG_EDGE_PX.
 * Original file is never modified.
 * Throws an error prefixed "MODEL_IMAGE_NORMALIZATION_FAILED:" on any failure — fail closed.
 */
export async function prepareModelSafeImage(filePath: string): Promise<ModelSafeImageInput> {
  // ── Byte gate: reject abnormally large source files ───────────────────────
  const fileStat = await stat(filePath);
  if (fileStat.size > MAX_VISION_IMAGE_BYTES) {
    throw new Error(
      `MODEL_IMAGE_NORMALIZATION_FAILED: Vision input exceeds ${MAX_VISION_IMAGE_BYTES} bytes` +
        ` (${fileStat.size}). Original artifact too large for model input boundary.`,
    );
  }
  const originalBytes = fileStat.size;

  // ── Read original buffer ──────────────────────────────────────────────────
  const originalBuffer = await readFile(filePath);
  const originalHash = sha256(originalBuffer);

  // ── Read pixel dimensions ─────────────────────────────────────────────────
  let meta: sharp.Metadata;
  try {
    meta = await sharp(originalBuffer).metadata();
  } catch (err) {
    throw new Error(
      `MODEL_IMAGE_NORMALIZATION_FAILED: Cannot read image metadata: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!meta.width || !meta.height) {
    throw new Error(
      `MODEL_IMAGE_NORMALIZATION_FAILED: Image has no readable pixel dimensions.`,
    );
  }

  const originalWidth = meta.width;
  const originalHeight = meta.height;
  const longEdge = Math.max(originalWidth, originalHeight);

  // ── Conditional resize ────────────────────────────────────────────────────
  let modelInputBuffer: Buffer;
  let modelInputWidth: number;
  let modelInputHeight: number;
  let wasResized: boolean;

  if (longEdge > MAX_VISION_IMAGE_LONG_EDGE_PX) {
    let resizedBuffer: Buffer;
    try {
      resizedBuffer = await sharp(originalBuffer)
        .resize({
          width: MAX_VISION_IMAGE_LONG_EDGE_PX,
          height: MAX_VISION_IMAGE_LONG_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
    } catch (err) {
      throw new Error(
        `MODEL_IMAGE_NORMALIZATION_FAILED: Resize failed: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!resizedBuffer || resizedBuffer.length === 0) {
      throw new Error(
        `MODEL_IMAGE_NORMALIZATION_FAILED: Resize produced an empty buffer.`,
      );
    }

    // Read dimensions of the resized output.
    let resizedMeta: sharp.Metadata;
    try {
      resizedMeta = await sharp(resizedBuffer).metadata();
    } catch (err) {
      throw new Error(
        `MODEL_IMAGE_NORMALIZATION_FAILED: Cannot read resized image metadata: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!resizedMeta.width || !resizedMeta.height) {
      throw new Error(
        `MODEL_IMAGE_NORMALIZATION_FAILED: Resized image has no readable dimensions.`,
      );
    }

    // Post-resize byte gate — fail closed if the PNG is still too large.
    if (resizedBuffer.length > MAX_VISION_IMAGE_BYTES) {
      throw new Error(
        `MODEL_IMAGE_NORMALIZATION_FAILED: Resized image still exceeds ${MAX_VISION_IMAGE_BYTES} bytes` +
          ` (${resizedBuffer.length}). Refusing to send oversized model input.`,
      );
    }

    modelInputBuffer = resizedBuffer;
    modelInputWidth = resizedMeta.width;
    modelInputHeight = resizedMeta.height;
    wasResized = true;
  } else {
    // No resize needed — original dimensions are within safe range.
    modelInputBuffer = originalBuffer;
    modelInputWidth = originalWidth;
    modelInputHeight = originalHeight;
    wasResized = false;
  }

  const modelInputHash = sha256(modelInputBuffer);
  const modelInputBytes = modelInputBuffer.length;

  return {
    base64: modelInputBuffer.toString("base64"),
    mimeType: "image/png",
    originalWidth,
    originalHeight,
    modelInputWidth,
    modelInputHeight,
    wasResized,
    originalBytes,
    modelInputBytes,
    originalHash,
    modelInputHash,
  };
}
