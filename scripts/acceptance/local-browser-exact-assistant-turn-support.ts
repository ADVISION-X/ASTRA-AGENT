import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import {
  FakeElement,
  FakeTextNode,
  RICH_SEMANTIC_TEXT,
  execute as executeCaptured,
  richSemanticTree,
} from "./local-browser-dom-function-fixture.js";

const target = Object.freeze({
  tabId: 111, targetRef: "target-111", documentRef: "document-11", navigationEpoch: 11,
  jobRefHash: `sha256:${"a".repeat(64)}` as const, loaderId: "loader-current",
});
const observedAt = "2026-09-04T00:00:00.000Z";
const successfulObservation = Object.freeze({
  rawCount: 1,
  rawDomHtml: "<div><strong>complete</strong></div>", semanticText: "**complete**",
  currentUrl: "https://chatgpt.com/c/exact",
  assistantTurnId: "conversation-turn-2",
  precedingUserTurnId: "conversation-turn-1",
  generatingRaw: 0,
  observedAt, pendingCause: null, nativeStage: "runtime-call-function-on",
});
export const exactConversationFixtureUrl = successfulObservation.currentUrl;

const runtimeFor = (
  observation: Readonly<Record<string, unknown>>,
  loaderIds: readonly string[] = ["loader-current", "loader-current"],
) => {
  const methods: string[] = [];
  let loaderRead = 0;
  let functionSource = "";
  let callCount = 0;
  let releases = 0;
  const runtime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    methods.push(method);
    if (method === "Page.getFrameTree") {
      const loaderId = loaderIds[Math.min(loaderRead, loaderIds.length - 1)];
      loaderRead += 1;
      return { frameTree: { frame: { loaderId } } };
    }
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.callFunctionOn") {
      callCount += 1;
      functionSource = String(parameters?.functionDeclaration ?? "");
      assert.equal(parameters?.objectId, "document-object");
      assert.deepEqual((parameters?.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value,
        { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
          canonicalConversationUrl: "https://chatgpt.com/c/exact" });
      assert.equal(parameters?.returnByValue, true);
      assert.equal(parameters?.awaitPromise, true);
      return { result: { value: observation } };
    }
    if (method === "Runtime.releaseObject") { releases += 1; return {}; }
    throw new Error(`UNEXPECTED_EXACT_ASSISTANT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  return Object.freeze({ runtime, methods, functionSource: () => functionSource,
    callCount: () => callCount, releases: () => releases });
};

const execute = (
  fixture: ReturnType<typeof runtimeFor>,
  commandDeadlineAt?: number,
): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  target,
  { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
  commandDeadlineAt,
);

const capturedAssistantFixture = () => {
  const text = (value: string) => new FakeTextNode(value);
  const paragraph = new FakeElement("bold", {}, {}, {}, "P", [
    new FakeElement("bold", {}, {}, {}, "STRONG", [text("bold")]),
  ]);
  const list = new FakeElement("item", {}, {}, {}, "UL", [
    new FakeElement("item", {}, {}, {}, "LI", [text("item")]),
  ]);
  const assistant = new FakeElement("bold item", { "pre code": [] }, {}, {}, "DIV", [paragraph, list]);
  const userMessage = new FakeElement("provider-folded-message", {}, {}, {}, "DIV", [text("provider-folded-message")]);
  const user = new FakeElement("provider-folded-message", {
    "[data-message-author-role='user']": [userMessage],
  }, {}, { "data-testid": "conversation-turn-1" });
  const assistantOuter = (node: FakeElement) => new FakeElement(node.textContent, {
    "[data-message-author-role='assistant']": [node],
  }, {}, { "data-testid": "conversation-turn-2" }, "SECTION", [node]);
  const userSelector = "[data-testid='conversation-turn-1']:has([data-message-author-role='user'])";
  const turnsSelector = "[data-testid^='conversation-turn-']";
  const input = { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
    canonicalConversationUrl: exactConversationFixtureUrl };
  const exactAssistant = assistantOuter(assistant);
  const turns = (laterTurns: readonly FakeElement[], pointed: FakeElement | null) => ({
    querySelectorAll: (value: string) => value === userSelector ? [user]
      : value === turnsSelector ? [user, ...laterTurns] : [],
    elementFromPoint: () => pointed,
  });
  let queryCalls = 0;
  const document = {
    querySelectorAll: (value: string) => {
      queryCalls += 1;
      return value === userSelector ? [user] : value === turnsSelector ? [user, exactAssistant]
        : [];
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
  assert.equal(fixture.queryCalls(), 3,
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
  assert.equal(observed.rawCount, 1);
  assert.match(observed.rawDomHtml, /<strong>bold<\/strong>/u);
  assert.equal(observed.semanticText, "**bold**\n- item\n");
  assert.equal(observed.currentUrl, exactConversationFixtureUrl);
  assert.equal(observed.nativeStage, "runtime-call-function-on");
  const generatingObserved = await executeCaptured(source, { ...fixture.document,
    querySelectorAll: (value: string) => value === "#composer-submit-button[data-testid='stop-button']"
      ? [fixture.assistant] : fixture.document.querySelectorAll(value),
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
  const ambiguous = await executeCaptured(source, fixture.turns([new FakeElement("ambiguous", {
    "[data-message-author-role='assistant']": [fixture.assistant, fixture.assistant],
  }, {}, { "data-testid": "conversation-turn-2" })], fixture.assistant),
  fixture.input, exactConversationFixtureUrl) as Readonly<{ rawCount: number }>;
  assert.equal(ambiguous.rawCount, 2);
  const rich = richSemanticTree();
  const richObserved = await executeCaptured(source, fixture.turns([fixture.assistantOuter(rich)], rich),
    fixture.input, exactConversationFixtureUrl) as Readonly<{ semanticText: string }>;
  assert.equal(richObserved.semanticText, RICH_SEMANTIC_TEXT,
    "exact assistant read must preserve headings, prose, lists, inline code, the code block, and trailing prose");
  const laterTurn = new FakeElement("later", {}, {}, { "data-testid": "conversation-turn-3" });
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
  assert.equal(fixture.callCount(), 1,
    "candidate identity, raw HTML, and semantic text must share one Runtime.callFunctionOn");
  assert.equal(fixture.releases(), 1);
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
  for (const [observation, code] of [
    [{ ...successfulObservation, rawCount: 0, rawDomHtml: "", semanticText: "",
      pendingCause: "exact-user-turn-unavailable" }, "BROWSER_EXACT_USER_TURN_UNAVAILABLE"],
    [{ ...successfulObservation, rawCount: 0, rawDomHtml: "", semanticText: "",
      pendingCause: "adjacent-assistant-missing" }, "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING"],
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
    { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
      canonicalConversationUrl: "https://chatgpt.com/c/exact" },
    () => undefined,
  ), /BROWSER_DOCUMENT_INVALID/u,
  "the exact assistant reply must be bound to the Authority-owned current loader");
};

const unavailableObservation = Object.freeze({ ...successfulObservation,
  rawCount: 0, rawDomHtml: "", semanticText: "", pendingCause: "exact-user-turn-unavailable" });

type MaterializeStepBehavior = Readonly<{
  pageVisible: boolean; containerFound: boolean; hit: boolean; atTop: boolean;
}>;

const materializeRuntimeFor = (options: Readonly<{
  steps: readonly MaterializeStepBehavior[];
  finalObservation?: Readonly<Record<string, unknown>>;
}>) => {
  const methods: string[] = [];
  const materializeStepElapsedMs: number[] = [];
  const startedAt = Date.now();
  let mainCallCount = 0;
  let materializeCallCount = 0;
  let releases = 0;
  let materializeFunctionSource = "";
  const runtime = { async send(
    _tabId: number,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) {
    methods.push(method);
    if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-current" } } };
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.resolveNode") return { object: { objectId: "document-object" } };
    if (method === "Runtime.callFunctionOn") {
      const argValue: Readonly<Record<string, unknown>> | undefined =
        (parameters?.arguments as readonly Readonly<{ value: unknown }>[])?.[0]?.value as
          Readonly<Record<string, unknown>> | undefined;
      if (typeof argValue?.step === "number") {
        materializeFunctionSource = String(parameters?.functionDeclaration ?? "");
        materializeStepElapsedMs.push(Date.now() - startedAt);
        const behavior = options.steps[materializeCallCount];
        materializeCallCount += 1;
        if (!behavior) throw new Error("UNEXPECTED_MATERIALIZE_STEP_CALL");
        return { result: { value: behavior } };
      }
      mainCallCount += 1;
      const observation = mainCallCount === 1 ? unavailableObservation
        : (options.finalObservation ?? unavailableObservation);
      return { result: { value: observation } };
    }
    if (method === "Runtime.releaseObject") { releases += 1; return {}; }
    throw new Error(`UNEXPECTED_EXACT_ASSISTANT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  return Object.freeze({
    runtime, methods,
    mainCallCount: () => mainCallCount,
    materializeCallCount: () => materializeCallCount,
    materializeStepElapsedMs,
    materializeFunctionSource: () => materializeFunctionSource,
    releases: () => releases,
  });
};

const withFakeExtensionClock = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  let now = Date.now();
  Date.now = () => now;
  globalThis.setTimeout = ((handler: (...args: unknown[]) => void, timeoutMs?: number) => {
    now += typeof timeoutMs === "number" ? timeoutMs : 0;
    handler();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  try {
    return await run();
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
  }
};

const materialize = (
  fixture: ReturnType<typeof materializeRuntimeFor>,
  commandDeadlineAt: number,
): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  target,
  { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
  commandDeadlineAt,
);

// T3.1: a virtualized turn is found after stepping, and read back exactly as if it had been
// mounted from the start; a materialization walk that never advances (never hits, never reaches
// the top) still fails closed instead of looping forever.
const exerciseMaterializationHit = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const hitAtStep3 = materializeRuntimeFor({
      steps: [
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: true, atTop: false },
      ],
      finalObservation: successfulObservation,
    });
    const materialized = await materialize(hitAtStep3, start + 20_000);
    assert.equal(hitAtStep3.materializeCallCount(), 3, "the walk must stop at the step that hits");
    assert.equal(hitAtStep3.mainCallCount(), 2,
      "an unavailable read followed by exactly one re-read after materialization");
    const alreadyMounted = await execute(runtimeFor(successfulObservation));
    assert.deepEqual(materialized, alreadyMounted,
      "T3.7: a hit-after-materialization reply must equal the already-mounted control exactly");
  });
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const neverHits = materializeRuntimeFor({
      steps: Array.from({ length: 40 },
        () => ({ pageVisible: true, containerFound: true, hit: false, atTop: false } as const)),
    });
    await assert.rejects(materialize(neverHits, start + 20_000),
      /BROWSER_EXACT_USER_TURN_UNAVAILABLE/u,
      "T3.1: a walk that never hits and never reaches the top must still fail closed on deadline");
  });
};

