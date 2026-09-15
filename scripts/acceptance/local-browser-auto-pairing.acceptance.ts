import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exerciseAutomaticPairing } from "./local-browser-auto-pairing-support.js";

type TabActivatedListener = Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0];
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type DebuggerDetachListener = Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0];
const chromeApi = await exerciseAutomaticPairing();

let createdTab: Readonly<{ active: true; url: string }> | null = null;
let debuggerEvent: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] | null = null;
let debuggerDetach: DebuggerDetachListener = () => { throw new Error("debugger detach listener was not installed"); };
let targetTabUpdated: TabUpdatedListener = () => { throw new Error("target tab listener was not installed"); };
let nextCreatedTabId = 3;
let getTargetsCalls = 0;
let attachFailureTabId: number | null = null;
let removeFailureTabId: number | null = null;
let evaluateRuntime: ((expression: string) => Promise<unknown>) | null = null;
let basicPointerClick = false;
let basicPointerDestinationUrl = "https://chatgpt.com/c/interaction-ready";
let basicPointerResult: unknown = { x: 5, y: 5 };
let rateLimitDetectorState: Readonly<Record<string, unknown>> = { state: "absent" };
const rateLimitDetectorStartedAt: number[] = [];
let switchBeforeProviderInput = false;
let switchAfterProviderInput = false;
let switchAwayAndBackTabReadCountdown = 0;
let navigateSerial = 0;
let emitFrameNavigationDuringNextNavigate = false;
let activeTabId = 99;
let targetTabActivated: TabActivatedListener = () => { throw new Error("target activation listener was not installed"); };
const activatedTabs: number[] = [];
const discardedTabIds = new Set<number>();
const providerInputMethods: string[] = [];
const attachedTabs: number[] = [];
const detachedTabs: number[] = [];
const debuggerMethods: string[] = [];
const removedTabs: number[] = [];
const mainFrameUrlByTab = new Map<number, string>();
const mainFrameLoaderByTab = new Map<number, string>();
const targetFrames: Array<Readonly<{ kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }>> = [];
const targetFailures: Array<Readonly<Record<string, unknown>>> = [];
const targetFailureOrder: string[] = [];

