import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { executeExtensionFileInput } from
  "../../src/lib/browser/chrome-extension/extension-file-input-runtime.js";

type FileInputScenario = Readonly<{
  nodeIds: readonly number[];
  facts?: Readonly<Record<string, unknown>>;
  selectedCount?: number;
  approvedSetVerified?: boolean;
  acceptVerified?: boolean;
  driftBeforeDispatch?: boolean;
  failReadback?: boolean;
  onFileInput?: () => void;
  activationResult?: unknown;
  chooserFailure?: "timeout" | "mismatch";
  failInterception?: "enable" | "disable";
  failFileInput?: boolean;
  activationAfterInterception?: boolean;
  interceptionEvents?: boolean[];
  activationOverride?: Readonly<{
    selector: string;
    scope: Readonly<{ selector: string }>;
    expectedTextEquals: string;
  }>;
}>;

const activation = Object.freeze({
  selector: "div.__menu-item[tabindex='0'] span",
  scope: Object.freeze({ selector: "#thread-bottom div.popover[aria-busy='false']" }),
  expectedTextEquals: "从电脑上传",
});

const fileMechanicalFacts = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  connected: true, layout: true, visible: true,
  computedDisplay: "block", computedVisibility: "visible", computedOpacity: "1", effectiveOpacity: "1",
  displayHidden: false, visibilityHidden: false, opacityHidden: false,
  hidden: false, ariaHidden: false, inert: false, disabled: false, ariaDisabled: false,
  role: "", name: "", testId: "", label: "", value: "", checked: null, type: "file",
  bounds: { x: 0, y: 0, width: 10, height: 10 }, viewport: true, hitTest: true,
  nativeCauseCode: null, nativeStage: "runtime-call-function-on", multiple: true, accept: "",
  ...overrides,
});

type ScenarioState = {
  fileInputs: number;
  queries: number;
  targetChecks: number;
  pointerClicks: number;
  interceptionEnabled: number;
  interceptionDisabled: number;
  usedChooserBackendNode: boolean;
  clickedPoints: Array<Readonly<{ x: unknown; y: unknown }>>;
};

const fileDomReply = (
  input: FileInputScenario,
  state: ScenarioState,
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): unknown | undefined => {
  if (method === "Page.getFrameTree") return { frameTree: { frame: { loaderId: "loader-8" } } };
  if (method === "Page.getNavigationHistory") return { currentIndex: 0,
    entries: [{ url: "https://chatgpt.com/", title: "ChatGPT" }] };
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.querySelectorAll") {
    state.queries += 1;
    if (input.failReadback && state.queries > 1) throw new Error("Could not find node with given id");
    return { nodeIds: [...input.nodeIds] };
  }
  if (method === "DOM.describeNode") {
    const attributes = ["type", "file", "accept", String(input.facts?.accept ?? "")];
    if (input.facts?.multiple !== false) attributes.push("multiple", "");
    return { node: { nodeId: parameters?.nodeId, backendNodeId: 700, nodeName: "INPUT", attributes } };
  }
  if (method === "DOM.resolveNode") return { object: { objectId: parameters?.nodeId === 1
    ? "document-root" : `file-node-${parameters?.nodeId}` } };
  if (method === "Runtime.releaseObject") return {};
  return undefined;
};

const runtimeFunctionReply = (
  input: FileInputScenario,
  state: ScenarioState,
  parameters?: Readonly<Record<string, unknown>>,
): unknown => {
  if (String(parameters?.functionDeclaration).includes("approvedSetVerified")) return { result: { value: {
    selectedFileCount: input.selectedCount ?? 2,
    approvedSetVerified: input.approvedSetVerified ?? true,
    acceptVerified: input.acceptVerified ?? true,
  } } };
  const argument = Array.isArray(parameters?.arguments)
    ? parameters.arguments[0] as { value?: { output?: unknown } } | undefined : undefined;
  if (argument?.value?.output === "pointer") return { result: {
    value: input.activationResult ?? (input.activationAfterInterception && state.interceptionEnabled === 0
      ? { x: 1, y: 1 } : { x: 20, y: 30 }),
  } };
  return { result: { value: fileMechanicalFacts(input.facts) } };
};

