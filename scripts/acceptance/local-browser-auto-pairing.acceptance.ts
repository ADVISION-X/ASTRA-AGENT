import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exerciseForkFailureChildSurvival } from "./local-browser-fork-failure-support.js";
import { exerciseAutomaticPairing } from "./local-browser-auto-pairing-support.js";

type TabActivatedListener = Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0];
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type DebuggerDetachListener = Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0];
const chromeApi = await exerciseAutomaticPairing();

let createdTab: Readonly<{ active: false; url: string }> | null = null;
let debuggerEvent: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] | null = null;
let debuggerDetach: DebuggerDetachListener = () => { throw new Error("debugger detach listener was not installed"); };
let targetTabUpdated: TabUpdatedListener = () => { throw new Error("target tab listener was not installed"); };
let nextCreatedTabId = 3;
let getTargetsCalls = 0;
let debuggerTargets: readonly ExtensionDebugTarget[] = [];
let getTargetsFailure: Error | null = null;
let frameTreeFailureTabId: number | null = null;
let attachFailureTabId: number | null = null;
let evaluateRuntime: ((expression: string) => Promise<unknown>) | null = null;
let forkTransitionClick = false;
let basicPointerClick = false;
let basicPointerDestinationUrl = "https://chatgpt.com/c/interaction-ready";
let basicPointerResult: unknown = { x: 5, y: 5 };
let switchBeforeProviderInput = false;
let switchAfterProviderInput = false;
let switchAwayAndBackTabReadCountdown = 0;
let navigateSerial = 0;
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

