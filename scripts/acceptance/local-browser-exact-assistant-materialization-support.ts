import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import {
  exactAssistantRuntimeFor,
  exactAssistantTarget,
  executeExactAssistantFixture,
  successfulAssistantObservation,
} from "./local-browser-exact-assistant-turn-fixture.js";

const unavailableObservation = Object.freeze({ ...successfulAssistantObservation,
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
    return originalSetTimeout(() => undefined, 0);
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
  exactAssistantTarget,
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
      finalObservation: successfulAssistantObservation,
    });
    const materialized = await materialize(hitAtStep3, start + 20_000);
    assert.equal(hitAtStep3.materializeCallCount(), 3, "the walk must stop at the step that hits");
    assert.equal(hitAtStep3.mainCallCount(), 2,
      "an unavailable read followed by exactly one re-read after materialization");
    const alreadyMounted = await executeExactAssistantFixture(
      exactAssistantRuntimeFor(successfulAssistantObservation),
    );
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
      finalObservation: successfulAssistantObservation,
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
      finalObservation: successfulAssistantObservation,
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

export const exerciseExactAssistantMaterialization = async (): Promise<void> => {
  await exerciseMaterializationHit();
  await exerciseMaterializationInsufficientBudget();
  await exerciseMaterializationNoContainer();
  await exerciseMaterializationHiddenDocument();
  await exerciseMaterializationBudgetExhausted();
  await exerciseMaterializationExtensionOwnedClock();
  await exerciseMaterializationNoSideEffects();
};
