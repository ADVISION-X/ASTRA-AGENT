import { mkdir } from "node:fs/promises";
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

export const captureCurrentChromeScreenshot = async (input: {
  screenshotDir: string;
  geometry: BrowserGeometrySnapshot;
  regionLabel: string;
  abortSignal?: AbortSignal;
}) => {
  await mkdir(input.screenshotDir, { recursive: true });
  const screenshotPath = path.join(input.screenshotDir, `${createId(input.regionLabel)}.png`);
  await activateChrome();
  await runSpawn(
    "screencapture",
    ["-x", "-R", `${Math.round(input.geometry.windowX)},${Math.round(input.geometry.windowY)},${Math.round(input.geometry.viewportWidth)},${Math.round(input.geometry.viewportHeight)}`, screenshotPath],
    input.abortSignal ? { signal: input.abortSignal } : undefined,
  );
  const dimensions = await readImageSize(screenshotPath);
  return { screenshotPath, dimensions };
};
