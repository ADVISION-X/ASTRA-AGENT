const BROWSER_DOM_FIELD_VALUES = [
  "id", "testId", "dataTurn", "tagName", "type", "role", "name", "label",
  "ariaLabel", "ariaLabelledBy", "ariaControls", "ariaExpanded", "ariaChecked", "ariaValueMin", "ariaValueMax", "ariaValueNow",
  "text", "outerHtml", "semanticText", "semanticTextHash", "exactEditableTextHash",
  "exactGptUserPromptHash",
  "value", "checked", "accept", "multiple", "connected", "layout", "visible",
  "computedDisplay", "computedVisibility", "computedOpacity", "effectiveOpacity", "hidden", "ariaHidden",
  "inert", "disabled", "ariaDisabled",
] as const;
import {
  assertFindIntent,
  assertOptionalRange,
  assertReadIntent,
  assertReadScope,
  assertSelector,
  exactAssistantReadIntentValid,
  isBoundedText,
} from "./browser-dom-read-intent.js";
import {
  assertPreClickExactOutgoingTurn, assertSpecialBrowserDomIntent,
} from "./browser-dom-special-intent.js";
export type BrowserDomField = typeof BROWSER_DOM_FIELD_VALUES[number];
export type BrowserDomObservationField = Exclude<BrowserDomField, "outerHtml" | "semanticText" | "text">;
export type BrowserDomPostconditionField = Exclude<BrowserDomObservationField,
  "semanticTextHash" | "exactEditableTextHash">;
export type BrowserDomReadEligibility = "non-actionable-aria-state";
export type BrowserDomIneligibleReason =
  | "DISCONNECTED" | "NO_LAYOUT_BOX" | "DISPLAY_HIDDEN" | "VISIBILITY_HIDDEN"
  | "OPACITY_HIDDEN" | "HTML_HIDDEN" | "ARIA_HIDDEN" | "INERT" | "TEXT_MISMATCH";
export type BrowserDomIneligibleCandidate = Readonly<{
  index: number; reasons: readonly BrowserDomIneligibleReason[];
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
  exactGptUserPromptContains?: string;
  latestGptUserTurn?: true;
}>;
export type BrowserDomPostconditionQuery = Omit<
  BrowserDomObservationQuery, "fields" | "exactGptUserPromptContains"
> & Readonly<{
  fields: readonly BrowserDomPostconditionField[];
  expectedEligibleCount: number;
}>;
export type BrowserDomObservationPacketV2 = Readonly<{
  schemaVersion: "grasseye.browser.dom-observation.v2";
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`;
  currentUrl: string;
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

export type BrowserExactAssistantTurnReplyV3 = Readonly<{
  schemaVersion: "grasseye.browser.exact-assistant-turn.v3";
  exactCallIdentityHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`;
  assistantTurnId: string;
  currentUrl: string;
  precedingUserTurnId: string;
  generatingRaw: number;
  rawDomHtml: string;
  rawDomHash: `sha256:${string}`;
  semanticText: string;
  semanticTextHash: `sha256:${string}`;
  observedAt: string;
  pendingCause?: "exact-user-turn-unavailable" | "adjacent-assistant-missing";
}>;

export type BrowserDomReadScope = Readonly<{ selector: string }>;
export type BrowserSemanticLocator = Readonly<{
  role?: string; name?: string; testId?: string; label?: string;
}>;