const interceptionReply = (
  input: FileInputScenario,
  state: ScenarioState,
  parameters?: Readonly<Record<string, unknown>>,
): object => {
  const enabled = parameters?.enabled === true;
  input.interceptionEvents?.push(enabled);
  if (enabled) state.interceptionEnabled += 1;
  if (!enabled) state.interceptionDisabled += 1;
  if ((enabled && input.failInterception === "enable")
    || (!enabled && input.failInterception === "disable")) throw new Error("INTERCEPTION_CONTROL_FAILED");
  return {};
};

const physicalInputReply = (
  input: FileInputScenario,
  state: ScenarioState,
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): object | undefined => {
  if (method === "Input.dispatchMouseEvent") {
    if (parameters?.type === "mouseReleased") {
      state.pointerClicks += 1;
      state.clickedPoints.push({ x: parameters.x, y: parameters.y });
    }
    return {};
  }
  if (method !== "DOM.setFileInputFiles") return undefined;
  state.fileInputs += 1;
  if (input.failFileInput) throw new Error("FILE_INPUT_FAILED");
  state.usedChooserBackendNode = parameters?.backendNodeId === 700 && parameters?.nodeId === undefined;
  input.onFileInput?.();
  return {};
};

const createScenarioRuntime = (
  input: FileInputScenario,
  state: ScenarioState,
): ExtensionDebuggerRuntime => ({
  async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    const dom = fileDomReply(input, state, method, parameters);
    if (dom !== undefined) return dom;
    if (method === "Runtime.callFunctionOn") return runtimeFunctionReply(input, state, parameters);
    if (method === "Page.setInterceptFileChooserDialog") return interceptionReply(input, state, parameters);
    const physical = physicalInputReply(input, state, method, parameters);
    if (physical !== undefined) return physical;
    throw new Error(`UNEXPECTED_FILE_INPUT_METHOD:${method}`);
  },
  async captureFileChooserOpened(_tabId, _timeoutMs, trigger, consume) {
    await trigger();
    if (input.chooserFailure === "timeout") throw new Error("BROWSER_FILE_CHOOSER_TIMEOUT");
    await consume({ backendNodeId: input.chooserFailure === "mismatch" ? 701 : 700 });
  },
}) as ExtensionDebuggerRuntime;

const runFileInputScenario = async (input: FileInputScenario) => {
  const state: ScenarioState = {
    fileInputs: 0, queries: 0, targetChecks: 0, pointerClicks: 0,
    interceptionEnabled: 0, interceptionDisabled: 0, usedChooserBackendNode: false, clickedPoints: [],
  };
  const runtime = createScenarioRuntime(input, state);
  const result = await executeExtensionFileInput({
    runtime,
    target: {chromeTargetId: "chrome-target-fixture",  tabId: 108, targetRef: "target-108", documentRef: "document-8", navigationEpoch: 8,
      jobRefHash: `sha256:${"a".repeat(64)}` as const, loaderId: "loader-current" },
    assertCurrent: () => {
      state.targetChecks += 1;
      if (input.driftBeforeDispatch && state.targetChecks === 3) throw new Error("BROWSER_DOCUMENT_INVALID");
    },
    selector: "#upload-files",
    activation: input.activationOverride ?? activation,
    approvedFiles: [
      { grantRef: "grant-a", contentHash: `sha256:${"a".repeat(64)}`, maxBytes: 10_000 },
      { grantRef: "grant-b", contentHash: `sha256:${"b".repeat(64)}`, maxBytes: 20_000 },
    ],
    resolvedFilePaths: ["/approved/a.pdf", "/approved/b.pdf"],
  });
  return { result, ...state };
};