const sendPointerCommand = (
  method: string,
  parameters: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | null => {
  if (!basicPointerClick) return null;
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
  if (method === "Runtime.callFunctionOn" && String(parameters?.functionDeclaration ?? "").includes("spec.output")) {
    if (switchBeforeProviderInput) {
      switchBeforeProviderInput = false;
      activeTabId = 99;
      targetTabActivated({ tabId: activeTabId, windowId: 1 });
    }
    return { result: { value: basicPointerResult } };
  }
  if (method === "Runtime.callFunctionOn") return { result: { value: browserDomFacts() } };
  if (method === "Runtime.releaseObject") return {};
  if (method !== "Input.dispatchMouseEvent") return null;
  providerInputMethods.push(String(parameters?.type));
  if (switchAfterProviderInput) {
    switchAfterProviderInput = false;
    activeTabId = 99;
    targetTabActivated({ tabId: activeTabId, windowId: 1 });
  }
  if (parameters?.type === "mouseReleased") {
    mainFrameUrlByTab.set(3, basicPointerDestinationUrl);
  }
  return {};
};

const sendTargetChromeCommand: ExtensionChromeApi["debugger"]["sendCommand"] = async (
  { tabId }, method, parameters,
) => {
  debuggerMethods.push(method);
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration).includes("exact_present")) {
    rateLimitDetectorStartedAt.push(Date.now());
    return { result: { value: rateLimitDetectorState } };
  }
  const pointerResult = sendPointerCommand(method, parameters);
  if (pointerResult) return pointerResult;
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "document-root" } };
  if (method === "Runtime.evaluate" && evaluateRuntime) {
    return { result: { value: await evaluateRuntime(String(parameters?.expression)) } };
  }
  if (method === "Page.getNavigationHistory") {
    return { currentIndex: 0, entries: [{ id: 1,
      url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT" }] };
  }
  if (method === "Page.navigate" && typeof parameters?.url === "string") {
    mainFrameUrlByTab.set(tabId, parameters.url);
    navigateSerial += 1;
    const loaderId = `loader-${tabId}-navigate-${navigateSerial}`;
    mainFrameLoaderByTab.set(tabId, loaderId);
    if (emitFrameNavigationDuringNextNavigate) {
      emitFrameNavigationDuringNextNavigate = false;
      debuggerEvent?.({ tabId }, "Page.frameNavigated");
    }
    return { loaderId };
  }
  return method === "Page.getFrameTree"
    ? { frameTree: { frame: { loaderId: mainFrameLoaderByTab.get(tabId) ?? `loader-${tabId}`,
      url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/" } } }
    : {};
};

const targetChromeApi: ExtensionChromeApi = {
  runtime: chromeApi.runtime,
  debugger: {
    attach: async ({ tabId }) => {
      if (tabId === attachFailureTabId) throw new Error("another debugger owns the new task tab");
      attachedTabs.push(tabId);
    },
    detach: async ({ tabId }) => { detachedTabs.push(tabId); },
    getTargets: async () => {
      getTargetsCalls += 1;
      return [];
    },
    sendCommand: sendTargetChromeCommand,
    onDetach: { addListener: (listener) => { debuggerDetach = listener; } },
    onEvent: { addListener: (listener) => { debuggerEvent = listener; } },
  },
  tabs: {
    create: async (input) => {
      createdTab = input;
      const id = nextCreatedTabId++;
      activeTabId = id;
      targetTabActivated({ tabId: id, windowId: 1 });
      return { id };
    },
    get: async (tabId) => {
      if (switchAwayAndBackTabReadCountdown > 0) {
        switchAwayAndBackTabReadCountdown -= 1;
        if (switchAwayAndBackTabReadCountdown === 0) {
          activeTabId = 99;
          targetTabActivated({ tabId: activeTabId, windowId: 1 });
          activeTabId = tabId;
          targetTabActivated({ tabId: activeTabId, windowId: 1 });
        }
      }
      return { active: tabId === activeTabId, discarded: discardedTabIds.has(tabId), id: tabId,
        status: "complete", title: "ChatGPT", windowId: 1 };
    },
    remove: async (tabId) => {
      if (tabId === removeFailureTabId) {
        removeFailureTabId = null;
        throw new Error("ambiguous exact tab removal");
      }
      removedTabs.push(tabId);
    },
    update: async (tabId) => {
      activatedTabs.push(tabId);
      activeTabId = tabId;
      targetTabActivated({ tabId, windowId: 1 });
      return { active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 };
    },
    onActivated: { addListener: (listener) => { targetTabActivated = listener; } },
    onUpdated: { addListener: (listener) => { targetTabUpdated = listener; } },
    onRemoved: { addListener: () => undefined },
  },
  alarms: chromeApi.alarms,
};

const pageBoundaryProbe = new ExtensionDebuggerRuntime(targetChromeApi);
pageBoundaryProbe.adoptAttached(3);
pageBoundaryProbe.requireLogicalPageAccessCycles();
await assert.rejects(pageBoundaryProbe.send(3, "Page.getFrameTree"),
  /BROWSER_PAGE_ACCESS_CYCLE_REQUIRED/u,
  "a raw CDP page read must not bypass the unique logical ChatGPT access boundary");
await assert.doesNotReject(pageBoundaryProbe.withLogicalPageAccess(
  async () => undefined,
  () => pageBoundaryProbe.send(3, "Page.getFrameTree"),
));
const accessOrder: string[] = [];
let releaseCurrent!: () => void;
let currentStarted!: () => void;
const currentRelease = new Promise<void>((resolve) => { releaseCurrent = resolve; });
const currentStart = new Promise<void>((resolve) => { currentStarted = resolve; });
const currentAccess = pageBoundaryProbe.withLogicalPageAccess(
  async () => undefined,
  async () => { accessOrder.push("current"); currentStarted(); await currentRelease; },
);
await currentStart;
const ordinaryAccess = pageBoundaryProbe.withLogicalPageAccess(
  async () => undefined,
  async () => { accessOrder.push("ordinary"); },
);
const urgentAccess = pageBoundaryProbe.withLogicalPageAccess(
  async () => undefined,
  async () => { accessOrder.push("rate-limit-ack"); },
  "rate-limit-ack",
);
releaseCurrent();
await Promise.all([currentAccess, ordinaryAccess, urgentAccess]);
assert.deepEqual(accessOrder, ["current", "rate-limit-ack", "ordinary"],
  "the exact rate-limit acknowledgement must take the next logical page-access cycle");

const targetAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { targetFrames.push({ kind, body }); if (kind === "TARGET_REVOKE") targetFailureOrder.push(kind); },
  (failure) => { targetFailures.push(failure); targetFailureOrder.push("DIAGNOSTIC"); },
);
const jobRefHash = `sha256:${"a".repeat(64)}` as const;
targetAuthority.start();
const waitForCreatedTab = async (tabId: number): Promise<void> => {
  while (nextCreatedTabId <= tabId) {
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  }
};
const firstAcquisition = targetAuthority.acquireJobBoundChatGptTarget("fresh", jobRefHash);
await waitForCreatedTab(3);
assert.deepEqual(attachedTabs, [], "the task-owned tab must not attach before Chrome reports page completion");
targetTabUpdated(3, { status: "complete" }, { id: 3, url: "https://chatgpt.com/", title: "ChatGPT" });
await firstAcquisition;
assert.deepEqual(attachedTabs, [3]);
assert.equal(getTargetsCalls, 0, "job acquisition must not enumerate or reuse operator ChatGPT tabs");
assert.deepEqual(createdTab, { active: true, url: "https://chatgpt.com/" });
assert.equal(activeTabId, 3, "the first production Tab must be selected in its existing Chrome window");
assert.equal(targetFrames[0]?.kind, "TARGET_CLAIM");
assert.deepEqual(Object.keys(targetFrames[0]?.body ?? {}).sort(),
  ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"],
  "the Target claim wire must not contain a full page URL");
assert.equal(targetFrames[0]?.body.claimOrigin, "https://chatgpt.com");
const firstTargetRef = String(targetFrames[0]?.body.targetRef);
const firstDocumentRef = String(targetFrames[0]?.body.documentRef);
await exerciseAuthenticatedMedia({
  authority: targetAuthority,
  targetRef: firstTargetRef,
  documentRef: firstDocumentRef,
  setRuntime: (runtime) => { evaluateRuntime = runtime; },
});
assert.deepEqual(activatedTabs, [], "authenticated-media probe must not activate the production Tab");
const interactionTarget = targetAuthority.resolve(firstTargetRef, firstDocumentRef);
activeTabId = 99;
targetTabActivated({ tabId: 99, windowId: 1 });
await targetAuthority.executeRegisteredCommand(
  { kind: "wait", durationMs: 1 }, interactionTarget, "observation",
);
assert.deepEqual(activatedTabs, [3],
  "an observation must reselect and revalidate its exact system Tab immediately before reading");
const simpleClick = {
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const,
    selector: "button[data-testid='interaction-ready']",
    expectedMatches: 1,
    postClickUrl: { equals: "https://chatgpt.com/c/interaction-ready" },
  },
};
basicPointerClick = true;
rateLimitDetectorState = { state: "unknown_present" };
const providerInputsBeforeUnknownDialog = providerInputMethods.length;
await assert.rejects(
  targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation"),
  /BROWSER_GPT_DIALOG_UNRECOGNIZED/u,
);
assert.equal(providerInputMethods.length, providerInputsBeforeUnknownDialog,
  "an unknown or structurally mismatched dialog must fail closed with zero physical input");
rateLimitDetectorState = { state: "exact_present", observedAt: new Date().toISOString() };
const providerInputsBeforeKnownDialog = providerInputMethods.length;
const knownDialogBlocked = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(knownDialogBlocked.failureCode, "BROWSER_KNOWN_GPT_RATE_LIMIT");
assert.equal(knownDialogBlocked.physicalInputCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeKnownDialog,
  "the exact known dialog must block the original action with zero physical input");
rateLimitDetectorState = { state: "absent" };
const firstInteractiveReceipt = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(firstInteractiveReceipt.postconditionVerified, true);
assert.equal(rateLimitDetectorStartedAt.slice(-3).length, 3);
assert.ok(rateLimitDetectorStartedAt.slice(-3).every((startedAt, index, values) =>
  index === 0 || startedAt - values[index - 1]! >= 1_500),
"ordinary ChatGPT command cycles must start their single rate-limit preflight at least 1500ms apart");
assert.deepEqual(activatedTabs, [3], "the first mutation must reuse the Tab selected by the observation gate");
activeTabId = 99;
targetTabActivated({ tabId: 99, windowId: 1 });
await targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation");
assert.deepEqual(activatedTabs, [3, 3], "a mutation after the user switches away must reselect only the exact system Tab");
await targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation");
assert.deepEqual(activatedTabs, [3, 3], "an already-active system Tab must not call tabs.update again");

const providerInputsBeforeOriginRejection = providerInputMethods.length;
const acceptedInteractionOrigin = mainFrameUrlByTab.get(3);
mainFrameUrlByTab.set(3, "http://127.0.0.1:4173/");
const rejectedInteractionOrigin = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(rejectedInteractionOrigin.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(rejectedInteractionOrigin.nativeCauseCode, "BROWSER_ORIGIN_REJECTED");
assert.equal(rejectedInteractionOrigin.mutationCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeOriginRejection,
  "a rejected DevTools main-frame Origin must produce zero physical input");
mainFrameUrlByTab.set(3, acceptedInteractionOrigin!);

const providerInputsBeforeQualificationSwitch = providerInputMethods.length;
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchAwayAndBackTabReadCountdown = 2;
const switchedAwayAndBackDuringQualification = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(switchedAwayAndBackDuringQualification.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(switchedAwayAndBackDuringQualification.mutationCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeQualificationSwitch,
  "a user switch away and back during qualification must permanently invalidate that interaction lease");

const providerInputsBeforeSwitch = providerInputMethods.length;
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchBeforeProviderInput = true;
const switchedBeforeInput = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(switchedBeforeInput.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(switchedBeforeInput.mutationCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeSwitch,
  "a user tab switch before Provider input must produce zero physical input");

activeTabId = 3;
targetTabActivated({ tabId: 3, windowId: 1 });
mainFrameUrlByTab.set(3, "https://chatgpt.com/");
switchAfterProviderInput = true;
const providerInputsBeforeLateSwitch = providerInputMethods.length;
await assert.rejects(
  targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation"),
  /BROWSER_TARGET_NOT_INTERACTIVE/u,
  "a user tab switch after Provider input starts must preserve an uncertain dispatched result",
);
assert.equal(providerInputMethods.length, providerInputsBeforeLateSwitch + 1,
  "a post-input tab switch must not replay or finish the remaining pointer sequence");

activeTabId = 3;
targetTabActivated({ tabId: 3, windowId: 1 });
discardedTabIds.add(3);
const discardedReceipt = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
discardedTabIds.delete(3);
assert.equal(discardedReceipt.failureCode, "BROWSER_TARGET_NOT_INTERACTIVE");
assert.equal(discardedReceipt.mutationCount, 0, "a discarded system Tab must fail before physical input");
const selectConversation = (url: string, target = interactionTarget) => targetAuthority.executeRegisteredCommand(
  { kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: url } }, target, "lifecycle") as Promise<Readonly<Record<string, unknown>>>;
const selectionBaseline = [providerInputMethods.length, debuggerMethods.filter((method) => method === "Page.navigate").length] as const;
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/sidebar-target?messageId=message-1#tail");
const alreadySelected = await selectConversation("https://chatgpt.com/c/sidebar-target");
assert.deepEqual([alreadySelected.documentRef, providerInputMethods.length], [interactionTarget.documentRef,
  selectionBaseline[0]], "an exact current conversation must require zero clicks");
const selected = await selectConversation("https://chatgpt.com/c/sidebar-next");
assert.notEqual(selected.documentRef, interactionTarget.documentRef, "selection must publish a fresh Document");
assert.equal(providerInputMethods.length, selectionBaseline[0], "conversation navigation must produce zero pointer input");
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length, selectionBaseline[1] + 1,
  "a different conversation must use one exact direct navigation");
const selectedTarget = targetAuthority.resolve(String(selected.targetRef), String(selected.documentRef));
const framesBeforeAtomicSelection = targetFrames.length;
emitFrameNavigationDuringNextNavigate = true;
await selectConversation("https://chatgpt.com/c/sidebar-absent", selectedTarget);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length, selectionBaseline[1] + 2,
  "each different authoritative URL must produce exactly one direct navigation");
assert.deepEqual(targetFrames.slice(framesBeforeAtomicSelection).map((frame) => frame.kind), ["TARGET_CLAIM"],
  "the Page.frameNavigated event must join the same navigation publication without revoke or duplicate claim");
basicPointerClick = false;
const removedBeforeInvalidDocument = removedTabs.length;
await targetAuthority.retireInvalidCommandTarget(new Error("BROWSER_DOCUMENT_INVALID"), null);
assert.equal(removedTabs.length, removedBeforeInvalidDocument,
  "a Document failure before Website decision must park without orphaning the system Tab");
await targetAuthority.acquireJobBoundChatGptTarget("bound-observation", jobRefHash);
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef,
  "the exact binding must survive a Document failure for Website-authorized later release");
await targetAuthority.parkActiveTarget();
assert.equal(targetFrames.at(-1)?.kind, "TARGET_REVOKE");
assert.deepEqual(detachedTabs, [], "logical park must keep the one debugger session alive across local restarts");
await targetAuthority.acquireJobBoundChatGptTarget("confirmed-readback", jobRefHash);
assert.deepEqual(attachedTabs, [3],
  "confirmed readback may reuse the current system Tab without historical Target identity");
assert.equal(nextCreatedTabId, 4);
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef);
assert.equal(debuggerMethods.filter((method) => method === "Page.bringToFront").length, 0,
  "initial claim and confirmed readback must never call Page.bringToFront");
await targetAuthority.releaseActiveTarget(false);
assert.deepEqual(detachedTabs, [], "socket suspension must preserve the one production debugger session");

await exerciseLocalBrowserDomIntent();

const navigateBeforeFreshReuse = debuggerMethods.filter((method) => method === "Page.navigate").length;
const secondAcquisition = targetAuthority.acquireJobBoundChatGptTarget("fresh", jobRefHash);
await Promise.resolve();
await secondAcquisition;
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length, navigateBeforeFreshReuse + 1,
  "a fresh job must navigate the fixed root even when the parked target is already on that URL");
