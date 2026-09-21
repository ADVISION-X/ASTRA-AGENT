import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";

export const exactAssistantTarget = Object.freeze({
  tabId: 111, targetRef: "target-111", documentRef: "document-11", navigationEpoch: 11,
  jobRefHash: `sha256:${"a".repeat(64)}` as const, loaderId: "loader-current",
});
const observedAt = "2026-09-04T00:00:00.000Z";
export const successfulAssistantObservation = Object.freeze({
  rawCount: 1,
  rawDomHtml: "<div><strong>complete</strong></div>", semanticText: "**complete**",
  currentUrl: "https://chatgpt.com/c/exact",
  assistantTurnId: "conversation-turn-2",
  precedingUserTurnId: "conversation-turn-1",
  generatingRaw: 0,
  observedAt, pendingCause: null, nativeStage: "runtime-call-function-on",
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

export const executeExactAssistantFixture = (
  fixture: ReturnType<typeof exactAssistantRuntimeFor>,
  commandDeadlineAt?: number,
): Promise<unknown> => executeRegisteredDomIntent(
  fixture.runtime,
  exactAssistantTarget,
  { kind: "readExactAssistantTurn", userTurnId: "conversation-turn-1",
    canonicalConversationUrl: "https://chatgpt.com/c/exact" },
  () => undefined,
  "loader-current",
  commandDeadlineAt,
);
