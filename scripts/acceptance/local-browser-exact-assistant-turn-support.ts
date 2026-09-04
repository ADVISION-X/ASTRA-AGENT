import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { exerciseCapturedExactAssistantTurnFunction } from
  "./local-browser-dom-function-support.js";

const target = Object.freeze({
  tabId: 111, targetRef: "target-111", documentRef: "document-11", navigationEpoch: 11,
});
const observedAt = "2026-09-04T00:00:00.000Z";
const successfulObservation = Object.freeze({
  rawCount: 1, eligibleCount: 1,
  rawDomHtml: "<div><strong>complete</strong></div>", semanticText: "**complete**",
  observedAt, nativeCauseCode: null, nativeStage: "runtime-call-function-on",
});

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
        "conversation-turn-2");
      assert.equal(parameters?.returnByValue, true);
      assert.equal(parameters?.awaitPromise, false);
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
  { kind: "readExactAssistantTurn", assistantTurnId: "conversation-turn-2" },
  () => undefined,
  "loader-current",
);

const exerciseSingleAtomicRead = async (): Promise<void> => {
  const fixture = runtimeFor(successfulObservation);
  const reply = await execute(fixture) as Readonly<Record<string, unknown>>;
  assert.equal(fixture.callCount(), 1,
    "candidate selection, eligibility, raw HTML, and semantic text must share one Runtime.callFunctionOn");
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
  assert.match(fixture.functionSource(), /^function \(assistantTurnId\)/u);
  exerciseCapturedExactAssistantTurnFunction(fixture.functionSource());
};

const exerciseAtomicFailureClosure = async (): Promise<void> => {
  for (const [observation, code] of [
    [{ ...successfulObservation, rawCount: 0, eligibleCount: 0, rawDomHtml: "", semanticText: "" },
      "BROWSER_DOM_CANDIDATE_MISSING"],
    [{ ...successfulObservation, rawCount: 2, eligibleCount: 0, rawDomHtml: "", semanticText: "" },
      "BROWSER_DOM_CANDIDATE_AMBIGUOUS"],
    [{ ...successfulObservation, rawCount: 1, eligibleCount: 0, rawDomHtml: "", semanticText: "" },
      "BROWSER_DOM_CANDIDATE_MISSING"],
  ] as const) await assert.rejects(execute(runtimeFor(observation)), new RegExp(code, "u"));
  await assert.rejects(execute(runtimeFor(successfulObservation, ["loader-current", "loader-next"])),
    /BROWSER_DOCUMENT_INVALID/u,
    "a main-frame change during the single observation must invalidate the whole reply");
  await assert.rejects(executeRegisteredDomIntent(
    runtimeFor(successfulObservation).runtime,
    target,
    { kind: "readExactAssistantTurn", assistantTurnId: "conversation-turn-2" },
    () => undefined,
  ), /BROWSER_DOCUMENT_INVALID/u,
  "the exact assistant reply must be bound to the Authority-owned current loader");
};

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseSingleAtomicRead();
  await exerciseAtomicFailureClosure();
};
