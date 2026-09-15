import type { BrowserDomIntent, BrowserDomReadScope } from "./browser-dom-intent.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";

export const isBoundedText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit
  && !/[\u0000-\u001f]/u.test(value);

export const assertOptionalRange = (value: number | undefined, minimum: number, maximum: number): void => {
  if (value !== undefined && (value < minimum || value > maximum)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

export const assertReadScope = (scope: BrowserDomReadScope | undefined): void => {
  if (!scope) return;
  if (!isBoundedText(scope.selector, 2_048)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

export const exactAssistantReadIntentValid = (
  intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
): boolean => {
  let canonical = false;
  try {
    canonical = requireCanonicalGptConversationUrl(intent.canonicalConversationUrl)
      === intent.canonicalConversationUrl;
  } catch { canonical = false; }
  return /^conversation-turn-[1-9][0-9]*$/u.test(intent.userTurnId)
    && canonical;
};

export const assertSelector = (intent: BrowserDomIntent): void => {
  if ("selector" in intent && intent.selector !== undefined && !isBoundedText(intent.selector, 2_048)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
};

const findTextValid = (intent: Extract<BrowserDomIntent, { kind: "find" }>): boolean =>
  (intent.textContains === undefined || isBoundedText(intent.textContains, 1_024))
  && (intent.textEquals === undefined || isBoundedText(intent.textEquals, 1_024))
  && !(intent.textContains !== undefined && intent.textEquals !== undefined);

const findWaitValid = (intent: Extract<BrowserDomIntent, { kind: "find" }>): boolean => {
  if (intent.waitFor === undefined) return true;
  return Number.isInteger(intent.waitFor.minimumMatches)
    && intent.waitFor.minimumMatches >= 1 && intent.waitFor.minimumMatches <= intent.maxMatches
    && Number.isInteger(intent.waitFor.timeoutMs)
    && intent.waitFor.timeoutMs >= 1_500 && intent.waitFor.timeoutMs <= 30_000;
};

export const assertFindIntent = (intent: Extract<BrowserDomIntent, { kind: "find" }>): void => {
  if ((intent.selector === undefined) === (intent.locator === undefined)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.maxMatches < 1 || intent.maxMatches > 20) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (!findTextValid(intent) || !findWaitValid(intent)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertOptionalExpectedMatches = (value: number | undefined): void => {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

export const assertReadIntent = (
  intent: Extract<BrowserDomIntent, { kind: "readText" | "readAttribute" }>,
): void => {
  if (!Number.isSafeInteger(intent.maxChars) || intent.maxChars < 1) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertOptionalRange(intent.maxMatches, 1, 100);
  assertReadScope(intent.scope);
  assertOptionalExpectedMatches(intent.expectedMatches);
  assertOptionalRange(intent.matchIndex, 0, 99);
  if (intent.kind === "readAttribute" && intent.textContains !== undefined
    && !isBoundedText(intent.textContains, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};
