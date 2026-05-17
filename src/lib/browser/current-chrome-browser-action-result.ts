import { createId } from "../local-runtime/ids.js";

import type { BrowserActionResult } from "./browser-controller.js";

function createBrowserActionResult(input: {
  actionId: string;
  message: string;
  ok?: boolean;
}): BrowserActionResult {
  return {
    browserActionId: input.actionId,
    ok: input.ok ?? true,
    message: input.message,
    createdAt: new Date().toISOString(),
  };
}

const createCurrentChromeBrowserActionResult = (input: {
  message: string;
  ok?: boolean;
}): BrowserActionResult =>
  createBrowserActionResult({
    actionId: createId("browser"),
    message: input.message,
    ...(input.ok === undefined ? {} : { ok: input.ok }),
  });

export { createBrowserActionResult, createCurrentChromeBrowserActionResult };
