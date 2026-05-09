import { createId } from "../local-runtime/ids.js";

import type { BrowserActionResult } from "./browser-controller.js";
import { createBrowserActionResult } from "./current-chrome-browser-session-state.js";

const createCurrentChromeBrowserActionResult = (input: {
  message: string;
  ok?: boolean;
  fallbackUsed?: boolean;
}): BrowserActionResult =>
  createBrowserActionResult({
    actionId: createId("browser"),
    message: input.message,
    ...(input.ok === undefined ? {} : { ok: input.ok }),
    ...(input.fallbackUsed === undefined ? {} : { fallbackUsed: input.fallbackUsed }),
  });

export { createCurrentChromeBrowserActionResult };