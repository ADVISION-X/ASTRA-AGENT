import { runJxa } from "../../../lib/browser/current-chrome-window-control.js";

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
  const window = windows[target.windowIndex];
  window.activeTabIndex = target.tabIndex + 1;
  window.index = 1;
  const bounds = window.bounds();
  const systemEvents = Application("System Events");
  const processes = systemEvents.applicationProcesses.whose({name: {_equals: "Google Chrome"}})();
  if (processes.length === 0) throw new Error("Google Chrome accessibility process is unavailable");
  const process = processes[0];
  const matchingWindows = process.windows().filter((candidate) => {
    const position = candidate.position();
    const size = candidate.size();
    return position[0] === bounds.x
      && position[1] === bounds.y
      && size[0] === bounds.width
      && size[1] === bounds.height;
  });
  if (matchingWindows.length !== 1) {
    throw new Error("controlled provider tab does not have one exact accessibility window");
  }
  process.frontmost = true;
  matchingWindows[0].actions.byName("AXRaise").perform();
  delay(0.05);
  const activeUrl = String(chrome.windows()[0].activeTab().url() || "");
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