// T3.2: less than 4s of remaining budget must skip stepping entirely.
const exerciseMaterializationInsufficientBudget = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const fixture = materializeRuntimeFor({ steps: [] });
    await assert.rejects(materialize(fixture, start + 5_000),
      /BROWSER_EXACT_USER_TURN_UNAVAILABLE/u);
    assert.equal(fixture.materializeCallCount(), 0, "budget under 4s must trigger zero steps");
    assert.equal(fixture.mainCallCount(), 2, "the unavailable observation is still re-read once");
  });
};

// T3.3: no scroll container found must resolve unavailable after exactly one step.
const exerciseMaterializationNoContainer = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const fixture = materializeRuntimeFor({
      steps: [{ pageVisible: true, containerFound: false, hit: false, atTop: false }],
    });
    await assert.rejects(materialize(fixture, start + 20_000),
      /BROWSER_EXACT_USER_TURN_UNAVAILABLE/u);
    assert.equal(fixture.materializeCallCount(), 1);
  });
};

// T3.3b: a hidden document must stop after the first step with no further step calls.
const exerciseMaterializationHiddenDocument = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const fixture = materializeRuntimeFor({
      steps: [{ pageVisible: false, containerFound: false, hit: false, atTop: false }],
    });
    await assert.rejects(materialize(fixture, start + 20_000),
      /BROWSER_EXACT_USER_TURN_UNAVAILABLE/u);
    assert.equal(fixture.materializeCallCount(), 1,
      "a hidden document must not receive any step after the first observes it hidden");
  });
};

