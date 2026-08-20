import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";

const textAt = async (browser: BrowserTargetLease): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector: CHATGPT_COMPOSER_SELECTOR,
    expectedMatches: 1,
    maxChars: 65_536,
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.trim();
};

const insertPromptInActiveProviderTab = async (
  browser: BrowserTargetLease,
  prompt: string,
  replace: boolean,
  abortSignal?: AbortSignal,
): Promise<void> => {
  if (abortSignal?.aborted) throw new Error("BROWSER_TARGET_INVALID");
  const document = await browser.executeDomIntent({ kind: "document" });
  if (typeof document !== "object" || document === null || Array.isArray(document)
    || typeof (document as { url?: unknown }).url !== "string"
    || !(document as { url: string }).url.startsWith("https://chatgpt.com/")) {
    throw new Error("CHROME_PROVIDER_HOST_MISMATCH: expected chatgpt.com");
  }
  if (!replace && (await textAt(browser)).length > 0) {
    throw new Error("CHROME_COMPOSER_INSERT_FAILED: already_filled");
  }
  await browser.executeDomIntent({
    kind: "fill",
    selector: CHATGPT_COMPOSER_SELECTOR,
    approvedText: prompt,
    clearBeforeType: replace,
    expectedMatches: 1,
  });
};

export const pasteTextAndSubmitInChrome = async (
  browser: BrowserTargetLease,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<void> => insertPromptInActiveProviderTab(browser, prompt, false, abortSignal);

export const pasteTextReplacingInChrome = async (
  browser: BrowserTargetLease,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<void> => insertPromptInActiveProviderTab(browser, prompt, true, abortSignal);
