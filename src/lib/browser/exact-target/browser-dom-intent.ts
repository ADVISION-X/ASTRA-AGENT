const BROWSER_DOM_FIELD_VALUES = [
  "id", "testId", "dataTurn", "tagName", "type", "role", "name", "label",
  "ariaLabel", "ariaExpanded", "ariaChecked", "ariaValueMin", "ariaValueMax", "ariaValueNow",
  "text", "outerHtml", "semanticText", "semanticTextHash", "exactEditableTextHash",
  "exactGptUserPromptHash",
  "value", "checked", "accept", "multiple", "connected", "layout", "visible",
  "computedDisplay", "computedVisibility", "computedOpacity", "effectiveOpacity", "hidden", "ariaHidden",
  "inert", "disabled", "ariaDisabled",
] as const;

export type BrowserDomField = typeof BROWSER_DOM_FIELD_VALUES[number];
export type BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">;
export type BrowserDomPostconditionField = Exclude<BrowserDomObservationField,
  "semanticTextHash" | "exactEditableTextHash" | "exactGptUserPromptHash">;
export type BrowserDomReadEligibility = "non-actionable-aria-state";

export type BrowserDomIneligibleReason =
  | "DISCONNECTED"
  | "NO_LAYOUT_BOX"
  | "DISPLAY_HIDDEN"
  | "VISIBILITY_HIDDEN"
  | "OPACITY_HIDDEN"
  | "HTML_HIDDEN"
  | "ARIA_HIDDEN"
  | "INERT"
  | "TEXT_MISMATCH";

export type BrowserDomIneligibleCandidate = Readonly<{
  index: number;
  reasons: readonly BrowserDomIneligibleReason[];
}>;

export type BrowserDomObservationQuery = Readonly<{
  queryId: string;
  selector: string;
  maxMatches: number;
  fields: readonly BrowserDomObservationField[];
  readEligibility?: BrowserDomReadEligibility;
  scope?: BrowserDomReadScope;
  textContains?: string;
  textEquals?: string;
}>;

export type BrowserDomPostconditionQuery = Omit<BrowserDomObservationQuery, "fields"> & Readonly<{
  fields: readonly BrowserDomPostconditionField[];
  expectedEligibleCount: number;
}>;

export type BrowserDomObservationPacketV2 = Readonly<{
  schemaVersion: "grasseye.browser.dom-observation.v2";
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  currentUrl: string;
  observationRevisionHash: `sha256:${string}`;
  observedAt: string;
  queries: readonly Readonly<{
    queryId: string;
    scopeRawCount: number;
    scopeEligibleCount: number;
    rawCount: number;
    eligibleCount: number;
    matches: readonly (Readonly<Record<string, unknown>> & Readonly<{
      candidateIndex: number;
      observationIdentityHash: `sha256:${string}`;
    }>)[];
    scopeRejections: readonly BrowserDomIneligibleCandidate[];
    rejections: readonly BrowserDomIneligibleCandidate[];
    nativeCauseCode: "NO_LAYOUT_BOX" | null;
    nativeCauseCount: number;
    nativeStage: "runtime-call-function-on";
  }>[];
}>;