// T3.4: exhausting the step cap or the deadline must resolve unavailable, and the extension-side
// walk must not overrun the granted budget by more than 1s.
const exerciseMaterializationBudgetExhausted = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const budgetMs = 12_000;
    const neverSettles = materializeRuntimeFor({
      steps: Array.from({ length: 48 },
        () => ({ pageVisible: true, containerFound: true, hit: false, atTop: false } as const)),
    });
    await assert.rejects(materialize(neverSettles, start + budgetMs + 3_000),
      /BROWSER_EXACT_USER_TURN_UNAVAILABLE/u);
    assert.ok(neverSettles.materializeCallCount() <= 48, "the walk must never exceed the step cap");
    const elapsedMs = Date.now() - start;
    assert.ok(elapsedMs <= budgetMs + 1_000,
      `extension-side elapsed time ${elapsedMs}ms must stay within budget + 1s`);
    assert.ok(elapsedMs >= budgetMs - 1_000, "the walk must actually consume close to its budget");
  });
};

// T3.5: the walk advances purely on the extension's own clock; nothing about a step depends on a
// page-owned timer or rAF firing, so a page whose own timers never fire cannot stall or skip it.
const exerciseMaterializationExtensionOwnedClock = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const hitAtStep5 = materializeRuntimeFor({
      steps: [
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: false, atTop: false },
        { pageVisible: true, containerFound: true, hit: true, atTop: false },
      ],
      finalObservation: successfulObservation,
    });
    await materialize(hitAtStep5, start + 20_000);
    assert.deepEqual([...hitAtStep5.materializeStepElapsedMs], [0, 400, 800, 1200, 1600],
      "each step must be spaced by exactly the extension-owned interval, independent of page timers");
  });
};

