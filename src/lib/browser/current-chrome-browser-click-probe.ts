import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { BrowserClickCoordinateSpace, BrowserGeometrySnapshot } from "./browser-controller.js";

type MouseClickProbeInput = {
  screenshotDir: string;
  targetLabel: string;
  coordinateSpace: BrowserClickCoordinateSpace;
  inputPoint: { x: number; y: number };
  computedDesktopPoint: { x: number; y: number };
  geometry: Pick<BrowserGeometrySnapshot, "windowX" | "windowY" | "viewportWidth" | "viewportHeight" | "visibleContentBounds">;
};

const isMouseClickProbeEnabled = (): boolean =>
  process.env.GRASSEYE_VISUAL_TARGET_INPUT_PROBE === "1" || process.env.GRASSEYE_MOUSE_CLICK_PROBE === "1";

const writeProbeLine = async (probeFilePath: string, details: Omit<MouseClickProbeInput, "screenshotDir">): Promise<void> => {
  const line = JSON.stringify({
    loggedAt: new Date().toISOString(),
    stage: "browser-click",
    details,
  });

  await mkdir(path.dirname(probeFilePath), { recursive: true });
  await appendFile(probeFilePath, `${line}\n`, "utf8");
};

const emitCurrentChromeMouseClickProbe = async (input: MouseClickProbeInput): Promise<void> => {
  if (!isMouseClickProbeEnabled()) {
    return;
  }

  const probeFilePath = path.join(input.screenshotDir, "..", "mouse-click-probe.log");
  const { screenshotDir: _screenshotDir, ...details } = input;
  await writeProbeLine(probeFilePath, details);
};

export { emitCurrentChromeMouseClickProbe };