const sendForkTransitionCommand = (
  method: string,
  parameters: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | null => {
  if (!forkTransitionClick && !basicPointerClick) return null;
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
  if (basicPointerClick && !forkTransitionClick && parameters?.type === "mouseReleased") {
    mainFrameUrlByTab.set(3, basicPointerDestinationUrl);
  }
  if (forkTransitionClick && parameters?.type === "mouseReleased") {
    mainFrameUrlByTab.set(4, "https://chatgpt.com/c/fork-child");
    debuggerTargets = [
      ...debuggerTargets.filter((candidate) => candidate.tabId !== 4),
      { attached: false, id: "debug-target-4", tabId: 4, title: "Fork child",
        type: "page", url: "https://chatgpt.com/c/fork-child" },
    ];
  }
  return {};
};

const sendTargetChromeCommand: ExtensionChromeApi["debugger"]["sendCommand"] = async (
  { tabId }, method, parameters,
) => {
  debuggerMethods.push(method);
  const forkResult = sendForkTransitionCommand(method, parameters);
  if (forkResult) return forkResult;
  if (method === "Runtime.evaluate" && evaluateRuntime) {
    return { result: { value: await evaluateRuntime(String(parameters?.expression)) } };
  }
  if (method === "Page.getNavigationHistory") {
    return { currentIndex: 0, entries: [{ id: 1,
      url: mainFrameUrlByTab.get(tabId) ?? "https://chatgpt.com/", title: "ChatGPT" }] };
  }
  if (method === "Page.getFrameTree" && tabId === frameTreeFailureTabId) {
    throw new Error("temporary frame tree read failure");
  }
  if (method === "Page.navigate" && typeof parameters?.url === "string") {
    mainFrameUrlByTab.set(tabId, parameters.url);
    debuggerTargets = debuggerTargets.map((candidate) => candidate.tabId === tabId
      ? { ...candidate, url: parameters.url as string } : candidate);
    navigateSerial += 1;
    const loaderId = `loader-${tabId}-navigate-${navigateSerial}`;
    mainFrameLoaderByTab.set(tabId, loaderId);
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
      if (getTargetsFailure) throw getTargetsFailure;
      return debuggerTargets;
    },
    sendCommand: sendTargetChromeCommand,
    onDetach: { addListener: (listener) => { debuggerDetach = listener; } },
    onEvent: { addListener: (listener) => { debuggerEvent = listener; } },
  },
  tabs: {
    create: async (input) => {
      createdTab = input;
      return { id: nextCreatedTabId++ };
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
      removedTabs.push(tabId);
      debuggerTargets = debuggerTargets.filter((candidate) => candidate.tabId !== tabId);
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


for (const stage of ["child-attach", "child-frame", "claim", "source-detach", "source-remove"] as const) {
  await exerciseForkFailureChildSurvival(stage);
}
const targetAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { targetFrames.push({ kind, body }); if (kind === "TARGET_REVOKE") targetFailureOrder.push(kind); },
  (failure) => { targetFailures.push(failure); targetFailureOrder.push("DIAGNOSTIC"); },
);
targetAuthority.start();
const firstAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
assert.deepEqual(attachedTabs, [], "the task-owned tab must not attach before Chrome reports page completion");
targetTabUpdated(3, { status: "complete" }, { id: 3, url: "https://chatgpt.com/", title: "ChatGPT" });
await firstAcquisition;
assert.deepEqual(attachedTabs, [3]);
assert.equal(getTargetsCalls, 0, "job acquisition must not enumerate or reuse operator ChatGPT tabs");
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" });
assert.equal(targetFrames[0]?.kind, "TARGET_CLAIM");
assert.deepEqual(Object.keys(targetFrames[0]?.body ?? {}).sort(),
  ["claimOrigin", "documentRef", "navigationEpoch", "targetRef"],
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
const firstInteractiveReceipt = await targetAuthority.executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(firstInteractiveReceipt.postconditionVerified, true);
assert.deepEqual(activatedTabs, [3], "the first inactive mutation must activate only the exact system Tab once");
await targetAuthority.executeRegisteredCommand(simpleClick, interactionTarget, "mutation");
assert.deepEqual(activatedTabs, [3], "an already-active system Tab must not call tabs.update again");

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
basicPointerDestinationUrl = "https://chatgpt.com/c/sidebar-next?messageId=message-2#tail";
const selected = await selectConversation("https://chatgpt.com/c/sidebar-next");
assert.notEqual(selected.documentRef, interactionTarget.documentRef, "selection must publish a fresh Document");
assert.equal(providerInputMethods.length, selectionBaseline[0] + 3, "selection must perform one pointer click sequence");
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length, selectionBaseline[1], "selection must never use Page.navigate");
const selectedTarget = targetAuthority.resolve(String(selected.targetRef), String(selected.documentRef));
for (const failureCode of ["BROWSER_DOM_CANDIDATE_MISSING", "BROWSER_DOM_CANDIDATE_AMBIGUOUS"]) {
  basicPointerResult = failureCode;
  await assert.rejects(selectConversation("https://chatgpt.com/c/sidebar-absent", selectedTarget), new RegExp(failureCode));
}
assert.equal(providerInputMethods.length, selectionBaseline[0] + 3, "failed selection must stop before physical input");
basicPointerResult = { x: 5, y: 5 };
basicPointerClick = false;
await targetAuthority.parkActiveTarget();
assert.equal(targetFrames.at(-1)?.kind, "TARGET_REVOKE");
assert.deepEqual(detachedTabs, [], "logical park must keep the one debugger session alive across local restarts");
await targetAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.deepEqual(attachedTabs, [3],
  "same-job recovery must retain the extension-owned debugger session on the exact production Tab");
assert.equal(nextCreatedTabId, 4);
assert.equal(targetFrames.at(-1)?.body.targetRef, firstTargetRef);
assert.equal(debuggerMethods.filter((method) => method === "Page.bringToFront").length, 0,
  "initial claim and exact reacquire must never foreground the single production Tab");
await targetAuthority.releaseActiveTarget(false);
assert.deepEqual(detachedTabs, [], "socket suspension must preserve the one production debugger session");

debuggerTargets = [{
  attached: true,
  id: "debug-target-3",
  tabId: 3,
  title: "ChatGPT",
  type: "page",
  url: "https://chatgpt.com/c/exact-recovery",
}];
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/exact-recovery");
const recoveredFrames: typeof targetFrames = [];
const rebuiltAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { recoveredFrames.push({ kind, body }); },
  () => undefined,
);
await rebuiltAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.equal(getTargetsCalls, 1, "a rebuilt MV3 actor must inspect debugger ownership once for the exact prior tabId");
assert.deepEqual(attachedTabs, [3], "a rebuilt MV3 actor must adopt the still-attached exact Target without reattaching");
assert.equal(recoveredFrames.at(-1)?.body.targetRef, firstTargetRef,
  "a rebuilt MV3 actor must restore the same deterministic targetRef");
assert.notEqual(recoveredFrames.at(-1)?.body.documentRef, targetFrames[0]?.body.documentRef,
  "a rebuilt MV3 actor must publish the current page as a new Document");
assert.equal(debuggerMethods.filter((method) => method === "Page.bringToFront").length, 0,
  "MV3 recovery must not foreground the exact Target");
await rebuiltAuthority.releaseActiveTarget(false);
mainFrameUrlByTab.delete(3);

debuggerTargets = [{
  attached: false,
  id: "debug-target-3",
  tabId: 3,
  title: "ChatGPT",
  type: "page",
  url: "https://chatgpt.com/c/exact-recovery",
}, {
  attached: false,
  id: "worker-target-3",
  tabId: 3,
  title: "ChatGPT worker",
  type: "worker",
  url: "https://chatgpt.com/worker.js",
}];
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/exact-recovery");
const detachedRecoveryFrames: typeof targetFrames = [];
const detachedRecoveryAuthority = new ExtensionTargetAuthority(
  targetChromeApi,
  async (kind, body) => { detachedRecoveryFrames.push({ kind, body }); },
  () => undefined,
);
await detachedRecoveryAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
assert.equal(attachedTabs.filter((tabId) => tabId === 3).length, 2,
  "a rebuilt MV3 actor must reattach the physically present exact Target when its debugger session was lost");
assert.equal(detachedRecoveryFrames.at(-1)?.body.targetRef, firstTargetRef,
  "debugger-session loss must retain the exact physical Target instead of creating a replacement");
assert.equal(getTargetsCalls, 2,
  "exact recovery must select the sole top-level page while ignoring same-tab worker targets");
assert.equal(nextCreatedTabId, 4,
  "reattaching the exact physical Target must not create another ChatGPT tab");
await detachedRecoveryAuthority.releaseActiveTarget(false);
mainFrameUrlByTab.delete(3);

const discoveryFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
getTargetsFailure = new Error("temporary target discovery failure");
await assert.rejects(
  discoveryFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_TARGET_DISCOVERY_UNAVAILABLE/u,
  "a transient getTargets failure must not be promoted to physical Target loss",
);
getTargetsFailure = null;
assert.equal(nextCreatedTabId, 4, "target discovery failure must not create a replacement tab");

const frameFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
frameTreeFailureTabId = 3;
await assert.rejects(
  frameFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_EXACT_TARGET_UNAVAILABLE/u,
  "a transient frame read failure must preserve exact-target unavailability without physical-loss authority",
);
frameTreeFailureTabId = null;
assert.equal(nextCreatedTabId, 4, "frame read failure must not create a replacement tab");
await frameFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef);
await frameFailureAuthority.releaseActiveTarget(false);

const originFailureAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
mainFrameUrlByTab.set(3, "https://example.com/");
await assert.rejects(
  originFailureAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_ORIGIN_REJECTED/u,
  "an origin mismatch must remain an origin failure and must never authorize Target replacement",
);
mainFrameUrlByTab.set(3, "https://chatgpt.com/c/exact-recovery");
assert.equal(nextCreatedTabId, 4, "origin failure must not create a replacement tab");

debuggerTargets = [];
const physicallyAbsentAuthority = new ExtensionTargetAuthority(
  targetChromeApi, async () => undefined, () => undefined,
);
await assert.rejects(
  physicallyAbsentAuthority.acquireJobBoundChatGptTarget(firstTargetRef),
  /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
  "only a successful target enumeration with zero exact tab candidates proves physical absence",
);
assert.equal(nextCreatedTabId, 4, "physical absence proof itself must not create a replacement tab");
debuggerTargets = [{
  attached: true, id: "debug-target-3", tabId: 3, title: "ChatGPT", type: "page",
  url: "https://chatgpt.com/c/exact-recovery",
}];

await exerciseLocalBrowserDomIntent();

const navigateBeforeFreshReuse = debuggerMethods.filter((method) => method === "Page.navigate").length;
const secondAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
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
const beforeForkClaim = targetFrames.at(-1)!;
const beforeForkNavigateCount = debuggerMethods.filter((method) => method === "Page.navigate").length;
forkTransitionClick = true;
const forkTarget = targetAuthority.resolve(
  String(beforeForkClaim.body.targetRef), String(beforeForkClaim.body.documentRef),
);
const forkReceipt = await targetAuthority.executeRegisteredCommand({
  kind: "dom-intent",
  intent: {
    kind: "click", selector: "[role='menuitem'][tabindex='0']", expectedTextEquals: "分支到新聊天",
    expectedMatches: 1,
    postClickTargetTransition: {
      kind: "gpt-fork-successor",
      sourceCheckpoint: {
        assistantTurnId: "conversation-turn-2",
        canonicalConversationUrl: "https://chatgpt.com/c/exact-recovery",
        promptHash: `sha256:${"6".repeat(64)}`,
        responseHash: `sha256:${"7".repeat(64)}`,
        turnMarker: "[GRASSEYE:fork]",
      },
      timeoutMs: 5_000,
    },
  },
}, forkTarget, "mutation") as Readonly<Record<string, unknown>>;
forkTransitionClick = false;
assert.equal(forkReceipt.postconditionVerified, true);
assert.equal(debuggerMethods.filter((method) => method === "Page.navigate").length,
  beforeForkNavigateCount, "fork takeover must not navigate the source production tab");