// T3.6: the walk must never dispatch a CDP input event or write a WAL row (readExactAssistantTurn
// is never mutation-class, so no WAL path is even reachable here), and the page-injected step
// function must be free of setTimeout/requestAnimationFrame/Promise so the extension owns every wait.
const exerciseMaterializationNoSideEffects = async (): Promise<void> => {
  await withFakeExtensionClock(async () => {
    const start = Date.now();
    const hitAtStep1 = materializeRuntimeFor({
      steps: [{ pageVisible: true, containerFound: true, hit: true, atTop: false }],
      finalObservation: successfulObservation,
    });
    await materialize(hitAtStep1, start + 20_000);
    assert.equal(hitAtStep1.methods.some((method) => method.startsWith("Input.")), false,
      "no CDP input event may be dispatched during materialization");
    assert.deepEqual(new Set(hitAtStep1.methods), new Set([
      "Page.getFrameTree", "DOM.getDocument", "DOM.resolveNode",
      "Runtime.callFunctionOn", "Runtime.releaseObject",
    ]), "only read-only CDP methods may be used; none of them are mutation-class");
    assert.doesNotMatch(hitAtStep1.materializeFunctionSource(),
      /setTimeout|requestAnimationFrame|new Promise|\.then\(/u,
      "the page-injected step function must contain no timer, rAF, or Promise");
  });
};

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseSingleAtomicRead();
  await exerciseAtomicFailureClosure();
  await exerciseMaterializationHit();
  await exerciseMaterializationInsufficientBudget();
  await exerciseMaterializationNoContainer();
  await exerciseMaterializationHiddenDocument();
  await exerciseMaterializationBudgetExhausted();
  await exerciseMaterializationExtensionOwnedClock();
  await exerciseMaterializationNoSideEffects();
};
