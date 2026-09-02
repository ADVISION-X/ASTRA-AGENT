import { type BrowserDomIntent, type BrowserDomObservationField, type BrowserDomObservationQuery } from "../exact-target/browser-dom-intent.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { attribute, BROWSER_MECHANICAL_FACTS_READER_SOURCE, boxCenter, describeNode,
  documentState, inspectNode, nodeForRead, nodeForSelector, nodeText, queryAll,
  queryCandidateSet, queryVisibleTextMatches, requireExactCandidateCount,
  selectorForLocator, truncate } from "./dom-query-runtime.js";
type FindIntent = Extract<BrowserDomIntent, { kind: "find" }>;
type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type DoubleClickIntent = Extract<BrowserDomIntent, { kind: "doubleClick" }>;
type KeypressIntent = Extract<BrowserDomIntent, { kind: "keypress" }>;
type ValueIntent = Exclude<BrowserDomIntent, {
  kind: "document" | "observe" | "find" | "click" | "hover" | "doubleClick" | "keypress";
}>;
type CoherentObservationResult = Readonly<{
  schemaVersion: "grasseye.browser.dom-observation.v1";
  targetRefHash: `sha256:${string}`; documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`; observedAt: string;
  queries: readonly Readonly<Record<string, unknown>>[];
}>;
const COHERENT_OBSERVATION_FUNCTION = `function (specs) {
  ${BROWSER_MECHANICAL_FACTS_READER_SOURCE}
  const fieldValue = (node, facts, field) => {
    if (field === "id") return node.getAttribute("id") || ""; if (field === "dataTurn") return node.getAttribute("data-turn") || "";
    if (field === "tagName") return node.tagName; if (field === "ariaLabel") return node.getAttribute("aria-label") || "";
    if (field === "ariaExpanded") return node.getAttribute("aria-expanded") || ""; if (field === "ariaChecked") return node.getAttribute("aria-checked") || "";
    if (field === "text") return node.textContent || ""; if (field === "accept") return node.getAttribute("accept") || "";
    if (field === "multiple") return node.hasAttribute("multiple");
    return facts[field];
  };
  const observeQuery = (spec) => {
    const scopeRaw = spec.scope ? Array.from(document.querySelectorAll(spec.scope.selector)) : [document.documentElement];
    const scopeEligible = spec.scope ? scopeRaw.filter((node) => browserMechanicalFacts(node).visible) : scopeRaw;
    if (scopeEligible.length !== 1) return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: 0, eligibleCount: 0, matches: [], nativeCauseCode: null,
      nativeCauseCount: 0, nativeStage: "runtime-call-function-on"
    };
    const raw = Array.from(scopeEligible[0].querySelectorAll(spec.selector));
    const observed = raw.map((node) => ({ node, facts: browserMechanicalFacts(node) }));
    const eligible = observed.filter(({ node, facts }) => facts.visible
      && (spec.textContains === undefined || (node.textContent || "").includes(spec.textContains))
      && (spec.textEquals === undefined || (node.textContent || "").trim() === spec.textEquals.trim()));
    const noLayoutCount = observed.filter(({ facts }) => facts.nativeCauseCode === "NO_LAYOUT_BOX").length;
    return {
      queryId: spec.queryId, scopeRawCount: scopeRaw.length, scopeEligibleCount: scopeEligible.length,
      rawCount: raw.length, eligibleCount: eligible.length,
      matches: eligible.slice(0, spec.maxMatches + 1).map(({ node, facts }) =>
        Object.fromEntries(spec.fields.map((field) => [field, fieldValue(node, facts, field)]))),
      nativeCauseCode: noLayoutCount > 0 ? "NO_LAYOUT_BOX" : null,
      nativeCauseCount: noLayoutCount, nativeStage: "runtime-call-function-on"
    };
  };
  return { observedAt: new Date().toISOString(), queries: specs.map(observeQuery) };
}`;

const sha256Text = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const observationRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as Record<string, unknown>;
};

const observationCount = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("BROWSER_DOM_READ_INVALID");
  return value as number;
};

const stringObservationFields = new Set<BrowserDomObservationField>([
  "id", "testId", "dataTurn", "tagName", "type", "role", "name", "label", "ariaLabel",
  "ariaExpanded", "ariaChecked", "text", "value", "accept", "computedDisplay",
  "computedVisibility", "computedOpacity",
]);
const booleanObservationFields = new Set<BrowserDomObservationField>([
  "multiple", "connected", "layout", "visible", "hidden", "ariaHidden", "inert", "disabled",
  "ariaDisabled", "viewport", "hitTest",
]);

const observationFieldValid = (field: BrowserDomObservationField, value: unknown): boolean => {
  if (stringObservationFields.has(field)) return typeof value === "string";
  if (booleanObservationFields.has(field)) return typeof value === "boolean";
  if (field === "checked") return value === null || typeof value === "boolean";
  if (field !== "bounds") return false;
  if (value === null) return true;
  const bounds = observationRecord(value);
  return [bounds.x, bounds.y, bounds.width, bounds.height]
    .every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
};

const OBSERVATION_ROW_KEYS = new Set(["queryId", "scopeRawCount", "scopeEligibleCount", "rawCount",
  "eligibleCount", "matches", "nativeCauseCode", "nativeCauseCount", "nativeStage"]);
type ObservationCounts = Readonly<{ scopeRaw: number; scopeEligible: number; raw: number; eligible: number; nativeCause: number }>;
const observationRowIdentityValid = (row: Record<string, unknown>, spec: BrowserDomObservationQuery,
  nativeCauseCount: number): boolean => Object.keys(row).length === OBSERVATION_ROW_KEYS.size
  && !Object.keys(row).some((key) => !OBSERVATION_ROW_KEYS.has(key)) && row.queryId === spec.queryId
  && row.nativeStage === "runtime-call-function-on" && ((row.nativeCauseCode === null && nativeCauseCount === 0)
    || (row.nativeCauseCode === "NO_LAYOUT_BOX" && nativeCauseCount > 0));
const observationRowCountsValid = (counts: ObservationCounts): boolean => counts.scopeEligible <= counts.scopeRaw
  && counts.eligible <= counts.raw && counts.nativeCause <= counts.raw
  && (counts.scopeEligible === 1 || (counts.raw === 0 && counts.eligible === 0));

const decodeObservationRow = (
  value: unknown,
  spec: BrowserDomObservationQuery,
): Readonly<Record<string, unknown>> => {
  const row = observationRecord(value);
  const counts = { scopeRaw: observationCount(row.scopeRawCount),
    scopeEligible: observationCount(row.scopeEligibleCount), raw: observationCount(row.rawCount),
    eligible: observationCount(row.eligibleCount), nativeCause: observationCount(row.nativeCauseCount) };
  if (!observationRowIdentityValid(row, spec, counts.nativeCause) || !observationRowCountsValid(counts)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (!Array.isArray(row.matches) || row.matches.length !== Math.min(counts.eligible, spec.maxMatches + 1)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const matches = row.matches.map((matchValue) => {
    const match = observationRecord(matchValue);
    const matchKeys = Object.keys(match);
    if (matchKeys.length !== spec.fields.length || matchKeys.some((field) => !spec.fields.includes(field as BrowserDomObservationField))
      || spec.fields.some((field) => !observationFieldValid(field, match[field]))) {
      throw new Error("BROWSER_DOM_READ_INVALID");
    }
    return Object.freeze({ ...match });
  });
  return Object.freeze({ ...row, matches });
};

const decodeObservationCall = (
  value: unknown,
  specs: readonly BrowserDomObservationQuery[],
): Readonly<{ observedAt: string; queries: readonly Readonly<Record<string, unknown>>[] }> => {
  const packet = observationRecord(value);
  if (Object.keys(packet).length !== 2 || !Array.isArray(packet.queries)
    || packet.queries.length !== specs.length || typeof packet.observedAt !== "string"
    || new Date(packet.observedAt).toISOString() !== packet.observedAt) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({
    observedAt: packet.observedAt,
    queries: packet.queries.map((query, index) => decodeObservationRow(query, specs[index]!)),
  });
};

const executeCoherentObservation = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  specs: readonly BrowserDomObservationQuery[],
): Promise<CoherentObservationResult> => {
  let objectId: string | null = null;
  let primaryFailure: unknown = null;
  try {
    const document = observationRecord(await runtime.send(target.tabId, "DOM.getDocument", { depth: 0, pierce: true }));
    const root = observationRecord(document.root);
    if (!Number.isSafeInteger(root.nodeId)) throw new Error("BROWSER_DOM_READ_INVALID");
    const resolved = observationRecord(await runtime.send(target.tabId, "DOM.resolveNode", { nodeId: root.nodeId }));
    objectId = observationRecord(resolved.object).objectId as string;
    if (typeof objectId !== "string" || objectId.length === 0) throw new Error("BROWSER_DOM_READ_INVALID");
    const call = observationRecord(await runtime.send(target.tabId, "Runtime.callFunctionOn", {
      objectId, functionDeclaration: COHERENT_OBSERVATION_FUNCTION, arguments: [{ value: specs }],
      returnByValue: true, awaitPromise: false, silent: true,
    }));
    if (call.exceptionDetails !== undefined) throw new Error("BROWSER_DOM_READ_INVALID");
    const observed = decodeObservationCall(observationRecord(call.result).value, specs);
    const targetRefHash = await sha256Text(target.targetRef);
    const documentRefHash = await sha256Text(target.documentRef);
    const observationRevisionHash = await sha256Text(canonicalizeBrowserAuthorityValue({
      targetRefHash, documentRefHash, observedAt: observed.observedAt, queries: observed.queries,
    }));
    return Object.freeze({ schemaVersion: "grasseye.browser.dom-observation.v1", targetRefHash,
      documentRefHash, observationRevisionHash, observedAt: observed.observedAt, queries: observed.queries });
  } catch (error) {
    primaryFailure = error;
    if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) throw error;
    throw new Error("BROWSER_DOM_READ_INVALID", { cause: error });
  } finally {
    if (objectId !== null) try { await runtime.send(target.tabId, "Runtime.releaseObject", { objectId }); }
    catch (error) { if (primaryFailure === null) throw new Error("BROWSER_DOM_READ_INVALID", { cause: error }); }
  }
};

/** Executes the finite declarative DOM intent set without a script/eval surface. */
const executeFindIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: FindIntent,
): Promise<unknown> => {
  const selector = intent.selector ?? selectorForLocator(intent.locator!);
  const deadline = intent.waitFor === undefined ? null : Date.now() + intent.waitFor.timeoutMs;
  let candidates = await queryCandidateSet(
    debuggerRuntime, target.tabId, selector, intent.maxMatches + 1, intent.scope,
    intent.textEquals !== undefined ? { value: intent.textEquals, exact: true }
      : intent.textContains !== undefined ? { value: intent.textContains, exact: false } : undefined,
  );
  do {
    if (intent.waitFor === undefined || candidates.eligibleCount >= intent.waitFor.minimumMatches
      || Date.now() >= deadline!) break;
    await waitForNextBoundedObservation(deadline!);
    candidates = await queryCandidateSet(
      debuggerRuntime, target.tabId, selector, intent.maxMatches + 1, intent.scope,
      intent.textEquals !== undefined ? { value: intent.textEquals, exact: true }
        : intent.textContains !== undefined ? { value: intent.textContains, exact: false } : undefined,
    );
  } while (Date.now() <= deadline!);
  if (candidates.eligibleCount > intent.maxMatches) throw new Error("BROWSER_DOM_CANDIDATE_AMBIGUOUS");
  const matches = intent.fields === undefined
    ? undefined
    : await Promise.all(candidates.eligibleNodeIds.map((nodeId) => inspectNode(
      debuggerRuntime,
      target.tabId,
      nodeId,
      intent.fields!,
    )));
  return {
    count: candidates.eligibleCount,
    rawCount: candidates.rawCount,
    eligibleCount: candidates.eligibleCount,
    nativeCauseCode: candidates.nativeCauseCode,
    nativeCauseCount: candidates.nativeCauseCount,
    nativeStage: candidates.nativeStage,
    ...(matches === undefined ? {} : { matches }),
  };
};

const waitForNextBoundedObservation = async (deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.min(50, remaining)));
};

const executeClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = intent.expectedTextEquals !== undefined
    ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
    : intent.expectedText !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
      : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
  requireExactCandidateCount(matchingNodes, expectedMatches);
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  const postconditionVerified = intent.postClickAttribute !== undefined
    ? await waitForClickAttribute(debuggerRuntime, target, intent, expectedMatches, intent.postClickAttribute)
    : intent.postClickMatch !== undefined
      ? await waitForMatch(debuggerRuntime, target, intent.postClickMatch)
      : await waitForUrl(debuggerRuntime, target, intent.postClickUrl!);
  return {
    clicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeDoubleClickIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: DoubleClickIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = await queryAll(
    debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope,
  );
  requireExactCandidateCount(matchingNodes, expectedMatches);
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  for (const clickCount of [1, 2] as const) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount,
    });
    await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount,
    });
  }
  const postconditionVerified = await waitForMatch(
    debuggerRuntime, target, intent.postDoubleClickMatch,
  );
  return {
    doubleClicked: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeKeypressIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: KeypressIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const nodeId = await nodeForSelector(
    debuggerRuntime, target.tabId, intent.selector, expectedMatches, intent.scope,
  );
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId });
  const virtualKeyCode = intent.key === "Enter" ? 13 : intent.key === "ArrowLeft" ? 37 : 39;
  const keyEvent = {
    key: intent.key,
    code: intent.key,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  } as const;
  for (let index = 0; index < (intent.repeat ?? 1); index += 1) {
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...keyEvent });
    await debuggerRuntime.send(target.tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
  }
  const postconditionVerified = await waitForMatch(
    debuggerRuntime, target, intent.postKeypressMatch,
  );
  return {
    keyPressed: intent.key,
    keypressCount: intent.repeat ?? 1,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const executeHoverIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: HoverIntent,
): Promise<unknown> => {
  const expectedMatches = intent.expectedMatches ?? 1;
  const matchingNodes = intent.expectedTextEquals !== undefined
    ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
    : intent.expectedText !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
      : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
  requireExactCandidateCount(matchingNodes, expectedMatches);
  const nodeId = matchingNodes[0];
  if (nodeId === undefined) throw new Error("BROWSER_DOM_CANDIDATE_MISSING");
  const box = await boxCenter(debuggerRuntime, target.tabId, nodeId);
  await debuggerRuntime.send(target.tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  const postconditionVerified = await waitForInteractionAttribute(
    debuggerRuntime, target, intent, expectedMatches, intent.postHoverAttribute,
  );
  return {
    hovered: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

const waitForMatch = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  match: Readonly<{
    selector: string;
    expectedMatches: number;
    textContains?: string;
    textEquals?: string;
    timeoutMs?: number;
  }>,
): Promise<boolean> => {
  const deadline = Date.now() + (match.timeoutMs ?? 1);
  do {
    const nodes = match.textEquals !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, match.selector, match.textEquals, true, match.expectedMatches + 1)
      : match.textContains !== undefined
        ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, match.selector, match.textContains, false, match.expectedMatches + 1)
        : await queryAll(debuggerRuntime, target.tabId, match.selector, match.expectedMatches + 1);
    if (nodes.length === match.expectedMatches) return true;
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

const waitForUrl = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ equals: string; timeoutMs?: number }>,
): Promise<boolean> => {
  const deadline = Date.now() + (postcondition.timeoutMs ?? 1);
  do {
    const document = await documentState(debuggerRuntime, target.tabId) as { url?: unknown };
    if (document.url === postcondition.equals) return true;
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

const waitForClickAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  expectedMatches: number,
  postClickAttribute: NonNullable<ClickIntent["postClickAttribute"]>,
): Promise<boolean> => waitForInteractionAttribute(
  debuggerRuntime, target, intent, expectedMatches, postClickAttribute,
);

const waitForInteractionAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent,
  expectedMatches: number,
  postAttribute: NonNullable<ClickIntent["postClickAttribute"]> | HoverIntent["postHoverAttribute"],
): Promise<boolean> => {
  const deadline = Date.now() + (postAttribute.timeoutMs ?? 1);
  do {
    const nodes = intent.expectedTextEquals !== undefined
      ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedTextEquals, true, expectedMatches + 1, intent.scope)
      : intent.expectedText !== undefined
        ? await queryVisibleTextMatches(debuggerRuntime, target.tabId, intent.selector, intent.expectedText, false, expectedMatches + 1, intent.scope)
        : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
    if (nodes.length === expectedMatches) {
      const currentNodeId = nodes[0];
      if (currentNodeId !== undefined
        && attribute(await describeNode(debuggerRuntime, target.tabId, currentNodeId), postAttribute.name)
          === postAttribute.equals) return true;
    }
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

const clearFocusedInput = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<void> => {
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "a", code: "KeyA", commands: ["selectAll"],
  });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Backspace", code: "Backspace",
  });
  await debuggerRuntime.send(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", key: "Backspace", code: "Backspace",
  });
};

const executeValueIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ValueIntent,
): Promise<unknown> => {
  const nodeId = intent.kind === "readText" || intent.kind === "readAttribute"
    ? await nodeForRead(debuggerRuntime, target.tabId, intent)
    : await nodeForSelector(debuggerRuntime, target.tabId, intent.selector, intent.kind === "fill" ? intent.expectedMatches ?? 1 : 1, intent.scope);
  if (intent.kind === "inspect") return inspectNode(debuggerRuntime, target.tabId, nodeId, intent.fields);
  if (intent.kind === "readText") return truncate(await nodeText(debuggerRuntime, target.tabId, nodeId), intent.maxChars);
  if (intent.kind === "readAttribute") return truncate(attribute(await describeNode(debuggerRuntime, target.tabId, nodeId), intent.name) ?? "", intent.maxChars);
  await debuggerRuntime.send(target.tabId, "DOM.focus", { nodeId });
  if (intent.clearBeforeType) await clearFocusedInput(debuggerRuntime, target.tabId);
  await debuggerRuntime.send(target.tabId, "Input.insertText", { text: intent.approvedText });
  const retainedValue = await nodeText(debuggerRuntime, target.tabId, nodeId);
  const postconditionVerified = retainedValue === intent.approvedText;
  return {
    filled: true,
    candidateCount: 1,
    identityRevalidated: true,
    mutationCount: 1,
    retainedValueVerified: postconditionVerified,
    postconditionVerified,
    ...(postconditionVerified ? {} : { failureCode: "BROWSER_POSTCONDITION_FAILED" }),
  };
};

export const executeRegisteredDomIntent = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: BrowserDomIntent,
): Promise<unknown> => {
  if (intent.kind === "document") return documentState(debuggerRuntime, target.tabId);
  if (intent.kind === "observe") return executeCoherentObservation(debuggerRuntime, target, intent.queries);
  if (intent.kind === "find") return executeFindIntent(debuggerRuntime, target, intent);
  if (intent.kind === "click") return executeClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "hover") return executeHoverIntent(debuggerRuntime, target, intent);
  if (intent.kind === "doubleClick") return executeDoubleClickIntent(debuggerRuntime, target, intent);
  if (intent.kind === "keypress") return executeKeypressIntent(debuggerRuntime, target, intent);
  return executeValueIntent(debuggerRuntime, target, intent);
};