const exerciseFileChooserEventBinding = async (): Promise<void> => {
  let eventListener: ((
    target: Readonly<{ tabId: number }>,
    method: string,
    parameters?: Readonly<Record<string, unknown>>,
  ) => void) | null = null;
  const runtime = new ExtensionDebuggerRuntime({ debugger: {
    onEvent: { addListener(listener) { eventListener = listener; } },
  } } as ExtensionChromeApi);
  runtime.adoptAttached(108);
  let opened: Readonly<{ backendNodeId: number }> | null = null;
  await runtime.captureFileChooserOpened(108, 100, async () => {
    eventListener?.({ tabId: 108 }, "Page.fileChooserOpened", { backendNodeId: 700 });
  }, async (value) => {
    opened = value;
  });
  assert.deepEqual(opened, { backendNodeId: 700 });
  await assert.rejects(runtime.captureFileChooserOpened(108, 100, async () => {
    eventListener?.({ tabId: 108 }, "Page.fileChooserOpened", { backendNodeId: "forged" });
  }, async () => undefined), /BROWSER_FILE_CHOOSER_MISMATCH/u);
  await assert.rejects(runtime.captureFileChooserOpened(108, 100, async () => {
    eventListener?.({ tabId: 108 }, "Page.fileChooserOpened", { backendNodeId: 700 });
  }, async () => {
    await Promise.resolve();
    eventListener?.({ tabId: 108 }, "Page.fileChooserOpened", { backendNodeId: 700 });
  }), /BROWSER_FILE_CHOOSER_MISMATCH/u,
  "one governed click must not accept more than one chooser event");
  await assert.rejects(runtime.captureFileChooserOpened(108, 10, async () => {
    eventListener?.({ tabId: 108 }, "Page.fileChooserOpened", { backendNodeId: 700 });
    await new Promise<void>(() => undefined);
  }, async () => undefined), /BROWSER_FILE_CHOOSER_TIMEOUT/u,
  "the chooser deadline must still bound a trigger that hangs after the first event");
};

