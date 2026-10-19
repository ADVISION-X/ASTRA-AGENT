import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";

export const browserDomFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", ...overrides,
});

const infrastructureReplies: Readonly<Record<string, unknown>> = Object.freeze({
  "Page.getFrameTree": { frameTree: { frame: { loaderId: "loader-current" } } },
  "Page.getNavigationHistory": { currentIndex: 0,
    entries: [{ url: "https://chatgpt.com/", title: "ChatGPT" }] },
  "DOM.getDocument": { root: { nodeId: 1 } },
  "DOM.requestNode": { nodeId: 7 },
  "Runtime.releaseObject": {},
});

export const mutationInfrastructureReply = (
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration ?? "").includes("browserExactEditableText(this)")) return undefined;
  let reply = infrastructureReplies[method];
  if (method === "DOM.resolveNode") reply = { object: {
    objectId: parameters?.nodeId === 1 ? "candidate-root" : `node-${parameters?.nodeId}`,
  } };
  if (method === "Runtime.callFunctionOn") reply = { result: { value: browserDomFacts() } };
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === false) {
    reply = { result: { type: "object", subtype: "node", objectId: "candidate-node" } };
  }
  if (method === "Runtime.callFunctionOn" && parameters?.returnByValue === true
    && String(parameters.functionDeclaration).includes("spec.output")) {
    reply = { result: { value: { x: 5, y: 5 } } };
  }
  return reply;
};

export const exactAssistantTarget = Object.freeze({chromeTargetId: "chrome-target-fixture",
  tabId: 111, targetRef: "target-111", documentRef: "document-11", navigationEpoch: 11,
  jobRefHash: `sha256:${"a".repeat(64)}` as const, loaderId: "loader-current",
});
export const exactAssistantObservedAt = "2026-09-04T00:00:00.000Z";
export const successfulAssistantObservation = Object.freeze({
  rawCount: 1,
  rawDomHtml: "<div><strong>complete</strong></div>", semanticText: "**complete**",
  currentUrl: "https://chatgpt.com/c/exact",
  assistantTurnId: "00000000-0000-4000-8000-000000000002",
  precedingUserTurnId: "00000000-0000-4000-8000-000000000001",
  generatingRaw: 0,
  observedAt: exactAssistantObservedAt, pendingCause: null, nativeStage: "runtime-evaluate",
});
export const exactConversationFixtureUrl = successfulAssistantObservation.currentUrl;

type FixedReadFixtureOptions = Readonly<{
  evaluate?: (expression: string) => Promise<unknown>;
  response?: (phase: "scan" | "answer", expression: string, index: number) => unknown | Promise<unknown>;
  releaseFailure?: Error;
}>;

export const exactAssistantRuntimeFor = (
  observation: Readonly<Record<string, unknown>>,
  loaderIds: readonly string[] = ["loader-current"],
  options: FixedReadFixtureOptions = {},
) => {
  const methods: string[] = [], expressions: string[] = [], released: string[] = [];
  let loaderRead = 0, scanCalls = 0, answerCalls = 0;
  const runtime = { async send(_tabId: number, method: string,
    parameters?: Readonly<Record<string, unknown>>) {
    methods.push(method);
    if (method === "Page.getFrameTree") {
      const loaderId = loaderIds[Math.min(loaderRead++, loaderIds.length - 1)];
      return { frameTree: { frame: { loaderId } } };
    }
    if (method === "Runtime.releaseObject") {
      released.push(String(parameters?.objectId));
      if (options.releaseFailure) throw options.releaseFailure;
      return {};
    }
    assert.equal(method, "Runtime.evaluate", "fixed reads must not acquire Document handles or issue input");
    assert.equal(parameters?.returnByValue, true);
    assert.equal(parameters?.awaitPromise, true);
    assert.equal(parameters?.silent, true);
    const expression = String(parameters?.expression);
    expressions.push(expression);
    const phase = expression.includes("const pendingCause =") ? "answer" : "scan";
    const index = phase === "scan" ? scanCalls++ : answerCalls++;
    if (options.response) return await options.response(phase, expression, index);
    if (options.evaluate) return { result: { value: await options.evaluate(expression) } };
    const value = phase === "answer" ? observation : {
      ids: [successfulAssistantObservation.precedingUserTurnId], containerFound: true,
      atTop: false, scrollTop: 0, nextScrollTop: 0,
    };
    return { result: { value: { kind: "value", value } } };
  } } as ExtensionDebuggerRuntime;
  return { runtime, methods, expressions, released,
    callCount: () => expressions.length, scanCalls: () => scanCalls, answerCalls: () => answerCalls };
};

export const executeExactAssistantFixture = (
  fixture: ReturnType<typeof exactAssistantRuntimeFor>,
  commandDeadlineAt?: number,
): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  exactAssistantTarget,
  { kind: "readExactAssistantTurn", turnMarker: "fixture-marker",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
  commandDeadlineAt,
);
