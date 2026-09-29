import { runInNewContext } from "node:vm";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";

import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import {
  exactAssistantRuntimeFor as runtimeFor,
  exactAssistantTarget as target,
  exactAssistantObservedAt as observedAt,
  exactConversationFixtureUrl,
  executeExactAssistantFixture as execute,
  successfulAssistantObservation as successfulObservation,
} from "./local-browser-dom-runtime-fixture.js";

export { exactConversationFixtureUrl } from "./local-browser-dom-runtime-fixture.js";
import {
  FakeElement,
  FakeTextNode,
  RICH_SEMANTIC_TEXT,
  execute as executeCaptured,
  richSemanticTree,
} from "./local-browser-dom-function-fixture.js";

const capturedAssistantFixture = () => {
  const userTurnId = "00000000-0000-4000-8000-000000000001";
  const assistantTurnId = "00000000-0000-4000-8000-000000000002";
  const turnMarker = "fixture-marker";
  const text = (value: string) => new FakeTextNode(value);
  const paragraph = new FakeElement("bold", {}, {}, {}, "P", [
    new FakeElement("bold", {}, {}, {}, "STRONG", [text("bold")]),
  ]);
  const list = new FakeElement("item", {}, {}, {}, "UL", [
    new FakeElement("item", {}, {}, {}, "LI", [text("item")]),
  ]);
  const assistant = new FakeElement("bold item", { "pre code": [] }, {}, {}, "DIV", [paragraph, list]);
  const userMessage = new FakeElement(`provider-folded-message ${turnMarker}`, {}, {}, {
    "data-user-message-bubble": "true",
  }, "DIV", [text(`provider-folded-message ${turnMarker}`)]);
  const user = new FakeElement(`provider-folded-message ${turnMarker}`, {
    "[data-user-message-bubble='true']": [userMessage],
  }, {}, {
    "data-chatgpt-search-unit-key": "fallback-turn-0:0:user",
    "data-chatgpt-search-message-ids": userTurnId,
  }, "DIV", [userMessage]);
  const assistantOuter = (node: FakeElement) => {
    const role = new FakeElement("assistant", {}, {}, { "data-conversation-role": "assistant" }, "H4");
    const assistantUnit = new FakeElement(node.textContent, {
      "h4[data-conversation-role='assistant']": [role],
      "[data-markdown-text-style='assistant-message']": [node],
    }, {}, {
      "data-chatgpt-search-unit-key": "fallback-turn-0:1:assistant",
      "data-chatgpt-search-message-ids": assistantTurnId,
    }, "DIV", [role, node]);
    return new FakeElement(node.textContent, {
      "[data-chatgpt-search-unit-key]": [user, assistantUnit],
    }, {}, { "data-turn-key": userTurnId }, "SECTION", [user, assistantUnit]);
  };
  const emptyAssistantOuter = new FakeElement(userMessage.textContent, {
    "[data-chatgpt-search-unit-key]": [user],
  }, {}, { "data-turn-key": userTurnId }, "SECTION", [user]);
  const turnsSelector = "[data-turn-key]";
  const input = { kind: "readExactAssistantTurn", turnMarker, observedUserTurnId: userTurnId,
    canonicalConversationUrl: exactConversationFixtureUrl };
  const exactAssistant = assistantOuter(assistant);
  const turns = (laterTurns: readonly FakeElement[], pointed: FakeElement | null) => ({
    querySelectorAll: (value: string) => value === turnsSelector
      ? laterTurns.length ? laterTurns : [emptyAssistantOuter] : [],
    elementFromPoint: () => pointed,
  });
  let queryCalls = 0;
  const document = {
    querySelectorAll: (value: string) => {
      queryCalls += 1;
      return value === turnsSelector ? [exactAssistant] : [];
    },
    elementFromPoint: () => assistant,
  };
  return { assistant, assistantOuter, document, input, queryCalls: () => queryCalls,
    text, turns, user };
};