assert.equal(attachedTabs.at(-1), 3, "every turn must reuse the one visible production tab");
assert.equal(nextCreatedTabId, 4, "single-Tab reuse must not create a second physical page");
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef,
  "single-Tab reuse must preserve physical target identity");
assert.notEqual(targetFrames.at(-1)?.body.documentRef, firstDocumentRef,
  "a fresh job must publish a new Document instead of inheriting residual composer attachments");
assert.equal(targetFrames.at(-1)?.body.claimOrigin, "https://chatgpt.com",
  "the debugger-owned main frame may publish only the exact admitted origin");
targetFailureOrder.length = 0;
debuggerDetach({ tabId: 3 }, "target_closed");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailureOrder, ["DIAGNOSTIC", "TARGET_REVOKE"]);
assert.deepEqual(targetFailures.at(-1), {
  targetRef: firstTargetRef, runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
  nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
});
const activationCountBeforeReadbackReplacement = activatedTabs.length;
const navigationCountBeforeReadbackReplacement = debuggerMethods
  .filter((method) => method === "Page.navigate").length;
const replacementAcquisition = targetAuthority.acquireJobBoundChatGptTarget("confirmed-readback", jobRefHash);
await waitForCreatedTab(4);
targetTabUpdated(4, { status: "complete" }, { id: 4, url: "https://chatgpt.com/", title: "ChatGPT" });
await replacementAcquisition;
assert.equal(targetFrames.at(-1)?.body.targetRef, "target-tab-4",
  "after authoritative physical loss, the existing acquisition path must create one replacement Target");
