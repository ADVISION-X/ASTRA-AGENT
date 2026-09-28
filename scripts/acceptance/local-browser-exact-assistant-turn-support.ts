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
  assert.equal(fixture.methods.filter((method) => method === "Page.getFrameTree").length, 2);
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
  pageVisible: boolean; containerFound: boolean; atTop: boolean;
  ids: readonly string[]; scrollTop: number;
}>;
const observedUserTurnId = "00000000-0000-4000-8000-000000000001";
const anotherUserTurnId = "00000000-0000-4000-8000-000000000003";
const step = (ids: readonly string[], atTop: boolean, scrollTop: number): ScanStep => ({
  pageVisible: true, containerFound: true, ids, atTop, scrollTop,
});

const scanRuntimeFor = (
  steps: readonly ScanStep[], finalObservation: Readonly<Record<string, unknown>> = successfulObservation,
) => {
  const methods: string[] = [];
  let scanCalls = 0;
  let mainCalls = 0;
  let scanSource = "";
  const runtime = { async send(_tabId: number, method: string,
    parameters?: Readonly<Record<string, unknown>>) {
    methods.push(method);
    if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-current" } } };
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.releaseObject") return {};
    if (method !== "Runtime.callFunctionOn") throw new Error(`UNEXPECTED_METHOD:${method}`);
    const source = String(parameters?.functionDeclaration ?? "");
    if (source.startsWith("function (spec)")) {
      scanSource = source;
      const value = steps[scanCalls++];
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

export const exerciseExactAssistantMaterialization = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const fixture = scanRuntimeFor([
      step([], false, 1_000), step([observedUserTurnId], false, 800),
      step([], false, 400), step([], true, 0), step([], false, 800),
    ]);
    const result = await scan(fixture, start + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(fixture.scanCalls(), 5,
      "a marker hit must not stop the scan before the whole accessible conversation is covered");
    assert.equal(fixture.mainCalls(), 1);
    assert.equal(result.precedingUserTurnId, observedUserTurnId);
    assert.equal(result.semanticText, successfulObservation.semanticText);
    assert.equal(fixture.methods.some((method) => method.startsWith("Input.")), false);
    assert.doesNotMatch(fixture.scanSource(), /setTimeout|requestAnimationFrame|new Promise/u);
  });
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const duplicate = scanRuntimeFor([
      step([], false, 1_000), step([observedUserTurnId], false, 800),
      step([anotherUserTurnId], true, 0),
    ]);
    await assert.rejects(scan(duplicate, start + 20_000), /BROWSER_DOM_CANDIDATE_AMBIGUOUS/u);
    assert.equal(duplicate.mainCalls(), 0, "duplicate marker must never reach answer settlement");
  });
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const incomplete = scanRuntimeFor(Array.from({ length: 80 },
      (_, index) => step(index === 1 ? [observedUserTurnId] : [], false, 80 - index)),
      unavailableObservation);
    const result = await scan(incomplete, start + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.pendingCause, "exact-user-turn-unavailable",
      "a locally visible marker is not proof of whole-conversation uniqueness");
    assert.ok(incomplete.scanCalls() <= 80);
  });
  await withFakeExtensionClock(async () => {
    const fixture = scanRuntimeFor([step([observedUserTurnId], true, 0)]);
    await scan(fixture, Date.now() + 20_000);
    const body = new FakeElement("", {}, {}, {}, "BODY");
    const turn = capturedAssistantFixture().assistantOuter(new FakeElement("answer"));
    const container = new FakeElement("", {}, {}, {}, "DIV", [turn]);
    container.parentElement = body;
    let scrollTop = 0;
    Object.defineProperty(container, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => { scrollTop = Math.max(-52_961, Math.min(0, value)); },
    });
    Object.assign(container, { clientHeight: 1_007, scrollHeight: 53_968 });
    const implementation = runInNewContext(`(${fixture.scanSource()})`, {
      document: { visibilityState: "visible", body,
        querySelectorAll: () => [turn], scrollingElement: null },
      getComputedStyle: () => ({ overflowY: "auto", flexDirection: "column-reverse" }),
    }) as (spec: Readonly<Record<string, unknown>>) => ScanStep;
    assert.equal(implementation({ turnMarker: "fixture-marker", step: 0 }).scrollTop, 0);
    let reachedTop = false;
    for (let index = 1; index < 80; index += 1) {
      const result = implementation({ turnMarker: "fixture-marker", step: index });
      if (result.atTop) { reachedTop = true; break; }
      if (index === 1) assert.ok(scrollTop < 0, "reverse scroll must move toward negative top");
      if (index === 48) assert.equal(result.atTop, false,
        "the incident's long reverse-scroll page needs more than 48 viewport steps");
    }
    assert.equal(reachedTop, true, "the 80-step bound must cover the incident's scroll height");
    for (const [overflow, mountedTurns] of [
      ["hidden", [turn]], ["auto", [turn, new FakeElement("other turn")]],
    ] as const) {
      const blocked = runInNewContext(`(${fixture.scanSource()})`, {
        document: { visibilityState: "visible", body,
          querySelectorAll: () => mountedTurns,
          scrollingElement: { scrollHeight: 2_000, clientHeight: 1_000 } },
        getComputedStyle: () => ({ overflowY: overflow, flexDirection: "column-reverse" }),
      }) as (spec: Readonly<Record<string, unknown>>) => ScanStep;
      assert.equal(blocked({ turnMarker: "fixture-marker", step: 0 }).atTop, false,
        "an unknown or split scroll root cannot prove full marker uniqueness");
    }
  });
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const noScroll = scanRuntimeFor([{
      pageVisible: true, containerFound: false, atTop: true,
      ids: [observedUserTurnId], scrollTop: 0,
    }]);
    const result = await scan(noScroll, start + 20_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.semanticText, successfulObservation.semanticText);
  });
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const shortBudget = scanRuntimeFor([], unavailableObservation);
    const result = await scan(shortBudget, start + 5_000) as Readonly<Record<string, unknown>>;
    assert.equal(result.pendingCause, "exact-user-turn-unavailable");
    assert.equal(shortBudget.scanCalls(), 0);
  });
};

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseSingleAtomicRead();
  await exerciseAtomicFailureClosure();
  await exerciseExactAssistantMaterialization();
};
