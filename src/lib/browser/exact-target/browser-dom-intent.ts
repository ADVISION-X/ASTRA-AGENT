export type BrowserDomField = "id" | "testId" | "dataTurn" | "tagName" | "type" | "role" | "ariaLabel" | "ariaExpanded" | "ariaChecked" | "text" | "value" | "accept" | "multiple" | "connected" | "visible" | "disabled" | "bounds";

export type BrowserDomReadScope = Readonly<{
  selector: string;
}>;

export type BrowserSemanticLocator = Readonly<{
  role?: string;
  name?: string;
  testId?: string;
  label?: string;
}>;

export type BrowserDomIntent =
  | Readonly<{ kind: "document" }>
  | Readonly<{ kind: "inspect"; selector: string; fields: readonly BrowserDomField[]; scope?: BrowserDomReadScope }>
  | Readonly<{
    kind: "find";
    /** A caller may use either a semantic locator or an owner-defined exact selector, never both. */
    locator?: BrowserSemanticLocator;
    selector?: string;
    textContains?: string;
    textEquals?: string;
    maxMatches: number;
    /** Optional bounded readiness condition evaluated inside this one observation command. */
    waitFor?: Readonly<{ minimumMatches: number; timeoutMs: number }>;
    /** Optional bounded fields returned for every visible match in the same DOM snapshot. */
    fields?: readonly BrowserDomField[];
    scope?: BrowserDomReadScope;
  }>
  | Readonly<{ kind: "readText"; selector: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; scope?: BrowserDomReadScope }>
  | Readonly<{ kind: "readAttribute"; selector: string; name: string; maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; textContains?: string; scope?: BrowserDomReadScope }>
  | Readonly<{
    kind: "click";
    selector: string;
    expectedText?: string;
    expectedTextEquals?: string;
    expectedMatches?: number;
    scope?: BrowserDomReadScope;
    /** Same-node state that must be true immediately after the one click. */
    postClickAttribute?: Readonly<{
      name: "aria-checked" | "aria-expanded";
      equals: "true";
      timeoutMs?: number;
    }>;
    postClickMatch?: Readonly<{
      selector: string;
      expectedMatches: number;
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{
    kind: "hover";
    selector: string;
    expectedText?: string;
    expectedTextEquals?: string;
    expectedMatches?: number;
    scope?: BrowserDomReadScope;
    /** Same-node state that must be true immediately after the one pointer hover. */
    postHoverAttribute: Readonly<{
      name: "aria-expanded";
      equals: "true";
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{
    kind: "doubleClick";
    selector: string;
    expectedMatches?: number;
    scope?: BrowserDomReadScope;
    postDoubleClickMatch: Readonly<{
      selector: string;
      expectedMatches: number;
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{
    kind: "keypress";
    selector: string;
    key: "Enter";
    expectedMatches?: number;
    scope?: BrowserDomReadScope;
    postKeypressMatch: Readonly<{
      selector: string;
      expectedMatches: number;
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{ kind: "fill"; selector: string; approvedText: string; clearBeforeType: boolean; expectedMatches?: number; scope?: BrowserDomReadScope }>;

export const assertBrowserDomIntent = (intent: BrowserDomIntent): BrowserDomIntent => {
  assertSelector(intent);
  if (intent.kind === "find") assertFindIntent(intent);
  if (intent.kind === "readText" || intent.kind === "readAttribute") assertReadIntent(intent);
  if (intent.kind === "click" || intent.kind === "hover" || intent.kind === "doubleClick"
    || intent.kind === "keypress" || intent.kind === "fill") assertOptionalExpectedMatches(intent.expectedMatches);
  if ("scope" in intent) assertReadScope(intent.scope);
  if (intent.kind === "click") assertClickIntent(intent);
  if (intent.kind === "hover") assertHoverIntent(intent);
  if (intent.kind === "doubleClick") assertBoundedPostMatch(intent.postDoubleClickMatch);
  if (intent.kind === "keypress") {
    if (intent.key !== "Enter") throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    assertBoundedPostMatch(intent.postKeypressMatch);
  }
  return intent;
};

const assertBoundedPostMatch = (match: Readonly<{
  selector: string;
  expectedMatches: number;
  timeoutMs?: number;
}>): void => {
  if (!isBoundedText(match.selector, 2_048)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertOptionalRange(match.expectedMatches, 1, 20);
  if (match.timeoutMs !== undefined
    && (!Number.isInteger(match.timeoutMs) || match.timeoutMs < 1 || match.timeoutMs > 5_000)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertTargetText = (intent: Readonly<{
  expectedText?: string;
  expectedTextEquals?: string;
}>): void => {
  if (intent.expectedText !== undefined && !isBoundedText(intent.expectedText, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.expectedTextEquals !== undefined && !isBoundedText(intent.expectedTextEquals, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.expectedText !== undefined && intent.expectedTextEquals !== undefined) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertClickIntent = (intent: Extract<BrowserDomIntent, { kind: "click" }>): void => {
  assertTargetText(intent);
  if (intent.postClickAttribute !== undefined && intent.postClickMatch !== undefined) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.postClickAttribute
    && (!(["aria-checked", "aria-expanded"] as const).includes(intent.postClickAttribute.name)
      || intent.postClickAttribute.equals !== "true"
      || (intent.postClickAttribute.timeoutMs !== undefined
        && (!Number.isInteger(intent.postClickAttribute.timeoutMs)
          || intent.postClickAttribute.timeoutMs < 1
          || intent.postClickAttribute.timeoutMs > 5_000)))) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.postClickMatch !== undefined) {
    if (!isBoundedText(intent.postClickMatch.selector, 2_048)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    assertOptionalRange(intent.postClickMatch.expectedMatches, 1, 20);
    if (intent.postClickMatch.timeoutMs !== undefined
      && (!Number.isInteger(intent.postClickMatch.timeoutMs)
        || intent.postClickMatch.timeoutMs < 1
        || intent.postClickMatch.timeoutMs > 5_000)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
};

const assertHoverIntent = (intent: Extract<BrowserDomIntent, { kind: "hover" }>): void => {
  assertTargetText(intent);
  if (!intent.postHoverAttribute
    || intent.postHoverAttribute.name !== "aria-expanded"
    || intent.postHoverAttribute.equals !== "true"
    || (intent.postHoverAttribute.timeoutMs !== undefined
      && (!Number.isInteger(intent.postHoverAttribute.timeoutMs)
        || intent.postHoverAttribute.timeoutMs < 1
        || intent.postHoverAttribute.timeoutMs > 5_000))) {
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
  if (intent.waitFor !== undefined) {
    if (!Number.isInteger(intent.waitFor.minimumMatches)
      || intent.waitFor.minimumMatches < 1
      || intent.waitFor.minimumMatches > intent.maxMatches
      || !Number.isInteger(intent.waitFor.timeoutMs)
      || intent.waitFor.timeoutMs < 1
      || intent.waitFor.timeoutMs > 30_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
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
  if (!isBoundedText(scope.selector, 2_048)) {
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
