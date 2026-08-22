export type BrowserDomField = "tagName" | "type" | "role" | "ariaLabel" | "text" | "value" | "accept" | "multiple" | "connected" | "visible" | "disabled" | "bounds";

export type BrowserDomReadScope = Readonly<{
  selector: string;
  matchIndex: number;
}>;

export type BrowserSemanticLocator = Readonly<{
  role?: string;
  name?: string;
  testId?: string;
  label?: string;
}>;

export type BrowserDomIntent =
  | Readonly<{ kind: "document" }>
  | Readonly<{ kind: "inspect"; selector: string; fields: readonly BrowserDomField[] }>
  | Readonly<{
    kind: "find";
    /** A caller may use either a semantic locator or an owner-defined exact selector, never both. */
    locator?: BrowserSemanticLocator;
    selector?: string;
    textContains?: string;
    textEquals?: string;
    maxMatches: number;
  }>
  | Readonly<{ kind: "readText"; selector: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; scope?: BrowserDomReadScope }>
  | Readonly<{ kind: "readAttribute"; selector: string; name: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; textContains?: string; scope?: BrowserDomReadScope }>
  | Readonly<{
    kind: "click";
    selector: string;
    expectedText?: string;
    expectedTextEquals?: string;
    expectedMatches?: number;
    /** Same-node state that must be true immediately after the one click. */
    postClickAttribute?: Readonly<{ name: "aria-checked"; equals: "true" }>;
  }>
  | Readonly<{ kind: "fill"; selector: string; approvedText: string; clearBeforeType: boolean; expectedMatches?: number }>;

export const assertBrowserDomIntent = (intent: BrowserDomIntent): BrowserDomIntent => {
  assertSelector(intent);
  if (intent.kind === "find") assertFindIntent(intent);
  if (intent.kind === "readText" || intent.kind === "readAttribute") assertReadIntent(intent);
  if (intent.kind === "click" || intent.kind === "fill") assertOptionalExpectedMatches(intent.expectedMatches);
  if (intent.kind === "click") assertClickIntent(intent);
  return intent;
};

const assertClickIntent = (intent: Extract<BrowserDomIntent, { kind: "click" }>): void => {
  if (intent.expectedText !== undefined && !isBoundedText(intent.expectedText, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.expectedTextEquals !== undefined && !isBoundedText(intent.expectedTextEquals, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.expectedText !== undefined && intent.expectedTextEquals !== undefined) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.postClickAttribute
    && (intent.postClickAttribute.name !== "aria-checked" || intent.postClickAttribute.equals !== "true")) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertSelector = (intent: BrowserDomIntent): void => {
  if ("selector" in intent && intent.selector !== undefined && !isBoundedText(intent.selector, 2_048)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
};

const assertFindIntent = (intent: Extract<BrowserDomIntent, { kind: "find" }>): void => {
  if ((intent.selector === undefined) === (intent.locator === undefined)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.maxMatches < 1 || intent.maxMatches > 20) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.textContains !== undefined && !isBoundedText(intent.textContains, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.textEquals !== undefined && !isBoundedText(intent.textEquals, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.textContains !== undefined && intent.textEquals !== undefined) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertReadIntent = (intent: Extract<BrowserDomIntent, { kind: "readText" | "readAttribute" }>): void => {
  if (intent.maxChars < 1 || intent.maxChars > 65536) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertOptionalRange(intent.maxMatches, 1, 100);
  assertReadScope(intent.scope);
  assertOptionalExpectedMatches(intent.expectedMatches);
  assertOptionalRange(intent.matchIndex, 0, 99);
  if (intent.kind === "readAttribute" && intent.textContains !== undefined && !isBoundedText(intent.textContains, 1_024)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertReadScope = (scope: BrowserDomReadScope | undefined): void => {
  if (!scope) return;
  if (scope.selector.trim().length === 0 || !Number.isInteger(scope.matchIndex) || scope.matchIndex < 0 || scope.matchIndex > 99) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertOptionalExpectedMatches = (value: number | undefined): void => {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertOptionalRange = (value: number | undefined, minimum: number, maximum: number): void => {
  if (value !== undefined && (value < minimum || value > maximum)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const isBoundedText = (value: string, limit: number): boolean =>
  value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f]/u.test(value);