const replacementClaim = targetFrames.at(-1)!.body;
const replacementTarget = targetAuthority.resolve(
  String(replacementClaim.targetRef), String(replacementClaim.documentRef),
);
await selectConversation("https://chatgpt.com/c/replacement-readback", replacementTarget);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  navigationCountBeforeReadbackReplacement + 1,
  "a confirmed readback replacement must navigate exactly once from root to the WAL conversation URL");
assert.equal(activatedTabs.length, activationCountBeforeReadbackReplacement,
  "active replacement creation and canonical navigation must not add a tabs.update activation");
assert.deepEqual(createdTab, { active: true, url: "https://chatgpt.com/" },
  "replacement acquisition must select only its new system Tab");
assert.equal(activeTabId, 4, "the replacement system Tab must be selected in its existing Chrome window");
assert.equal(nextCreatedTabId, 5, "physical loss must create exactly one replacement production Tab");
debuggerDetach({ tabId: 4 }, "canceled_by_user");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailures.at(-1), {
  targetRef: "target-tab-4", runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_DEVTOOLS_CONFLICT",
  nativeCauseCode: "CHROME_DEBUGGER_CANCELED_BY_USER",
});

const rejectedOrigin = targetAuthority.acquireJobBoundChatGptTarget("fresh", jobRefHash);
await waitForCreatedTab(5);
mainFrameUrlByTab.set(5, "https://example.com/");
targetTabUpdated(5, { status: "complete" }, { id: 5, url: "https://example.com/", title: "Wrong Origin" });
await assert.rejects(rejectedOrigin, /BROWSER_ORIGIN_REJECTED/u);
assert.equal(Number(attachedTabs.at(-1)), 5, "origin verification may attach only to the exact tab just created for this job");
assert.ok(removedTabs.includes(5), "a rejected task-owned page must be removed");