const exerciseCapturedAssistantBaseline = async (
  source: string,
  fixture: ReturnType<typeof capturedAssistantFixture>,
): Promise<void> => {
  const observed = await executeCaptured(
    source, fixture.document, fixture.input, `${exactConversationFixtureUrl}?query=discarded#fragment`,
  ) as Readonly<{ rawCount: number; rawDomHtml: string; semanticText: string;
    currentUrl: string; nativeStage: string }>;
  assert.equal(fixture.queryCalls(), 2,
    "the assistant, exact predecessor, and stop state must share one async Runtime call");
  assert.equal(source.includes("assistantIndex"), false,
    "a task-owned adjacent assistant must not depend on being the page's final turn");
  assert.equal(source.includes("composerRaw"), false,
    "global composer cardinality must not decide whether an adjacent assistant exists");
  assert.equal(source.includes("browserMechanicalFacts"), false,
    "display and interaction eligibility must not decide whether exact answer text exists");
  assert.equal(source.includes("collapsible-user-message-content"), false,
    "response read must not parse or hash the already-confirmed user prompt DOM");
  assert.equal(source.includes("precedingPromptHash"), false,
    "response read must not create a second prompt identity");
  assert.equal(source.includes("data-chatgpt-selection-message-id"), false,
    "the selection wrapper ChatGPT adds only after completion must not gate a streaming read");
  assert.equal(observed.rawCount, 1);
  assert.match(observed.rawDomHtml, /<strong>bold<\/strong>/u);
  assert.equal(observed.semanticText, "**bold**\n- item\n");
  assert.equal(observed.currentUrl, exactConversationFixtureUrl);
  assert.equal(observed.nativeStage, "runtime-call-function-on");
  const generatingObserved = await executeCaptured(source, { ...fixture.document,
    querySelectorAll: (value: string) => {
      if (value.includes("停止")) {
        assert.equal(value, "form[data-chatgpt-composer] button[aria-label='停止']");
        return [fixture.assistant];
      }
      return fixture.document.querySelectorAll(value);
    },
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{
    rawCount: number; rawDomHtml: string; semanticText: string; generatingRaw: number;
  }>;
  assert.deepEqual({ rawCount: generatingObserved.rawCount, rawDomHtml: generatingObserved.rawDomHtml,
    semanticText: generatingObserved.semanticText,
    generatingRaw: generatingObserved.generatingRaw },
  { rawCount: 1, rawDomHtml: fixture.assistant.outerHTML,
    semanticText: "**bold**\n- item\n", generatingRaw: 1 },
  "generation state must remain observable without erasing the exact adjacent assistant candidate");
};

const exerciseCapturedAssistantIdentityRejections = async (
  source: string,
  fixture: ReturnType<typeof capturedAssistantFixture>,
): Promise<void> => {
  const bubble = new FakeElement("fixture-marker", {}, {},
    { "data-user-message-bubble": "true" });
  const wrongMessageIdUser = new FakeElement("fixture-marker",
    { "[data-user-message-bubble='true']": [bubble] }, {}, {
      "data-chatgpt-search-unit-key": "fallback-turn-0:0:user",
      "data-chatgpt-search-message-ids": "00000000-0000-4000-8000-000000000003",
    });
  const wrongMessageIdTurn = new FakeElement("fixture-marker",
    { "[data-chatgpt-search-unit-key]": [wrongMessageIdUser] }, {},
    { "data-turn-key": "00000000-0000-4000-8000-000000000001" });
  await assert.rejects(async () => executeCaptured(source, fixture.turns([wrongMessageIdTurn], null),
    fixture.input, exactConversationFixtureUrl), /BROWSER_DOM_READ_INVALID/u,
  "a marker with mismatched user message ids must not produce an answer");
  const wrongRoleUser = new FakeElement("fixture-marker",
    { "[data-user-message-bubble='true']": [bubble] }, {}, {
      "data-chatgpt-search-unit-key": "fallback-turn-0:0:assistant",
      "data-chatgpt-search-message-ids": "00000000-0000-4000-8000-000000000001",
    });
  const wrongRoleTurn = new FakeElement("fixture-marker",
    { "[data-chatgpt-search-unit-key]": [wrongRoleUser] }, {},
    { "data-turn-key": "00000000-0000-4000-8000-000000000001" });
  const wrongRole = await executeCaptured(source, fixture.turns([wrongRoleTurn], null),
    fixture.input, exactConversationFixtureUrl) as Readonly<{ pendingCause: string }>;
  assert.equal(wrongRole.pendingCause, "exact-user-turn-unavailable");
};

const exerciseCapturedAssistantRejections = async (
  source: string,
  fixture: ReturnType<typeof capturedAssistantFixture>,
): Promise<void> => {
  const presentationVariants = [
    new FakeElement("layoutless", { "pre code": [] }, { display: "none" }, {}, "DIV", [fixture.text("layoutless")]),
    new FakeElement("hidden", { "pre code": [] }, {}, { hidden: "" }, "DIV", [fixture.text("hidden")]),
    new FakeElement("aria hidden", { "pre code": [] }, {}, { "aria-hidden": "true" }, "DIV", [fixture.text("aria hidden")]),
    new FakeElement("inert", { "pre code": [] }, {}, { inert: "" }, "DIV", [fixture.text("inert")]),
  ];
  for (const node of presentationVariants) {
    const observed = await executeCaptured(source, fixture.turns([fixture.assistantOuter(node)], null),
      fixture.input, exactConversationFixtureUrl) as Readonly<{
      rawCount: number; rawDomHtml: string; semanticText: string;
    }>;
    assert.equal(observed.rawCount, 1);
    assert.equal(observed.rawDomHtml, node.outerHTML);
    assert.notEqual(observed.semanticText.trim(), "",
      "presentation state must not erase exact adjacent assistant content");
  }
  const missingUser = await executeCaptured(source, {
    querySelectorAll: () => [],
    elementFromPoint: () => null,
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{
    rawCount: number; pendingCause: string | null;
  }>;
  assert.equal(missingUser.rawCount, 0);
  assert.equal(missingUser.pendingCause, "exact-user-turn-unavailable");
  const missingAssistant = await executeCaptured(source, fixture.turns([], null),
    fixture.input, exactConversationFixtureUrl) as Readonly<{
    rawCount: number; pendingCause: string | null; observedAt: string;
  }>;
  assert.equal(missingAssistant.rawCount, 0);
  assert.equal(missingAssistant.pendingCause, "adjacent-assistant-missing");
  await assert.rejects(async () => executeCaptured(source, fixture.turns([
    fixture.assistantOuter(fixture.assistant), fixture.assistantOuter(fixture.assistant),
  ], fixture.assistant), fixture.input, exactConversationFixtureUrl),
  /BROWSER_DOM_CANDIDATE_AMBIGUOUS/u,
  "duplicate exact turn keys must fail closed");
  await exerciseCapturedAssistantIdentityRejections(source, fixture);
  const rich = richSemanticTree();
  const richObserved = await executeCaptured(source, fixture.turns([fixture.assistantOuter(rich)], rich),
    fixture.input, exactConversationFixtureUrl) as Readonly<{ semanticText: string }>;
  assert.equal(richObserved.semanticText, RICH_SEMANTIC_TEXT,
    "exact assistant read must preserve headings, prose, lists, inline code, the code block, and trailing prose");
  const laterTurn = new FakeElement("later", {}, {}, { "data-turn-key": "00000000-0000-4000-8000-000000000003" });
  const drifted = await executeCaptured(source,
    fixture.turns([fixture.assistantOuter(fixture.assistant), laterTurn], fixture.assistant),
    fixture.input, exactConversationFixtureUrl) as Readonly<{
    rawCount: number; rawDomHtml: string; semanticText: string;
  }>;
  assert.deepEqual({ rawCount: drifted.rawCount, rawDomHtml: drifted.rawDomHtml,
    semanticText: drifted.semanticText }, {
    rawCount: 1, rawDomHtml: fixture.assistant.outerHTML,
    semanticText: "**bold**\n- item\n",
  }, "a later page turn must not erase the assistant adjacent to the exact task-owned user turn");
  const wrongConversation = await executeCaptured(
    source, fixture.document, fixture.input, "https://chatgpt.com/c/another-conversation",
  ) as Readonly<{ rawCount: number; rawDomHtml: string; semanticText: string }>;
  assert.equal(wrongConversation.rawCount, 1);
  assert.equal(wrongConversation.rawDomHtml, "");
  assert.equal(wrongConversation.semanticText, "",
    "a different canonical conversation URL must invalidate the observation");
};

const exerciseCapturedExactAssistantTurnFunction = async (source: string): Promise<void> => {
  const fixture = capturedAssistantFixture();
  await exerciseCapturedAssistantBaseline(source, fixture);
  await exerciseCapturedAssistantRejections(source, fixture);
};

const exerciseSingleAtomicRead = async (): Promise<void> => {
  const fixture = runtimeFor(successfulObservation);
  const reply = await execute(fixture) as Readonly<Record<string, unknown>>;
  assert.equal(fixture.callCount(), 2,
    "the bounded marker scan must precede one coherent answer observation");
  assert.equal(fixture.releases(), 2);
  assert.deepEqual(fixture.methods.filter((method) => [
    "DOM.querySelectorAll", "DOM.describeNode", "DOM.getOuterHTML",
  ].includes(method)), [], "the exact reply must not splice independent DOM reads");
  assert.equal(fixture.methods.filter((method) => method === "Page.getFrameTree").length, 3);
  assert.equal(reply.rawDomHtml, successfulObservation.rawDomHtml);
  assert.equal(reply.semanticText, successfulObservation.semanticText);
  assert.equal(reply.observedAt, observedAt);
  assert.match(String(reply.targetRefHash), /^sha256:[a-f0-9]{64}$/u);
  assert.match(String(reply.documentRefHash), /^sha256:[a-f0-9]{64}$/u);
  assert.match(fixture.functionSource(), /^async function \(spec\)/u);
  await exerciseCapturedExactAssistantTurnFunction(fixture.functionSource());
};

const exerciseAtomicFailureClosure = async (): Promise<void> => {
  for (const pendingCause of ["exact-user-turn-unavailable", "adjacent-assistant-missing"] as const) {
    const reply = await execute(runtimeFor({ ...successfulObservation,
      rawCount: 0, rawDomHtml: "", semanticText: "", pendingCause })) as Readonly<Record<string, unknown>>;
    assert.equal(reply.pendingCause, pendingCause,
      "a missing exact turn must return a bound negative observation for source readback proof");
    assert.equal(reply.rawDomHtml, "");
    assert.equal(reply.semanticText, "");
    assert.match(String(reply.observationRevisionHash), /^sha256:[a-f0-9]{64}$/u);
  }
  for (const [observation, code] of [
    [{ ...successfulObservation, rawCount: 2, rawDomHtml: "", semanticText: "" },
      "BROWSER_DOM_CANDIDATE_AMBIGUOUS"],
    [{ ...successfulObservation, rawCount: 0, rawDomHtml: "", semanticText: "" },
      "BROWSER_DOM_READ_INVALID"],
    [{ ...successfulObservation, rawDomHtml: "", semanticText: "" }, "BROWSER_DOM_READ_INVALID"],
  ] as const) await assert.rejects(execute(runtimeFor(observation)), new RegExp(code, "u"));
  await assert.rejects(execute(runtimeFor({ ...successfulObservation,
    currentUrl: "https://chatgpt.com/c/another-conversation", rawDomHtml: "", semanticText: "" })),
  /BROWSER_DOCUMENT_INVALID/u,
  "a canonical conversation mismatch must fail closed instead of becoming retryable candidate missing");
  await assert.rejects(execute(runtimeFor(successfulObservation, ["loader-current", "loader-next"])),
    /BROWSER_DOCUMENT_INVALID/u,
    "a main-frame change during the single observation must invalidate the whole reply");
  const wrongLoader = runtimeFor(successfulObservation, ["loader-next"]);
  await assert.rejects(execute(wrongLoader), /BROWSER_DOCUMENT_INVALID/u);
  assert.equal(wrongLoader.callCount(), 0, "loader drift must stop before scan or scroll");
  await assert.rejects(executeRegisteredDomIntent(
    runtimeFor(successfulObservation).runtime,
    target,
    { kind: "readExactAssistantTurn", turnMarker: "fixture-marker",
      canonicalConversationUrl: "https://chatgpt.com/c/exact" },
    () => undefined,
  ), /BROWSER_DOCUMENT_INVALID/u,
  "the exact assistant reply must be bound to the Authority-owned current loader");
};


const unavailableObservation = Object.freeze({ ...successfulObservation,
  rawCount: 0, rawDomHtml: "", semanticText: "", precedingUserTurnId: "",
  pendingCause: "exact-user-turn-unavailable" });

type ScanStep = Readonly<{
  documentValid: boolean; containerFound: boolean; atTop: boolean; ids: readonly string[];
  scrollTop: number; nextScrollTop: number;
}>;
const observedUserTurnId = "00000000-0000-4000-8000-000000000001";
const anotherUserTurnId = "00000000-0000-4000-8000-000000000003";
const step = (ids: readonly string[], atTop: boolean, scrollTop: number,
  nextScrollTop = scrollTop): ScanStep => ({
  documentValid: true, containerFound: true, ids, atTop, scrollTop, nextScrollTop,
});

const scanRuntimeFor = (
  steps: readonly ScanStep[], finalObservation: Readonly<Record<string, unknown>> = successfulObservation,
  latencyMs = 0, liveStep?: (spec: Readonly<Record<string, unknown>>) => ScanStep,
) => {
  const methods: string[] = [];
  let scanCalls = 0;
  let mainCalls = 0;
  let scanSource = "";
  const runtime = { async send(_tabId: number, method: string,
    parameters?: Readonly<Record<string, unknown>>) {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    methods.push(method);
    if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-current" } } };
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.releaseObject") return {};
    if (method !== "Runtime.callFunctionOn") throw new Error(`UNEXPECTED_METHOD:${method}`);
    const source = String(parameters?.functionDeclaration ?? "");
    if (source.startsWith("function (spec)")) {
      scanSource = source;
      const value = liveStep
        ? liveStep(((parameters?.arguments as readonly Readonly<{ value: Record<string, unknown> }>[])?.[0]?.value) ?? {})
        : steps[scanCalls];
      scanCalls += 1;
      if (!value) throw new Error("UNEXPECTED_SCAN_STEP");
      return { result: { value } };
    }
    mainCalls += 1;
    return { result: { value: finalObservation } };
  } } as ExtensionDebuggerRuntime;
  return { runtime, methods, scanCalls: () => scanCalls, mainCalls: () => mainCalls,
    scanSource: () => scanSource };
};

const withFakeExtensionClock = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  let now = Date.now();
  Date.now = () => now;
  globalThis.setTimeout = ((handler: (...args: unknown[]) => void, timeoutMs?: number) => {
    now += typeof timeoutMs === "number" ? timeoutMs : 0;
    handler();
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try { return await run(); }
  finally { Date.now = originalNow; globalThis.setTimeout = originalSetTimeout; }
};

const scan = (fixture: ReturnType<typeof scanRuntimeFor>, deadlineAt: number) =>
  executeRegisteredDomIntent(fixture.runtime, target,
    { kind: "readExactAssistantTurn", turnMarker: "fixture-marker",
      canonicalConversationUrl: exactConversationFixtureUrl },
    () => undefined, "loader-current", deadlineAt);

const exerciseReverseScrollMaterialization = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const fixture = scanRuntimeFor([step([observedUserTurnId], false, 0)]);
    await scan(fixture, Date.now() + 20_000);
    const body = new FakeElement("", {}, {}, {}, "BODY");
    const turn = new FakeElement("other turn", {}, {}, { "data-turn-key": anotherUserTurnId });
    const container = new FakeElement("", {}, {}, {}, "DIV", [turn]);
    container.parentElement = body;
    let scrollTop = 0;
    let writes = 0;
    Object.defineProperty(container, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => { writes += 1; scrollTop = Math.max(-66_697, Math.min(0, value)); },
    });
    Object.assign(container, { clientHeight: 955, scrollHeight: 67_652 });
    const targetTurn = capturedAssistantFixture().assistantOuter(new FakeElement("answer"));
    const pageDocument = { visibilityState: "hidden", body,
      querySelectorAll: () => scrollTop <= -65_000 ? [targetTurn] : [turn], scrollingElement: null };
    const spec = { turnMarker: "fixture-marker", canonicalConversationUrl: exactConversationFixtureUrl };
    const expectedLocation = new URL(exactConversationFixtureUrl);
    const implementation = runInNewContext(`(${fixture.scanSource()})`, {
      document: pageDocument,
      URL,
      location: { origin: expectedLocation.origin, pathname: expectedLocation.pathname },
      getComputedStyle: () => ({ overflowY: "auto", flexDirection: "column-reverse" }),
    }) as (spec: Readonly<Record<string, unknown>>) => ScanStep;
    const mounted = capturedAssistantFixture().assistantOuter(new FakeElement("answer"));
    const mountedDocument = { visibilityState: "hidden", body,
      querySelectorAll: () => [mounted], scrollingElement: null };
    const hiddenMounted = runInNewContext(`(${fixture.scanSource()})`, {
      document: mountedDocument,
      URL,
      location: { origin: expectedLocation.origin, pathname: expectedLocation.pathname },
    }) as (spec: Readonly<Record<string, unknown>>) => ScanStep;
    assert.deepEqual([...hiddenMounted.call(mountedDocument, { ...spec, initial: true }).ids],
      [observedUserTurnId], "a hidden tab with the exact turn mounted must be readable");
    assert.equal(implementation.call(pageDocument, { ...spec, initial: true }).nextScrollTop, 0);
    assert.equal(writes, 0, "initial read must not touch scrollTop even on a hidden tab");
    implementation.call(pageDocument, { ...spec, resetBottom: true });
    let samples = 0;
    for (; samples < 100; samples += 1) {
      const result = implementation.call(pageDocument, spec);
      if (result.ids.length === 1) break;
      assert.ok(result.nextScrollTop < result.scrollTop, "reverse scroll must advance toward the real top");
    }
    assert.ok(samples > 80 && samples < 100, "page geometry requires more than the retired 80-step cap");
    assert.ok(scrollTop <= -65_000);
    scrollTop = 0;
    const live = scanRuntimeFor([], successfulObservation, 80,
      (options) => implementation.call(pageDocument, options));
    const observed = await scan(live, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.ok(live.scanCalls() > 80, "integrated scan must discover a marker mounted after 80 geometry steps");
    assert.equal(observed.semanticText, successfulObservation.semanticText);
    assert.equal(live.mainCalls(), 1);
    assert.equal(live.methods.some((method) => method.startsWith("Input.")), false);
    const priorWrites = writes;
    const wrongUrl = runInNewContext(`(${fixture.scanSource()})`, {
      document: pageDocument,
      URL,
      location: { origin: expectedLocation.origin, pathname: "/c/another" },
    }) as (spec: Readonly<Record<string, unknown>>) => ScanStep;
    assert.equal(wrongUrl.call(pageDocument, spec).documentValid, false);
    assert.equal(implementation.call({}, spec).documentValid, false,
      "a stale Document object must fail before a scroll mutation");
    assert.equal(writes, priorWrites, "URL drift must fail before any scroll mutation");
  });
};

export const exerciseExactAssistantMaterialization = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const fixture = scanRuntimeFor([step([observedUserTurnId], false, 0)]);
    const result = await scan(fixture, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(fixture.scanCalls(), 1, "a mounted answer needs no history scan");
    assert.equal(fixture.mainCalls(), 1);
    assert.equal(result.semanticText, successfulObservation.semanticText);
    assert.equal(fixture.methods.some((method) => method.startsWith("Input.")), false);
    assert.doesNotMatch(fixture.scanSource(), /visibilityState|MATERIALIZE_STEP_MAX_COUNT/u);
  });
  await withFakeExtensionClock(async () => {
    const duplicate = scanRuntimeFor([step([observedUserTurnId, anotherUserTurnId], false, 0)]);
    await assert.rejects(scan(duplicate, Date.now() + 20_000), /BROWSER_DOM_CANDIDATE_AMBIGUOUS/u);
    assert.equal(duplicate.mainCalls(), 0);
  });
  await withFakeExtensionClock(async () => {
    const drift = scanRuntimeFor([step([], false, 0), step([], false, 0),
      { ...step([], false, 0), documentValid: false }]);
    await assert.rejects(scan(drift, Date.now() + 20_000), /BROWSER_DOCUMENT_INVALID/u);
    assert.equal(drift.mainCalls(), 0, "identity drift during scanning must stop before final read");
  });
  await withFakeExtensionClock(async () => {
    const unavailable = scanRuntimeFor([step([], false, 0), step([], false, 0), step([], true, -100)],
      unavailableObservation);
    const result = await scan(unavailable, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.pendingCause, "exact-user-turn-unavailable");
  });
  await withFakeExtensionClock(async () => {
    const stalled = scanRuntimeFor([step([], false, 0), step([], false, 0),
      step([], false, 0, 0), step([], false, 0)],
      unavailableObservation);
    const result = await scan(stalled, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.pendingCause, "exact-user-turn-unavailable");
  });
  await withFakeExtensionClock(async () => {
    const delayed = scanRuntimeFor([step([], false, 0), step([], false, 0),
      step([], false, 0, 0), step([], false, -100), step([observedUserTurnId], false, -100)]);
    const result = await scan(delayed, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.semanticText, successfulObservation.semanticText,
      "a delayed scroll update must be sampled before declaring no progress");
  });
  await withFakeExtensionClock(async () => {
    const deadline = Date.now() + 3_100;
    const shortBudget = scanRuntimeFor([step([], false, 0)], unavailableObservation);
    const result = await scan(shortBudget, deadline) as Readonly<Record<string, unknown>>;
    assert.equal(result.pendingCause, "exact-user-turn-unavailable");
    assert.equal(shortBudget.scanCalls(), 1, "short budget permits only the initial mounted-DOM check");
  });
  await exerciseReverseScrollMaterialization();
  await withFakeExtensionClock(async () => {
    const noScroll = scanRuntimeFor([{
      documentValid: true, containerFound: false, atTop: true, ids: [observedUserTurnId],
      scrollTop: 0, nextScrollTop: 0,
    }]);
    const result = await scan(noScroll, Date.now() + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.semanticText, successfulObservation.semanticText);
  });
};

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseSingleAtomicRead();
  await exerciseAtomicFailureClosure();
  await exerciseExactAssistantMaterialization();
};
