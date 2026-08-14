import { existsSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export const retiredBrowserPaths = [
  "src/lib/browser/current-chrome-browser-field-input.ts",
  "src/lib/browser/current-chrome-cdp-file-input.ts",
  "src/lib/browser/current-chrome-browser-click-probe.ts",
  "src/lib/browser/current-chrome-browser-controller-primitives.ts",
  "src/lib/browser/current-chrome-browser-screenshot.ts",
  "src/lib/browser/current-chrome-browser-scroll-support.ts",
  "src/lib/browser/current-chrome-native-file-input.ts",
  "src/lib/browser/current-chrome-window-control.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-fork-tab-control.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts"
] as const;

export const inspectRetiredBrowserPaths = (lawId: string): InspectorFinding[] =>
  retiredBrowserPaths.flatMap((filePath) => existsSync(resolveFromRepo(filePath))
    ? [createFinding({
        checkId: "local-browser-session/owner-assertion-set",
        lawId,
        clauseId: "apex-local-browser-001-requirement",
        filePath,
        message: `${filePath} is a retired foreground/active-tab path and must be physically absent.`,
      })]
    : []);
