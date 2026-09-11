import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";

export const readCurrentGptDocumentUrl = async (
  browser: Pick<BrowserTargetLease, "executeDomIntent">,
): Promise<string> => {
  const raw = await browser.executeDomIntent({ kind: "document" });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw executionFailure("failed", "GPT_DOCUMENT_RESULT_INVALID");
  }
  const value = raw as Readonly<Record<string, unknown>>;
  if (Object.keys(value).sort().join("|") !== "title|url" || typeof value.url !== "string") {
    throw executionFailure("failed", "GPT_DOCUMENT_RESULT_INVALID");
  }
  try {
    const url = new URL(value.url);
    const parts = url.pathname.split("/");
    if (url.protocol !== "https:" || url.origin !== "https://chatgpt.com" || url.username || url.password
      || !(url.pathname === "/" || (parts.length === 3 && parts[1] === "c"
        && parts[2]!.length > 0 && parts[2]!.length <= 256))) throw new Error();
    return `${url.origin}${url.pathname}`;
  } catch {
    throw executionFailure("failed", "GPT_DOCUMENT_RESULT_INVALID");
  }
};
