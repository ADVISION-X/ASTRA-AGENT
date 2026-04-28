import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { BrowserController, BrowserGeometrySnapshot } from "../../browser/browser-controller.js";
import { DEFAULT_TIKTOK_URL, TIKTOK_PLATFORM_ID } from "../../../capabilities/open/shared/platform-url-profiles.js";
import { summarizeTikTokLoginState, TIKTOK_REVIEW_REQUIRED_TAG } from "../../../capabilities/page-state/shared/platform-profiles.js";
import type { PlatformOperatorModeInfo, PlatformVideo, VideoOrientationMode } from "../platform-runtime-contract.js";

export { DEFAULT_TIKTOK_URL, TIKTOK_PLATFORM_ID };
export const VISUAL_SIGNATURE_MATCH_DISTANCE = 6;
export const NEXT_VIDEO_CONFIRMATION_DISTANCE = 10;
export const MAX_RECENT_VIDEO_IDENTITIES = 24;
export const REVIEW_REQUIRED_TAG = TIKTOK_REVIEW_REQUIRED_TAG;

export type TikTokPlatformVideo = PlatformVideo & {
  screenshotHash: string;
  visualSignature: string;
};
export type OrientationBox = (geometry: BrowserGeometrySnapshot) => { x: number; y: number; width: number; height: number };
export type OrientationCoordinateProfile = {
  like_button: OrientationBox;
  comments_button: OrientationBox;
};
export type TikTokRecentVideoIdentity = {
  id: string;
  visualSignature: string;
};

export const TIKTOK_ORIENTATION_PROFILES: Record<Exclude<VideoOrientationMode, "unknown">, OrientationCoordinateProfile> = {
  portrait: {
    like_button: (geometry) => ({
      x: geometry.viewportWidth * 0.9,
      y: geometry.viewportHeight * 0.48,
      width: Math.max(56, geometry.viewportWidth * 0.045),
      height: Math.max(56, geometry.viewportHeight * 0.08),
    }),
    comments_button: (geometry) => ({
      x: geometry.viewportWidth * 0.9,
      y: geometry.viewportHeight * 0.61,
      width: Math.max(56, geometry.viewportWidth * 0.045),
      height: Math.max(56, geometry.viewportHeight * 0.08),
    }),
  },
  landscape: {
    like_button: (geometry) => ({
      x: geometry.viewportWidth * 0.93,
      y: geometry.viewportHeight * 0.35,
      width: Math.max(56, geometry.viewportWidth * 0.05),
      height: Math.max(64, geometry.viewportHeight * 0.10),
    }),
    comments_button: (geometry) => ({
      x: geometry.viewportWidth * 0.93,
      y: geometry.viewportHeight * 0.52,
      width: Math.max(56, geometry.viewportWidth * 0.05),
      height: Math.max(64, geometry.viewportHeight * 0.10),
    }),
  },
};

export function resolveOrientationProfile(orientation: VideoOrientationMode): OrientationCoordinateProfile {
  return orientation === "landscape" ? TIKTOK_ORIENTATION_PROFILES.landscape : TIKTOK_ORIENTATION_PROFILES.portrait;
}
export function normalizeVideoId(input: { visualSignature?: string; roundIndex: number }): string {
  const compact = input.visualSignature?.replaceAll(/[^a-f0-9]+/g, "").slice(0, 16) ?? "";
  return compact.length > 0 ? `tiktok-visit-${compact}` : `tiktok-round-${input.roundIndex}`;
}

export function extractTags(lines: string[]): string[] {
  const tags = lines
    .flatMap((line) => line.split(/\s+/))
    .filter((part) => part.startsWith("#"))
    .map((part) => part.replaceAll(/[^#\p{L}\p{N}_-]+/gu, ""));
  return [...new Set(tags)].slice(0, 8);
}
export function summarizeLoginState(loginState: ReturnType<BrowserController["getSessionState"]>["loginState"]): string {
  return summarizeTikTokLoginState(loginState);
}
export function buildGeometryReadyOperatorModeInfo(input: {
  geometry: Pick<BrowserGeometrySnapshot, "viewportWidth" | "viewportHeight" | "scaleFactor" | "capturedAt">;
  orientation: VideoOrientationMode;
}): PlatformOperatorModeInfo {
  return {
    executionMode: "Vision-first Coordinate Mode",
    fallbackMode: "Visual-only Coordinate Runtime",
    geometryGuard: "Safety gate armed",
    viewport: `${input.geometry.viewportWidth} x ${input.geometry.viewportHeight} @ ${input.geometry.scaleFactor.toFixed(2)}`,
    calibration: `Geometry sampled ${input.geometry.capturedAt}`,
    orientation: input.orientation,
  };
}

function runSpawn(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function getBmpGrayPixel(buffer: Buffer, x: number, y: number): number {
  const pixelOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const height = Math.abs(rawHeight);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const rowIndex = rawHeight > 0 ? height - 1 - y : y;
  const offset = pixelOffset + rowIndex * rowStride + x * bytesPerPixel;
  const blue = buffer[offset] ?? 0;
  const green = buffer[offset + 1] ?? 0;
  const red = buffer[offset + 2] ?? 0;
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}

function createDifferenceHashFromBmp(buffer: Buffer): string {
  const width = buffer.readInt32LE(18);
  const height = Math.abs(buffer.readInt32LE(22));
  if (width < 9 || height < 8) {
    throw new Error(`bmp thumbnail is too small for governed next-video hashing: ${width}x${height}`);
  }

  let hash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = getBmpGrayPixel(buffer, column, row);
      const right = getBmpGrayPixel(buffer, column + 1, row);
      hash = (hash << 1n) | BigInt(left > right ? 1 : 0);
    }
  }

  return hash.toString(16).padStart(16, "0");
}

export function hammingDistanceHex(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length);
  const leftValue = BigInt(`0x${left.padStart(maxLength, "0")}`);
  const rightValue = BigInt(`0x${right.padStart(maxLength, "0")}`);
  let diff = leftValue ^ rightValue;
  let distance = 0;

  while (diff > 0n) {
    distance += Number(diff & 1n);
    diff >>= 1n;
  }

  return distance;
}

export async function createVisualSignature(sourceFilePath?: string): Promise<string> {
  if (!sourceFilePath) {
    throw new Error("visual signature requires a governed screenshot source file");
  }

  const bmpPath = path.join(path.dirname(sourceFilePath), `${path.basename(sourceFilePath, path.extname(sourceFilePath))}.dhash.bmp`);
  await runSpawn("sips", ["-s", "format", "bmp", "-z", "8", "9", sourceFilePath, "--out", bmpPath]);
  try {
    const buffer = await readFile(bmpPath);
    return createDifferenceHashFromBmp(buffer);
  } finally {
    await rm(bmpPath, { force: true }).catch(() => undefined);
  }
}

export async function hashCaptureFile(sourceFilePath: string | undefined, fallbackRoundIndex: number): Promise<string> {
  if (!sourceFilePath) {
    return `missing-capture-${fallbackRoundIndex}`;
  }

  const content = await readFile(sourceFilePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}