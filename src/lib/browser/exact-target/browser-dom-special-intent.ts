import type { BrowserDomIntent } from "./browser-dom-intent.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";

const assertRenameIntent = (
  intent: Extract<BrowserDomIntent, { kind: "renameExactGptConversation" }>,
): void => {
  const exactKeys = new Set(["kind", "canonicalConversationUrl", "targetTitle", "timeoutMs"]);
  let canonical = false;
  try {
    canonical = requireCanonicalGptConversationUrl(intent.canonicalConversationUrl)
      === intent.canonicalConversationUrl;
  } catch { canonical = false; }
  if (Object.keys(intent).length !== exactKeys.size
    || Object.keys(intent).some((key) => !exactKeys.has(key)) || !canonical
    || intent.targetTitle !== intent.targetTitle.normalize("NFC")
    || intent.targetTitle.trim() !== intent.targetTitle
    || [...intent.targetTitle].length < 1 || [...intent.targetTitle].length > 128
    || /[\u0000-\u001f\u007f]/u.test(intent.targetTitle) || intent.timeoutMs !== 10_000) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const exactHash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

export const assertSpecialBrowserDomIntent = (intent: BrowserDomIntent): void => {
  if (intent.kind === "selectExactGptConversation") try {
    requireCanonicalGptConversationUrl(intent.canonicalConversationUrl);
  } catch { throw new Error("BROWSER_COMMAND_PERMIT_INVALID"); }
  if (intent.kind === "renameExactGptConversation") assertRenameIntent(intent);
  if (intent.kind === "acknowledgeKnownGptRateLimit"
    && (Object.keys(intent).length !== 4 || !exactHash(intent.targetRefHash)
      || !exactHash(intent.documentRefHash)
      || (intent.dispatchNotAfter !== null
        && (!Number.isFinite(Date.parse(intent.dispatchNotAfter))
          || new Date(intent.dispatchNotAfter).toISOString() !== intent.dispatchNotAfter)))) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.kind === "readKnownGptRateLimitClearance"
    && (Object.keys(intent).length !== 3 || !exactHash(intent.targetRefHash)
      || !exactHash(intent.documentRefHash))) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

export const assertPreClickExactOutgoingTurn = (
  value: Extract<BrowserDomIntent, { kind: "click" }>["preClickExactOutgoingTurn"],
): void => {
  if (!value) return;
  if (Object.keys(value).sort().join("|")
    !== "attachmentSelector|composerFormSelector|composerSelector|expectedAttachmentLabels|expectedPromptHash|userTurnSelector"
    || !boundedText(value.composerSelector, 2_048)
    || !boundedText(value.composerFormSelector, 2_048)
    || !boundedText(value.attachmentSelector, 2_048)
    || !boundedText(value.userTurnSelector, 2_048)
    || !/^sha256:[a-f0-9]{64}$/u.test(value.expectedPromptHash)
    || !Array.isArray(value.expectedAttachmentLabels)
    || value.expectedAttachmentLabels.some((label) => !boundedText(label, 1_024))) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