attachFailureTabId = 6;
const debuggerConflict = targetAuthority.acquireJobBoundChatGptTarget("fresh", jobRefHash);
await waitForCreatedTab(6);
targetTabUpdated(6, { status: "complete" }, { id: 6, url: "https://chatgpt.com/", title: "ChatGPT" });
await assert.rejects(debuggerConflict, /BROWSER_DEVTOOLS_CONFLICT/u,
  "debugger conflict on the new task-owned tab must fail without touching another page");
assert.ok(removedTabs.includes(6), "a conflicted task-owned page must be removed");
attachFailureTabId = null;
assert.ok(debuggerEvent, "the exact target owner must observe main-frame navigation");

const rotationHashes = ["b", "c", "d"].map(
  (value) => `sha256:${value.repeat(64)}` as `sha256:${string}`,
);
const rotationTargetRefs: string[] = [];
for (const [index, hash] of rotationHashes.entries()) {
  const acquisition = targetAuthority.acquireJobBoundChatGptTarget("fresh", hash);
  const tabId = 7 + index;
  await waitForCreatedTab(tabId);
  targetTabUpdated(tabId, { status: "complete" }, {
    id: tabId, url: "https://chatgpt.com/", title: "ChatGPT",
  });
  await acquisition;
  rotationTargetRefs.push(String(targetFrames.at(-1)?.body.targetRef));
  await targetAuthority.parkActiveTarget();
}
const navigationBeforeRotation = debuggerMethods.filter((method) => method === "Page.navigate").length;
for (const index of [0, 1, 2, 0]) {
  await targetAuthority.acquireJobBoundChatGptTarget(
    "bound-observation", rotationHashes[index]!,
  );
  assert.equal(targetFrames.at(-1)?.body.targetRef, rotationTargetRefs[index]);
  await targetAuthority.parkActiveTarget();
}
assert.deepEqual(activatedTabs.slice(-4), [7, 8, 9, 7],
  "three job-owned Tabs must rotate A/B/C/A through exact Chrome activation");
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  navigationBeforeRotation, "normal bound observation must switch Tabs with zero navigation");
removeFailureTabId = 7;
await assert.rejects(
  targetAuthority.releaseJobBoundChatGptTarget(rotationHashes[0]!),
  /BROWSER_TARGET_CLEANUP_FAILED/u,
  "an unproven tab removal must retain the exact binding for a governed retry",
);
await targetAuthority.acquireJobBoundChatGptTarget("bound-observation", rotationHashes[0]!);
assert.equal(targetFrames.at(-1)?.body.targetRef, rotationTargetRefs[0]);
await targetAuthority.parkActiveTarget();
await targetAuthority.releaseJobBoundChatGptTarget(rotationHashes[0]!);
assert.equal(removedTabs.at(-1), 7, "business closure must remove only the exact job-owned Tab");
await targetAuthority.acquireJobBoundChatGptTarget("bound-observation", rotationHashes[1]!);
assert.equal(targetFrames.at(-1)?.body.targetRef, rotationTargetRefs[1],
  "closing job A must preserve job B's exact bound Tab");
