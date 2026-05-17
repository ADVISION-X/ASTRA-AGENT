import type { BrowserScrollCoordinateSpace } from "./browser-controller.js";
import type { ChromeWindowState } from "./current-chrome-window-control.js";

type CurrentChromeScrollInput = {
  targetLabel: string;
  deltaX: number;
  deltaY: number;
  coordinateSpace?: BrowserScrollCoordinateSpace;
  anchorPoint?: { x: number; y: number };
  abortSignal?: AbortSignal;
};

type CurrentChromeScrollPlan = {
  scrollX: number;
  scrollY: number;
};

const resolveScrollAnchorPoint = (input: CurrentChromeScrollInput, geometry: ChromeWindowState): { x: number; y: number } =>
  input.anchorPoint ?? {
    x: Math.round(geometry.width / 2),
    y: Math.round(geometry.height / 2),
  };

const resolveCurrentChromeScrollPlan = (
  input: CurrentChromeScrollInput,
  geometry: ChromeWindowState,
): CurrentChromeScrollPlan | null => {
  if (input.deltaX === 0 && input.deltaY === 0) {
    return null;
  }

  const coordinateSpace = input.coordinateSpace ?? "browserViewport";
  const anchorPoint = resolveScrollAnchorPoint(input, geometry);

  return {
    scrollX: coordinateSpace === "desktopScreen" ? anchorPoint.x : geometry.windowX + anchorPoint.x,
    scrollY: coordinateSpace === "desktopScreen" ? anchorPoint.y : geometry.windowY + anchorPoint.y,
  };
};

const createZeroScrollMessage = (targetLabel: string): string => `skipped zero scroll for ${targetLabel}`;

export { createZeroScrollMessage, resolveCurrentChromeScrollPlan };