export type BrowserDomIntent =
  | Readonly<{ kind: "document" }>
  | Readonly<{ kind: "selectExactGptConversation"; canonicalConversationUrl: string }>
  | Readonly<{
    kind: "acknowledgeKnownGptRateLimit";
    targetRefHash: `sha256:${string}`;
    documentRefHash: `sha256:${string}`;
    dispatchNotAfter: string | null;
  }>
  | Readonly<{
    kind: "readKnownGptRateLimitClearance";
    targetRefHash: `sha256:${string}`;
    documentRefHash: `sha256:${string}`;
  }>
  | Readonly<{ kind: "observe"; queries: readonly BrowserDomObservationQuery[] }>
  | Readonly<{ kind: "readExactAssistantTurn"; userTurnId: string; canonicalConversationUrl: string }>
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
    requiredClickPointSelector?: string;
    /** Exact approved GPT turn revalidated in the same DOM call that resolves the click point. */
    preClickExactOutgoingTurn?: Readonly<{
      composerSelector: string;
      composerFormSelector: string;
      attachmentSelector: string;
      userTurnSelector: string;
      expectedPromptHash: `sha256:${string}`;
      expectedAttachmentLabels: readonly string[];
    }>;
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
      /** Post-click state read from the exact candidate node retained by this command. */
      clickedCandidateAttribute?: Readonly<{
        name: "aria-checked";
        equals: "true";
      }>;
    }>;
    postClickUrl?: Readonly<{
      equals?: string;
      notEquals?: string;
      timeoutMs?: number;
    }>;
    /** Reserved for the known rate-limit acknowledgement readback. */
    postClickMinimumDelayMs?: 2500;
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
    repeat?: 1 | 2 | 3 | 4 | 5;
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
  assertSpecialBrowserDomIntent(intent);
  if (intent.kind === "observe") assertObserveIntent(intent);
  if (intent.kind === "readExactAssistantTurn" && !exactAssistantReadIntentValid(intent)) {
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
  "exactGptUserPromptContains",
]);
const POSTCONDITION_QUERY_KEYS = new Set([
  "queryId", "selector", "maxMatches", "fields", "readEligibility", "scope", "textContains", "textEquals",
  "expectedEligibleCount", "latestGptUserTurn",
]);
const assertReadEligibility = (value: BrowserDomReadEligibility | undefined): void => {
  if (value !== undefined && value !== "non-actionable-aria-state") {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
const invalidObservationQueryShape = (
  query: BrowserDomObservationQuery,
  allowedKeys: ReadonlySet<string>,
  queryIds: ReadonlySet<string>,
): boolean => !query || typeof query !== "object" || Array.isArray(query)
  || Object.keys(query).some((key) => !allowedKeys.has(key))
  || !isBoundedText(query.queryId, 128) || queryIds.has(query.queryId)
  || !isBoundedText(query.selector, 2_048);

const invalidObservationQueryBounds = (query: BrowserDomObservationQuery): boolean =>
  (query.latestGptUserTurn !== undefined && query.latestGptUserTurn !== true)
  || !Number.isInteger(query.maxMatches) || query.maxMatches < 1 || query.maxMatches > 20;

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
    if (invalidObservationQueryShape(query, allowedKeys, queryIds)
      || invalidObservationQueryBounds(query)) {
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

const invalidPostObservationQuery = (
  query: NonNullable<Extract<BrowserDomIntent, { kind: "click" }>["postClickObservation"]>["queries"][number],
  exactOutgoingTurn: Extract<BrowserDomIntent, { kind: "click" }>["preClickExactOutgoingTurn"],
): boolean => (query.fields as readonly string[]).some((field) =>
  field === "semanticTextHash" || field === "exactEditableTextHash"
  || (field === "exactGptUserPromptHash" && exactOutgoingTurn === undefined))
  || !Number.isInteger(query.expectedEligibleCount)
  || query.expectedEligibleCount < 0 || query.expectedEligibleCount > query.maxMatches;

const invalidExactOutgoingObservation = (
  observation: NonNullable<Extract<BrowserDomIntent, { kind: "click" }>["postClickObservation"]>,
  exactOutgoingTurn: NonNullable<Extract<BrowserDomIntent, { kind: "click" }>["preClickExactOutgoingTurn"]>,
): boolean => observation.queries.length !== 2
  || observation.queries[0]!.selector !== exactOutgoingTurn.userTurnSelector
  || observation.queries[0]!.latestGptUserTurn !== true
  || !observation.queries[0]!.fields.includes("testId")
  || !observation.queries[0]!.fields.includes("exactGptUserPromptHash")
  || observation.queries[1]!.selector !== `${exactOutgoingTurn.composerSelector}[contenteditable='true']:has(> p[data-empty-paragraph='true'] > br.ProseMirror-trailingBreak)`
  || observation.queries[1]!.fields.length !== 0;

const invalidClickedCandidateAttribute = (
  attribute: NonNullable<Extract<BrowserDomIntent, { kind: "click" }>["postClickObservation"]>["clickedCandidateAttribute"],
): boolean => attribute !== undefined && (
  Object.keys(attribute).sort().join("|") !== "equals|name"
  || attribute.name !== "aria-checked" || attribute.equals !== "true");

const assertObserveIntent = (intent: Extract<BrowserDomIntent, { kind: "observe" }>): void =>
  assertObservationQueries(intent.queries, OBSERVATION_QUERY_KEYS);

const assertObservationText = (query: BrowserDomObservationQuery): void => {
  if ((query.textContains !== undefined && !isBoundedText(query.textContains, 1_024))
    || (query.textEquals !== undefined && !isBoundedText(query.textEquals, 1_024))
    || (query.exactGptUserPromptContains !== undefined
      && !isBoundedText(query.exactGptUserPromptContains, 1_024))
    || (query.textContains !== undefined && query.textEquals !== undefined)
    || (query.exactGptUserPromptContains !== undefined
      && (query.textContains !== undefined || query.textEquals !== undefined))) {
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
    && (!Number.isInteger(intent.repeat) || intent.repeat < 1 || intent.repeat > 5)) {
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
  if (timeoutInvalid(match.timeoutMs)) {
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
  && (!Number.isInteger(value) || value < 1_500 || value > 5_000);

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
  exactOutgoingTurn: Extract<BrowserDomIntent, { kind: "click" }>["preClickExactOutgoingTurn"],
): void => {
  if (!observation) return;
  if (Object.keys(observation).some((key) =>
    key !== "queries" && key !== "timeoutMs" && key !== "clickedCandidateAttribute")) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  assertObservationQueries(observation.queries, POSTCONDITION_QUERY_KEYS);
  for (const query of observation.queries) {
    if (invalidPostObservationQuery(query, exactOutgoingTurn)) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
  }
  if (exactOutgoingTurn !== undefined
    && invalidExactOutgoingObservation(observation, exactOutgoingTurn)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (invalidClickedCandidateAttribute(observation.clickedCandidateAttribute)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (timeoutInvalid(observation.timeoutMs)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
};

const assertClickIntent = (intent: Extract<BrowserDomIntent, { kind: "click" }>): void => {
  assertTargetText(intent);
  assertPreClickExactOutgoingTurn(intent.preClickExactOutgoingTurn);
  if (intent.requiredClickPointSelector !== undefined
    && (!isBoundedText(intent.requiredClickPointSelector, 2_048)
      || intent.postClickMatch === undefined || intent.preClickExactOutgoingTurn !== undefined)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  const postconditions = [
    intent.postClickAttribute, intent.postClickMatch, intent.postClickObservation, intent.postClickUrl,
  ]
    .filter((value) => value !== undefined);
  if (postconditions.length !== 1) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  if (intent.postClickMinimumDelayMs !== undefined && intent.postClickMinimumDelayMs !== 2_500) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  assertClickAttribute(intent.postClickAttribute);
  assertClickMatch(intent.postClickMatch);
  assertClickObservation(intent.postClickObservation, intent.preClickExactOutgoingTurn);
  assertClickUrl(intent.postClickUrl);
};

const assertHoverIntent = (intent: Extract<BrowserDomIntent, { kind: "hover" }>): void => {
  assertTargetText(intent);
  if (!intent.postHoverAttribute
    || intent.postHoverAttribute.name !== "aria-expanded"
    || intent.postHoverAttribute.equals !== "true"
    || (intent.postHoverAttribute.timeoutMs !== undefined
      && (!Number.isInteger(intent.postHoverAttribute.timeoutMs)
        || intent.postHoverAttribute.timeoutMs < 1_500
        || intent.postHoverAttribute.timeoutMs > 5_000))) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
