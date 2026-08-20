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
    maxMatches: number;
  }>
  | Readonly<{ kind: "readText"; selector: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; scope?: BrowserDomReadScope }>
  | Readonly<{ kind: "readAttribute"; selector: string; name: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; textContains?: string; scope?: BrowserDomReadScope }>
  | Readonly<{ kind: "click"; selector: string; expectedText?: string; expectedMatches?: number }>
  | Readonly<{ kind: "fill"; selector: string; approvedText: string; clearBeforeType: boolean; expectedMatches?: number }>;

export const assertBrowserDomIntent = (intent: BrowserDomIntent): BrowserDomIntent => {
  if ("selector" in intent && intent.selector !== undefined && !isBoundedText(intent.selector, 2_048)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  if (intent.kind === "find") {
    if ((intent.selector === undefined) === (intent.locator === undefined)
      || intent.maxMatches < 1
      || intent.maxMatches > 20
      || (intent.textContains !== undefined && !isBoundedText(intent.textContains, 1_024))) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
  if (intent.kind === "readText" || intent.kind === "readAttribute") {
    if (intent.maxChars < 1 || intent.maxChars > 65536) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    if (intent.maxMatches !== undefined && (intent.maxMatches < 1 || intent.maxMatches > 100)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (intent.scope && (intent.scope.selector.trim().length === 0 || !Number.isInteger(intent.scope.matchIndex)
      || intent.scope.matchIndex < 0 || intent.scope.matchIndex > 99)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (intent.expectedMatches !== undefined
      && (!Number.isInteger(intent.expectedMatches) || intent.expectedMatches < 1 || intent.expectedMatches > 20)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (intent.matchIndex !== undefined
      && (!Number.isInteger(intent.matchIndex) || intent.matchIndex < 0 || intent.matchIndex > 99)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (intent.kind === "readAttribute" && intent.textContains !== undefined && !isBoundedText(intent.textContains, 1_024)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
  if ((intent.kind === "click" || intent.kind === "fill")
    && intent.expectedMatches !== undefined
    && (!Number.isInteger(intent.expectedMatches) || intent.expectedMatches < 1 || intent.expectedMatches > 20)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  return intent;
};

const isBoundedText = (value: string, limit: number): boolean =>
  value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f]/u.test(value);
