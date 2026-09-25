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
  observedAt: exactAssistantObservedAt, pendingCause: null, nativeStage: "runtime-call-function-on",
});
export const exactConversationFixtureUrl = successfulAssistantObservation.currentUrl;

export const exactAssistantRuntimeFor = (
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
        { kind: "readExactAssistantTurn", userTurnId: "00000000-0000-4000-8000-000000000001",
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

export const executeExactAssistantFixture = (
  fixture: ReturnType<typeof exactAssistantRuntimeFor>,
  commandDeadlineAt?: number,
): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  exactAssistantTarget,
  { kind: "readExactAssistantTurn", userTurnId: "00000000-0000-4000-8000-000000000001",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
  commandDeadlineAt,
);
