import type {
  BrowserScrollCoordinateSpace,
  BrowserTextInputKey,
} from "./browser-controller.js";
import {
  runJxa as runCurrentChromeJxa,
  runAppleScript as runCurrentChromeAppleScript,
} from "./current-chrome-window-control.js";

const runAppleScript = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runCurrentChromeAppleScript(script, options);
const runJxa = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runCurrentChromeJxa(script, options);
const activateChrome = async (abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript('tell application "Google Chrome" to activate', abortSignal ? { signal: abortSignal } : undefined);
};
const escapeAppleScriptText = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
const toQuartzWheelDelta = (value: number): number => -Math.round(value);

const BROWSER_TEXT_INPUT_KEY_CODES: Record<BrowserTextInputKey, number> = {
  Enter: 36,
  Tab: 48,
  Escape: 53,
  Backspace: 51,
  Delete: 117,
  L: 37,
  ArrowUp: 126,
  ArrowDown: 125,
  ArrowLeft: 123,
  ArrowRight: 124,
};

const clickAt = async (x: number, y: number, button: "left" | "right" | "middle", clickCount: 1 | 2): Promise<void> => {
  const buttonCode = button === "right"
    ? "$.kCGMouseButtonRight"
    : button === "middle"
      ? "$.kCGMouseButtonCenter"
      : "$.kCGMouseButtonLeft";
  const downType = button === "right"
    ? "$.kCGEventRightMouseDown"
    : button === "middle"
      ? "$.kCGEventOtherMouseDown"
      : "$.kCGEventLeftMouseDown";
  const upType = button === "right"
    ? "$.kCGEventRightMouseUp"
    : button === "middle"
      ? "$.kCGEventOtherMouseUp"
      : "$.kCGEventLeftMouseUp";
  const buttonField = button === "middle"
    ? "$.CGEventSetIntegerValueField(event, $.kCGMouseEventButtonNumber, 2);"
    : "";
  await runJxa(`
ObjC.import('ApplicationServices');
function post(type, x, y) {
  const point = $.CGPointMake(x, y);
  const event = $.CGEventCreateMouseEvent(null, type, point, ${buttonCode});
  ${buttonField}
  $.CGEventPost($.kCGHIDEventTap, event);
}
post($.kCGEventMouseMoved, ${x}, ${y});
for (let count = 0; count < ${clickCount}; count += 1) {
  delay(0.02);
  post(${downType}, ${x}, ${y});
  delay(0.02);
  post(${upType}, ${x}, ${y});
}
`);
};

const moveAt = async (x: number, y: number): Promise<void> => {
  await runJxa(`
ObjC.import('ApplicationServices');
const point = $.CGPointMake(${x}, ${y});
const event = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, event);
`);
};

const pressBrowserKey = async (keyCode: number, abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    key code ${keyCode}
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const keystrokeBrowserText = async (text: string, abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    keystroke "${escapeAppleScriptText(text)}"
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const selectAllBrowserText = async (abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    keystroke "a" using command down
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const pressNamedBrowserKey = async (key: BrowserTextInputKey, abortSignal?: AbortSignal): Promise<void> => {
  await pressBrowserKey(BROWSER_TEXT_INPUT_KEY_CODES[key], abortSignal);
};

const scrollAt = async (input: {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  abortSignal?: AbortSignal;
  _coordinateSpace?: BrowserScrollCoordinateSpace;
}): Promise<void> => {
  const quartzWheelDeltaY = toQuartzWheelDelta(input.deltaY);
  const quartzWheelDeltaX = toQuartzWheelDelta(input.deltaX);
  await runJxa(`
ObjC.import('ApplicationServices');
const point = $.CGPointMake(${input.x}, ${input.y});
const moveEvent = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, moveEvent);
delay(0.02);
const scrollEvent = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitPixel, 2, ${quartzWheelDeltaY}, ${quartzWheelDeltaX});
$.CGEventPost($.kCGHIDEventTap, scrollEvent);
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
};

export { activateChrome, escapeAppleScriptText, clickAt, moveAt, keystrokeBrowserText, selectAllBrowserText, pressNamedBrowserKey, scrollAt };