export type BrowserExactAssistantTurnReplyV1 = Readonly<{
  schemaVersion: "grasseye.browser.exact-assistant-turn.v1";
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  assistantTurnId: string;
  rawDomHtml: string;
  rawDomHash: `sha256:${string}`;
  semanticText: string;
  semanticTextHash: `sha256:${string}`;
  observedAt: string;
}>;

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
  | Readonly<{ kind: "observe"; queries: readonly BrowserDomObservationQuery[] }>
  | Readonly<{ kind: "readExactAssistantTurn"; assistantTurnId: string }>
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
  | Readonly<{ kind: "readText"; selector: string; /** Caller capacity hint; Browser never truncates. */ maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; scope?: BrowserDomReadScope }>
  | Readonly<{ kind: "readAttribute"; selector: string; name: string; /** Caller capacity hint; Browser never truncates. */ maxChars: number; maxMatches?: number; expectedMatches?: number; matchIndex?: number; textContains?: string; scope?: BrowserDomReadScope }>
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
      readEligibility?: BrowserDomReadEligibility;
      textContains?: string;
      textEquals?: string;
      timeoutMs?: number;
    }>;
    /** One coherent mechanical query-set returned by this same click command. */
    postClickObservation?: Readonly<{
      queries: readonly BrowserDomPostconditionQuery[];
      timeoutMs?: number;
    }>;
    postClickUrl?: Readonly<{
      equals?: string;
      notEquals?: string;
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
      readEligibility?: BrowserDomReadEligibility;
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{
    kind: "keypress";
    selector: string;
    key: "Enter" | "ArrowLeft" | "ArrowRight";
    repeat?: 1 | 2 | 3 | 4;
    expectedMatches?: number;
    scope?: BrowserDomReadScope;
    postKeypressMatch: Readonly<{
      selector: string;
      expectedMatches: number;
      readEligibility?: BrowserDomReadEligibility;
      timeoutMs?: number;
    }>;
  }>
  | Readonly<{ kind: "fill"; selector: string; approvedText: string; clearBeforeType: boolean; expectedMatches?: number; scope?: BrowserDomReadScope }>;

export const assertBrowserDomIntent = (intent: BrowserDomIntent): BrowserDomIntent => {
  assertSelector(intent);
  assertObservationIntent(intent);
  assertMutationIntent(intent);
  assertScopedIntent(intent);
  return intent;
};

const assertObservationIntent = (intent: BrowserDomIntent): void => {
  if (intent.kind === "observe") assertObserveIntent(intent);
  if (intent.kind === "readExactAssistantTurn"
    && !/^conversation-turn-[1-9][0-9]*$/u.test(intent.assistantTurnId)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.kind === "inspect") assertDomFields(intent.fields);
  if (intent.kind === "find") {
    assertFindIntent(intent);
    if (intent.fields) assertDomFields(intent.fields);
  }
  if (intent.kind === "readText" || intent.kind === "readAttribute") assertReadIntent(intent);
};

const OBSERVATION_QUERY_KEYS = new Set([
  "queryId", "selector", "maxMatches", "fields", "readEligibility", "scope", "textContains", "textEquals",
]);
const POSTCONDITION_QUERY_KEYS = new Set([...OBSERVATION_QUERY_KEYS, "expectedEligibleCount"]);

const assertReadEligibility = (value: BrowserDomReadEligibility | undefined): void => {
  if (value !== undefined && value !== "non-actionable-aria-state") {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertObservationQueries = (
  queries: readonly BrowserDomObservationQuery[],
  allowedKeys: ReadonlySet<string>,
): void => {
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 20) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  const queryIds = new Set<string>();
  let observationCells = 0;
  for (const query of queries) {
    if (!query || typeof query !== "object" || Array.isArray(query)
      || Object.keys(query).some((key) => !allowedKeys.has(key))
      || !isBoundedText(query.queryId, 128) || queryIds.has(query.queryId)
      || !isBoundedText(query.selector, 2_048)
      || !Number.isInteger(query.maxMatches) || query.maxMatches < 1 || query.maxMatches > 20) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    queryIds.add(query.queryId);
    assertReadEligibility(query.readEligibility);
    assertReadScope(query.scope);
    assertObservationText(query);
    assertObservationFields(query.fields);
    observationCells += (query.maxMatches + 1) * query.fields.length;
  }
  if (observationCells > 256) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertObserveIntent = (intent: Extract<BrowserDomIntent, { kind: "observe" }>): void =>
  assertObservationQueries(intent.queries, OBSERVATION_QUERY_KEYS);

const assertObservationText = (query: BrowserDomObservationQuery): void => {
  if ((query.textContains !== undefined && !isBoundedText(query.textContains, 1_024))
    || (query.textEquals !== undefined && !isBoundedText(query.textEquals, 1_024))
    || (query.textContains !== undefined && query.textEquals !== undefined)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertObservationFields = (fields: readonly BrowserDomObservationField[]): void => {
  assertDomFields(fields);
  if (fields.includes("outerHtml" as BrowserDomObservationField)
    || fields.includes("semanticText" as BrowserDomObservationField)
    || fields.includes("text" as BrowserDomObservationField)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertDomFields = (fields: readonly BrowserDomField[]): void => {
  const allowed = new Set<string>(BROWSER_DOM_FIELD_VALUES);
  if (!Array.isArray(fields) || fields.length > BROWSER_DOM_FIELD_VALUES.length || new Set(fields).size !== fields.length
    || fields.some((field) => !allowed.has(field))) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertMutationIntent = (intent: BrowserDomIntent): void => {
  if (intent.kind === "click" || intent.kind === "hover" || intent.kind === "doubleClick"
    || intent.kind === "keypress" || intent.kind === "fill") {
    if (intent.expectedMatches !== undefined && intent.expectedMatches !== 1) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
  if (intent.kind === "click") assertClickIntent(intent);
  if (intent.kind === "hover") assertHoverIntent(intent);
  if (intent.kind === "doubleClick") assertBoundedPostMatch(intent.postDoubleClickMatch);
  if (intent.kind === "keypress") assertKeypressIntent(intent);
};

const assertScopedIntent = (intent: BrowserDomIntent): void => {
  if ("scope" in intent) assertReadScope(intent.scope);
};

const assertKeypressIntent = (intent: Extract<BrowserDomIntent, { kind: "keypress" }>): void => {
  if (!(intent.key === "Enter" || intent.key === "ArrowLeft" || intent.key === "ArrowRight")) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.repeat !== undefined
    && (!Number.isInteger(intent.repeat) || intent.repeat < 1 || intent.repeat > 4)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  assertBoundedPostMatch(intent.postKeypressMatch);
};

const assertBoundedPostMatch = (match: Readonly<{
  selector: string;
  expectedMatches: number;
  readEligibility?: BrowserDomReadEligibility;
  timeoutMs?: number;
}>): void => {
  if (!isBoundedText(match.selector, 2_048)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertReadEligibility(match.readEligibility);
  assertOptionalRange(match.expectedMatches, 0, 20);
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

const timeoutInvalid = (value: number | undefined): boolean => value !== undefined
  && (!Number.isInteger(value) || value < 1 || value > 5_000);

const assertClickAttribute = (
  attribute: Extract<BrowserDomIntent, { kind: "click" }>["postClickAttribute"],
): void => {
  if (!attribute) return;
  if (!(attribute.name === "aria-checked" || attribute.name === "aria-expanded")
    || attribute.equals !== "true" || timeoutInvalid(attribute.timeoutMs)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertClickMatch = (
  match: Extract<BrowserDomIntent, { kind: "click" }>["postClickMatch"],
): void => {
  if (!match) return;
  if (!isBoundedText(match.selector, 2_048)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  assertReadEligibility(match.readEligibility);
  assertOptionalRange(match.expectedMatches, 0, 20);
  if (match.textContains !== undefined && !isBoundedText(match.textContains, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (match.textEquals !== undefined && !isBoundedText(match.textEquals, 1_024)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (match.textContains !== undefined && match.textEquals !== undefined) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (timeoutInvalid(match.timeoutMs)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertClickUrl = (url: Extract<BrowserDomIntent, { kind: "click" }>["postClickUrl"]): void => {
  if (!url) return;
  const expectations = [url.equals, url.notEquals].filter((value) => value !== undefined);
  if (expectations.length !== 1
    || !isBoundedText(expectations[0], 2_048)
    || timeoutInvalid(url.timeoutMs)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};

const assertClickObservation = (
  observation: Extract<BrowserDomIntent, { kind: "click" }>["postClickObservation"],
): void => {
  if (!observation) return;
  assertObservationQueries(observation.queries, POSTCONDITION_QUERY_KEYS);
  for (const query of observation.queries) {
    if ((query.fields as readonly string[]).some((field) =>
      field === "semanticTextHash" || field === "exactEditableTextHash"
      || field === "exactGptUserPromptHash")
      || !Number.isInteger(query.expectedEligibleCount)
      || query.expectedEligibleCount < 0 || query.expectedEligibleCount > query.maxMatches) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
  if (timeoutInvalid(observation.timeoutMs)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertClickIntent = (intent: Extract<BrowserDomIntent, { kind: "click" }>): void => {
  assertTargetText(intent);
  const postconditions = [
    intent.postClickAttribute, intent.postClickMatch, intent.postClickObservation, intent.postClickUrl,
  ]
    .filter((value) => value !== undefined);
  if (postconditions.length !== 1) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  assertClickAttribute(intent.postClickAttribute);
  assertClickMatch(intent.postClickMatch);
  assertClickObservation(intent.postClickObservation);
  assertClickUrl(intent.postClickUrl);
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

const findTextValid = (intent: Extract<BrowserDomIntent, { kind: "find" }>): boolean =>
  (intent.textContains === undefined || isBoundedText(intent.textContains, 1_024))
  && (intent.textEquals === undefined || isBoundedText(intent.textEquals, 1_024))
  && !(intent.textContains !== undefined && intent.textEquals !== undefined);

const findWaitValid = (intent: Extract<BrowserDomIntent, { kind: "find" }>): boolean => {
  if (intent.waitFor === undefined) return true;
  return Number.isInteger(intent.waitFor.minimumMatches)
    && intent.waitFor.minimumMatches >= 1 && intent.waitFor.minimumMatches <= intent.maxMatches
    && Number.isInteger(intent.waitFor.timeoutMs)
    && intent.waitFor.timeoutMs >= 1 && intent.waitFor.timeoutMs <= 30_000;
};

const assertFindIntent = (intent: Extract<BrowserDomIntent, { kind: "find" }>): void => {
  if ((intent.selector === undefined) === (intent.locator === undefined)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (intent.maxMatches < 1 || intent.maxMatches > 20) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  if (!findTextValid(intent) || !findWaitValid(intent)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertReadIntent = (intent: Extract<BrowserDomIntent, { kind: "readText" | "readAttribute" }>): void => {
  if (!Number.isSafeInteger(intent.maxChars) || intent.maxChars < 1) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
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

const isBoundedText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit
  && !/[\u0000-\u001f]/u.test(value);