const exerciseSuccessfulAndRejectedCandidates = async (): Promise<void> => {
  await assert.rejects(runFileInputScenario({ nodeIds: [7], activationOverride: {
    ...activation, expectedTextEquals: "模糊上传",
  } }), /BROWSER_FILE_GRANT_INVALID/u,
  "Browser must reject caller-authored or drifted chooser activation semantics before physical input");
  const success = await runFileInputScenario({ nodeIds: [7], selectedCount: 2 });
  assert.deepEqual(success.result, {
    selectedFileCount: 2, candidateCount: 1, identityRevalidated: true,
    approvedSetVerified: true, acceptVerified: true, mutationCount: 1, postconditionVerified: true,
  });
  assert.equal(success.fileInputs, 1, "the complete approved set must use one physical file-input command");
  assert.equal(success.pointerClicks, 1, "the exact visible Provider upload leaf must be clicked once");
  assert.equal(success.interceptionEnabled, 1);
  assert.equal(success.interceptionDisabled, 1);
  assert.equal(success.usedChooserBackendNode, true,
    "the approved set must bind to the exact chooser backend node, never a direct hidden nodeId path");
  const redrawn = await runFileInputScenario({
    nodeIds: [7], selectedCount: 2, activationAfterInterception: true,
  });
  assert.deepEqual(redrawn.clickedPoints, [{ x: 20, y: 30 }],
    "the visible leaf must be freshly resolved only after chooser interception is active");
  assert.ok(success.targetChecks >= 6, "Target and Document must be rebound before and after the physical input");
  for (const [scenario, expectedCount, expectedCode, qualificationStage] of [
    [{ nodeIds: [] }, 0, "BROWSER_DOM_CANDIDATE_MISSING", "candidate-set"],
    [{ nodeIds: [7, 8] }, 2, "BROWSER_DOM_CANDIDATE_AMBIGUOUS", "candidate-set"],
    [{ nodeIds: [7], facts: { disabled: true } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
    [{ nodeIds: [7], facts: { multiple: false } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
    [{ nodeIds: [7], facts: { accept: "not-an-accept-policy" } }, 1, "BROWSER_FILE_INPUT_NOT_QUALIFIED", "actionability"],
  ] as const) {
    const rejected = await runFileInputScenario(scenario);
    assert.deepEqual(rejected.result, { candidateCount: expectedCount, qualificationStage,
      identityRevalidated: false,
      mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
      failureCode: expectedCode, nativeCauseCode: null });
    assert.equal(rejected.fileInputs, 0);
  }
};

const exerciseActivationFailures = async (): Promise<void> => {
  await assert.rejects(runFileInputScenario({ nodeIds: [7], driftBeforeDispatch: true }), /BROWSER_DOCUMENT_INVALID/u);
  for (const [activationResult, expected] of [
    ["BROWSER_DOM_CANDIDATE_MISSING:BROWSER_DOM_SELECTOR_ABSENT", "BROWSER_DOM_CANDIDATE_MISSING"],
    ["BROWSER_DOM_CANDIDATE_AMBIGUOUS", "BROWSER_DOM_CANDIDATE_AMBIGUOUS"],
    ["BROWSER_DOM_ACTION_HIT_TEST_FAILED", "BROWSER_FILE_INPUT_NOT_QUALIFIED"],
  ] as const) {
    const rejected = await runFileInputScenario({ nodeIds: [7], activationResult });
    assert.equal(rejected.result.failureCode, expected);
    assert.equal(rejected.pointerClicks, 0);
    assert.equal(rejected.fileInputs, 0);
  }
};

const exerciseChooserFailures = async (): Promise<void> => {
  for (const chooserFailure of ["timeout", "mismatch"] as const) {
    const interceptionEvents: boolean[] = [];
    await assert.rejects(runFileInputScenario({ nodeIds: [7], chooserFailure, interceptionEvents }),
      chooserFailure === "timeout" ? /BROWSER_FILE_CHOOSER_TIMEOUT/u : /BROWSER_FILE_CHOOSER_MISMATCH/u);
    assert.deepEqual(interceptionEvents, [true, false],
      "chooser interception must close after every chooser failure");
  }
  const fileSetInterceptionEvents: boolean[] = [];
  await assert.rejects(runFileInputScenario({
    nodeIds: [7], failFileInput: true, interceptionEvents: fileSetInterceptionEvents,
  }), /FILE_INPUT_FAILED/u);
  assert.deepEqual(fileSetInterceptionEvents, [true, false],
    "chooser interception must close after file-set failure");
  await assert.rejects(runFileInputScenario({
    nodeIds: [7], failInterception: "disable",
  }), /BROWSER_FILE_CHOOSER_CLEANUP_FAILED/u,
  "an unproven chooser cleanup must fail closed with its own terminal cause");
  const uncertainEnableEvents: boolean[] = [];
  await assert.rejects(runFileInputScenario({
    nodeIds: [7], failInterception: "enable", interceptionEvents: uncertainEnableEvents,
  }), /INTERCEPTION_CONTROL_FAILED/u);
  assert.deepEqual(uncertainEnableEvents, [true, false],
    "an uncertain interception enable must still attempt and prove cleanup");
};

const exerciseReadbackFailures = async (): Promise<void> => {
  let failedReadbackInputs = 0;
  const readbackInterceptionEvents: boolean[] = [];
  await assert.rejects(runFileInputScenario({ nodeIds: [7], failReadback: true,
    interceptionEvents: readbackInterceptionEvents,
    onFileInput: () => { failedReadbackInputs += 1; } }), /BROWSER_DOM_NODE_STALE/u,
  "an unreadable after-action file set must stay DISPATCHED/unknown instead of inventing a count");
  assert.equal(failedReadbackInputs, 1);
  assert.deepEqual(readbackInterceptionEvents, [true, false],
    "chooser interception must already be closed before after-action readback");
  for (const mismatch of [{ approvedSetVerified: false }, { acceptVerified: false }]) {
    const rejected = await runFileInputScenario({ nodeIds: [7], ...mismatch });
    assert.equal(rejected.fileInputs, 1, "a failed exact-set readback must preserve the one physical input fact");
    assert.equal(rejected.result.postconditionVerified, false);
    assert.equal(rejected.result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  }
};

export const exerciseFileInput = async (): Promise<void> => {
  await exerciseFileChooserEventBinding();
  await exerciseSuccessfulAndRejectedCandidates();
  await exerciseActivationFailures();
  await exerciseChooserFailures();
  await exerciseReadbackFailures();
};