await targetAuthority.parkActiveTarget();
await targetAuthority.releaseJobBoundChatGptTarget(rotationHashes[1]!);
await targetAuthority.releaseJobBoundChatGptTarget(rotationHashes[2]!);

const continuationHash = `sha256:${"e".repeat(64)}` as const;
const continuationUrl = "https://chatgpt.com/c/article-a";
const continuationTabId = nextCreatedTabId;
const continuationNavigationBaseline = debuggerMethods
  .filter((method) => method === "Page.navigate").length;
const continuationFrameBaseline = targetFrames.length;
const continuationAcquisition = targetAuthority.acquireJobBoundChatGptTarget(
  "authorized-continuation", continuationHash, continuationUrl,
);
await waitForCreatedTab(continuationTabId);
targetTabUpdated(continuationTabId, { status: "complete" }, {
  id: continuationTabId, url: "https://chatgpt.com/", title: "ChatGPT",
});
await continuationAcquisition;
assert.equal(mainFrameUrlByTab.get(continuationTabId), continuationUrl,
  "authorized continuation must navigate the new current-job Target to the exact parent WAL URL");
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  continuationNavigationBaseline + 1,
  "authorized continuation must navigate exactly once before publishing its Target claim");
assert.equal(targetFrames.length, continuationFrameBaseline + 1);
assert.equal(targetFrames.at(-1)?.kind, "TARGET_CLAIM");
assert.deepEqual(Object.keys(targetFrames.at(-1)?.body ?? {}).sort(),
  ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"],
  "the parent conversation URL must remain absent from Target claim transport");
