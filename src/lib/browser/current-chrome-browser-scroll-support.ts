import type { BrowserScrollCoordinateSpace } from "./browser-controller.js";
import { pressBrowserKey } from "./current-chrome-browser-controller-primitives.js";
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
  requiresArrowDownAssist: boolean;
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
    requiresArrowDownAssist: (input.targetLabel.includes("scroll_next_video") || input.targetLabel.includes("scroll_viewport_to_next_item")) && input.deltaY > 0,
  };
};

const createZeroScrollMessage = (targetLabel: string): string => `skipped zero scroll for ${targetLabel}`;

const formatArrowDownAssistFailure = (error: unknown): string =>
  `; ArrowDown assist skipped: ${error instanceof Error ? error.message : "unknown key dispatch error"}`;

const runOptionalArrowDownAssist = async (input: {
  required: boolean;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  if (!input.required) {
    return "";
  }

  try {
    await pressBrowserKey(125, input.abortSignal);
    return " with ArrowDown assist";
  } catch (error) {
    return formatArrowDownAssistFailure(error);
  }
};

export { createZeroScrollMessage, resolveCurrentChromeScrollPlan, runOptionalArrowDownAssist };