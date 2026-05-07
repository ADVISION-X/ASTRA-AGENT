import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { BrowserGeometrySnapshot } from "./browser-controller.js";
import { activateChrome } from "./current-chrome-browser-controller-primitives.js";
import { runSpawn } from "./current-chrome-window-control.js";
import { createId } from "../local-runtime/ids.js";

const readImageSize = async (filePath: string): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Current Chrome screenshot produced unreadable dimensions for ${filePath}.`);
  }
  return { width: metadata.width, height: metadata.height };
};

const readMainScreenFrame = async (): Promise<{ x: number; y: number; width: number; height: number }> => {
  const output = await runSpawn("osascript", ["-l", "JavaScript", "-e", "ObjC.import('AppKit'); const f=$.NSScreen.mainScreen.frame; `${f.origin.x},${f.origin.y},${f.size.width},${f.size.height}`"]);
  const parts = output.split(",").map((value) => Number(value));
  const x = parts[0];
  const y = parts[1];
  const width = parts[2];
  const height = parts[3];
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    throw new Error(`Unable to read complete main screen frame for Chrome screenshot crop: ${output}`);
  }
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error(`Unable to read main screen frame for Chrome screenshot crop: ${output}`);
  }

  return { x, y, width, height };
};

const clampCropRegion = (input: {
  geometry: BrowserGeometrySnapshot;
  screenFrame: { x: number; y: number; width: number; height: number };
  fullImage: { width: number; height: number };
}) => {
  const scaleX = input.fullImage.width / input.screenFrame.width;
  const scaleY = input.fullImage.height / input.screenFrame.height;
  const left = Math.max(0, Math.round((input.geometry.windowX - input.screenFrame.x) * scaleX));
  const top = Math.max(0, Math.round((input.geometry.windowY - input.screenFrame.y) * scaleY));
  const width = Math.min(input.fullImage.width - left, Math.round(input.geometry.viewportWidth * scaleX));
  const height = Math.min(input.fullImage.height - top, Math.round(input.geometry.viewportHeight * scaleY));

  if (width <= 0 || height <= 0) {
    throw new Error(`Chrome screenshot crop region is outside the captured display: left=${left} top=${top} width=${width} height=${height}`);
  }

  return { left, top, width, height };
};

export const captureCurrentChromeScreenshot = async (input: {
  screenshotDir: string;
  geometry: BrowserGeometrySnapshot;
  regionLabel: string;
  abortSignal?: AbortSignal;
}) => {
  await mkdir(input.screenshotDir, { recursive: true });
  const screenshotPath = path.join(input.screenshotDir, `${createId(input.regionLabel)}.png`);
  const fullScreenshotPath = path.join(input.screenshotDir, `${createId(`${input.regionLabel}:full-screen-source`)}.png`);
  await activateChrome();
  await runSpawn("screencapture", ["-x", fullScreenshotPath], input.abortSignal ? { signal: input.abortSignal } : undefined);
  const fullDimensions = await readImageSize(fullScreenshotPath);
  const screenFrame = await readMainScreenFrame();
  const cropRegion = clampCropRegion({
    geometry: input.geometry,
    screenFrame,
    fullImage: fullDimensions,
  });
  await sharp(fullScreenshotPath)
    .extract(cropRegion)
    .png()
    .toFile(screenshotPath);
  await rm(fullScreenshotPath, { force: true }).catch(() => undefined);
  const dimensions = await readImageSize(screenshotPath);
  return { screenshotPath, dimensions };
};
