import { runJxa } from "../../../lib/browser/current-chrome-window-control.js";
import {
  buildExactChromeAccessibilityWindowRaiseScript,
} from "../../../lib/browser/current-chrome-accessibility-window.js";

export type SingleProviderTabFocus =
  | "focused"
  | "not_found"
  | "ambiguous";

const providerOrigin = (
  providerKind: "gpt-web-chat" | "gemini-web-chat",
): string => providerKind === "gpt-web-chat"
  ? "https://chatgpt.com"
  : "https://gemini.google.com";

export const focusSingleProviderTab = async (input: {
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  signal?: AbortSignal;
}): Promise<SingleProviderTabFocus> => {
  const origin = providerOrigin(input.providerKind);
  const result = await runJxa(`
const chrome = Application("Google Chrome");
const origin = ${JSON.stringify(origin)};
const windows = chrome.windows();
const matches = [];
for (const [windowIndex, window] of windows.entries()) {
  for (const [tabIndex, tab] of window.tabs().entries()) {
    const url = String(tab.url() || "");
    if (url === origin || url.startsWith(origin + "/")) {
      matches.push({windowIndex, tabIndex});
    }
  }
}
if (matches.length === 0) "not_found";
else if (matches.length > 1) "ambiguous";
else {
  const target = matches[0];
  const chromeWindow = windows[target.windowIndex];
  chromeWindow.activeTabIndex = target.tabIndex + 1;
  const bounds = chromeWindow.bounds();
  ${buildExactChromeAccessibilityWindowRaiseScript({
    chromeWindowVariable: "chromeWindow",
    boundsVariable: "bounds",
    mismatchReason:
      "controlled provider tab does not have one exact accessibility window after bounded stabilization",
  })}
  const activeUrl = String(chromeWindow.activeTab().url() || "");
  activeUrl === origin || activeUrl.startsWith(origin + "/")
    ? "focused"
    : "not_found";
}
`, input.signal ? { signal: input.signal } : undefined);
  if (result === "focused" || result === "not_found" || result === "ambiguous") {
    return result;
  }
  throw new Error(`review_required: unexpected provider tab focus result; result=${result}`);
};