await targetAuthority.parkActiveTarget();
const parkedContinuationNavigationBaseline = debuggerMethods
  .filter((method) => method === "Page.navigate").length;
await targetAuthority.acquireJobBoundChatGptTarget(
  "authorized-continuation", continuationHash, continuationUrl,
);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  parkedContinuationNavigationBaseline,
  "a parked current-job Target must be revalidated without re-navigation");
await targetAuthority.parkActiveTarget();
mainFrameUrlByTab.set(continuationTabId, "https://chatgpt.com/c/article-b");
await assert.rejects(
  targetAuthority.acquireJobBoundChatGptTarget(
    "authorized-continuation", continuationHash, continuationUrl,
  ),
  /BROWSER_POSTCONDITION_FAILED/u,
  "a parked Target from article B must fail before article A can claim it",
);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  parkedContinuationNavigationBaseline,
  "mismatched parked continuation must fail without navigation");
await targetAuthority.releaseJobBoundChatGptTarget(continuationHash);

const issuer = new BrowserAuthorityIssuer();
Reflect.set(issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 7, authorityRef: "authority-7" } });
const broker = new BrowserAuthorityBroker(
  issuer,
  () => undefined,
  () => { throw new Error("target lease factory is outside this claim-only acceptance"); },
);
const initialClaim = {
  authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
  claimOrigin: "https://chatgpt.com", jobRefHash: rotationHashes[0]!,
} as const;
broker.registerOperatorTargetClaim(initialClaim);
broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }), /BROWSER_TARGET_INVALID/u,
  "an authenticated connection must not replace its claimed target without revoke");
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-4", navigationEpoch: 3 }), /BROWSER_TARGET_INVALID/u,
  "Document claims must advance by exactly one navigation epoch");
assert.throws(() => broker.registerOperatorTargetClaim({
  ...initialClaim, documentRef: "document-3", navigationEpoch: 2, jobRefHash: rotationHashes[1]!,
}), /BROWSER_TARGET_INVALID/u, "a live claim may never change its exact job identity");
await assert.rejects(broker.acquireOperatorClaimedTargetLease({
  jobRefHash: rotationHashes[1]!,
} as never, "wrong-job"), /BROWSER_TARGET_INVALID/u,
"an old claimed Tab must never be wrapped as a lease for a different job");
assert.equal(new Set<number>(activatedTabs).has(99), false, "the interaction gate must never activate an operator Tab");
assert.equal(new Set<number>(removedTabs).has(99), false, "the production owner must never remove an operator Tab");

process.stdout.write("LOCAL_BROWSER_AUTO_PAIRING_AND_EXACT_CHATGPT_CLAIM_ACCEPTANCE_PASS\n");
emitLocalBrowserAutoPairingProofs();
