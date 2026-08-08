import { runJxa } from "../../../lib/browser/current-chrome-window-control.js";

export const collapseForkToSingleProviderTab = async (
  parentUrl: string,
): Promise<void> => {
  const deadline = Date.now() + 5_000;
  let last = "pending";
  while (Date.now() < deadline) {
    last = await runJxa(`
const chrome = Application("Google Chrome");
const parentUrl = ${JSON.stringify(parentUrl)};
const matches = [];
for (const [windowIndex, window] of chrome.windows().entries()) {
  for (const [tabIndex, tab] of window.tabs().entries()) {
    const url = String(tab.url() || "");
    if (url === "https://chatgpt.com" || url.startsWith("https://chatgpt.com/")) {
      matches.push({windowIndex, tabIndex, window, tab, url});
    }
  }
}
const children = matches.filter((candidate) => candidate.url !== parentUrl);
if (matches.length === 1 && children.length === 1) {
  const child = children[0];
  child.window.activeTabIndex = child.tabIndex + 1;
  "single_child";
} else if (matches.length === 2 && children.length === 1
  && matches.some((candidate) => candidate.url === parentUrl)) {
  const child = children[0];
  const parent = matches.find((candidate) => candidate.url === parentUrl);
  child.window.activeTabIndex = child.tabIndex + 1;
  parent.tab.close();
  "closing_parent";
} else if (matches.length === 1 && children.length === 0) {
  "pending";
} else {
  "ambiguous:" + JSON.stringify(matches.map((candidate) => candidate.url));
}
`);
    if (last === "single_child") return;
    if (last.startsWith("ambiguous:")) {
      throw new Error(`review_required: CHATGPT_FORK_PROVIDER_TAB_AMBIGUOUS:${last}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`recovery_pending: CHATGPT_FORK_CHILD_TAB_NOT_CREATED:${last}`);
};
