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

const execute = (fixture: ReturnType<typeof runtimeFor>): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  target,
  { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
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
    text, turnsSelector, user, userSelector };
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
    const observed = await executeCaptured(source, {
      querySelectorAll: (value: string) => value === fixture.userSelector ? [fixture.user]
        : value === fixture.turnsSelector ? [fixture.user, fixture.assistantOuter(node)] : [],
      elementFromPoint: () => null,
    }, fixture.input, exactConversationFixtureUrl) as Readonly<{
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
  const missingAssistant = await executeCaptured(source, {
    querySelectorAll: (value: string) => value === fixture.userSelector ? [fixture.user]
      : value === fixture.turnsSelector ? [fixture.user] : [],
    elementFromPoint: () => null,
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{
    rawCount: number; pendingCause: string | null; observedAt: string;
  }>;
  assert.equal(missingAssistant.rawCount, 0);
  assert.equal(missingAssistant.pendingCause, "adjacent-assistant-missing");
  const ambiguous = await executeCaptured(source, {
    querySelectorAll: (value: string) => value === fixture.userSelector ? [fixture.user]
      : value === fixture.turnsSelector ? [fixture.user, new FakeElement("ambiguous", {
        "[data-message-author-role='assistant']": [fixture.assistant, fixture.assistant],
      }, {}, { "data-testid": "conversation-turn-2" })]
        : [],
    elementFromPoint: () => fixture.assistant,
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{ rawCount: number }>;
  assert.equal(ambiguous.rawCount, 2);
  const rich = richSemanticTree();
  const richObserved = await executeCaptured(source, {
    querySelectorAll: (value: string) => value === fixture.userSelector ? [fixture.user]
      : value === fixture.turnsSelector ? [fixture.user, fixture.assistantOuter(rich)]
        : [],
    elementFromPoint: () => rich,
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{ semanticText: string }>;
  assert.equal(richObserved.semanticText, RICH_SEMANTIC_TEXT,
    "exact assistant read must preserve headings, prose, lists, inline code, the code block, and trailing prose");
  const laterTurn = new FakeElement("later", {}, {}, { "data-testid": "conversation-turn-3" });
  const drifted = await executeCaptured(source, { ...fixture.document,
    querySelectorAll: (value: string) => value === fixture.turnsSelector
      ? [fixture.user, fixture.assistantOuter(fixture.assistant), laterTurn]
      : fixture.document.querySelectorAll(value),
  }, fixture.input, exactConversationFixtureUrl) as Readonly<{
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

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseSingleAtomicRead();
  await exerciseAtomicFailureClosure();
};