assert.ok((attachedTabs as readonly number[]).includes(4)
  && !(detachedTabs as readonly number[]).includes(4)
  && !(removedTabs as readonly number[]).includes(4),
  "the verified fork child must remain attached as the one production page");
assert.ok((detachedTabs as readonly number[]).includes(3)
  && (removedTabs as readonly number[]).includes(3),
  "the superseded source page must be detached and removed");
assert.equal(targetFrames.at(-1)?.body.targetRef, beforeForkClaim.body.targetRef,
  "fork normalization must retain the original targetRef");
assert.equal(Number(targetFrames.at(-1)?.body.navigationEpoch), Number(beforeForkClaim.body.navigationEpoch) + 1,
  "fork normalization must publish exactly one successor Document");
assert.deepEqual(debuggerTargets.map((candidate) => candidate.tabId), [4],
  "fork normalization must retain only the successor production tab before replying");
targetFailureOrder.length = 0;
debuggerDetach({ tabId: 4 }, "target_closed");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailureOrder, ["DIAGNOSTIC", "TARGET_REVOKE"]);
assert.deepEqual(targetFailures.at(-1), {
  targetRef: firstTargetRef, runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
  nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
});
const replacementAcquisition = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(4, { status: "complete" }, { id: 4, url: "https://chatgpt.com/", title: "ChatGPT" });
await replacementAcquisition;
assert.equal(targetFrames.at(-1)?.body.targetRef, "target-tab-4",
  "after authoritative physical loss, the existing acquisition path must create one replacement Target");
assert.deepEqual(createdTab, { active: false, url: "https://chatgpt.com/" },
  "replacement acquisition must remain inactive and must not touch an operator tab");
assert.equal(nextCreatedTabId, 5, "physical loss must create exactly one replacement production Tab");
debuggerDetach({ tabId: 4 }, "canceled_by_user");
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
assert.deepEqual(targetFailures.at(-1), {
  targetRef: "target-tab-4", runtimeEventType: "debugger-detach",
  reasonCode: "BROWSER_DEVTOOLS_CONFLICT",
  nativeCauseCode: "CHROME_DEBUGGER_CANCELED_BY_USER",
});

const rejectedOrigin = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
mainFrameUrlByTab.set(5, "https://example.com/");
targetTabUpdated(5, { status: "complete" }, { id: 5, url: "https://example.com/", title: "Wrong Origin" });
await assert.rejects(rejectedOrigin, /BROWSER_ORIGIN_REJECTED/u);
assert.equal(Number(attachedTabs.at(-1)), 5, "origin verification may attach only to the exact tab just created for this job");
assert.ok(removedTabs.includes(5), "a rejected task-owned page must be removed");

attachFailureTabId = 6;
const debuggerConflict = targetAuthority.acquireJobBoundChatGptTarget();
await Promise.resolve();
targetTabUpdated(6, { status: "complete" }, { id: 6, url: "https://chatgpt.com/", title: "ChatGPT" });
await assert.rejects(debuggerConflict, /BROWSER_DEVTOOLS_CONFLICT/u,
  "debugger conflict on the new task-owned tab must fail without touching another page");
assert.ok(removedTabs.includes(6), "a conflicted task-owned page must be removed");
attachFailureTabId = null;
assert.ok(debuggerEvent, "the exact target owner must observe main-frame navigation");

const issuer = new BrowserAuthorityIssuer();
Reflect.set(issuer, "slot", { kind: "PRESENT", authority: { authorityEpoch: 7, authorityRef: "authority-7" } });
const broker = new BrowserAuthorityBroker(
  issuer,
  () => undefined,
  () => { throw new Error("target lease factory is outside this claim-only acceptance"); },
);
const initialClaim = {
  authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
  claimOrigin: "https://chatgpt.com",
} as const;
broker.registerOperatorTargetClaim(initialClaim);
broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }), /BROWSER_TARGET_INVALID/u,
  "an authenticated connection must not replace its claimed target without revoke");
assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-4", navigationEpoch: 3 }), /BROWSER_TARGET_INVALID/u,
  "Document claims must advance by exactly one navigation epoch");

process.stdout.write("LOCAL_BROWSER_AUTO_PAIRING_AND_EXACT_CHATGPT_CLAIM_ACCEPTANCE_PASS\n");
emitLocalBrowserAutoPairingProofs();
