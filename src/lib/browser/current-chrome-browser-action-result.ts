import { createId } from "../local-runtime/ids.js";

import type { BrowserActionResult } from "./browser-controller.js";
import { createBrowserActionResult } from "./current-chrome-browser-session-state.js";

const createCurrentChromeBrowserActionResult = (input: {
  message: string;
  ok?: boolean;
}): BrowserActionResult =>
  createBrowserActionResult({
    actionId: createId("browser"),
    message: input.message,
    ...(input.ok === undefined ? {} : { ok: input.ok }),
  });

export { createCurrentChromeBrowserActionResult };
