import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { GRASSEYE_TOOL_EXTENSION_ID } from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";

type ForkFailureStage = "child-attach" | "child-frame" | "claim" | "source-detach" | "source-remove";
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type DebuggerDetachListener = Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0];
type ForkFailureState = {
  childTabId: number;
  claimBodies: Array<Readonly<Record<string, unknown>>>;
  claims: number;
  detached: number[];
  detachListener: DebuggerDetachListener;
  discovered: readonly ExtensionDebugTarget[];
  forkClick: boolean;
  injectionHits: number;
  removed: number[];
  sourceTabId: number;
  stage: ForkFailureStage;
  updated: TabUpdatedListener;
  urls: Map<number, string>;
};

const runtimeApi: ExtensionChromeApi["runtime"] = {
  id: GRASSEYE_TOOL_EXTENSION_ID, getManifest: () => ({ version: "1.0.0" }),
  getPlatformInfo: async () => ({}), reload: () => undefined,
  onMessage: { addListener: () => undefined }, onStartup: { addListener: () => undefined },
};
const alarmsApi: ExtensionChromeApi["alarms"] = {
  create: async () => undefined, onAlarm: { addListener: () => undefined },
};

const createForkFailureState = (stage: ForkFailureStage): ForkFailureState => ({
  childTabId: 301, claimBodies: [], claims: 0, detached: [], detachListener: () => undefined,
  discovered: [], forkClick: false, injectionHits: 0, removed: [], sourceTabId: 300, stage,
  updated: () => { throw new Error("failure fixture listener missing"); },
  urls: new Map<number, string>([
    [300, "https://chatgpt.com/c/source%20opaque"],
    [301, "https://chatgpt.com/c/child%20opaque"],
  ]),
});

const sendForkClickCommand = (
  state: ForkFailureState,
  method: string,
  parameters: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | null => {
  if (!state.forkClick) return null;
  if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
  if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
  if (method === "Runtime.callFunctionOn"
    && String(parameters?.functionDeclaration ?? "").startsWith("async function (spec)")) {
    assert.equal(parameters?.awaitPromise, true);
    return { result: { value: { x: 5, y: 5 } } };
  }
  if (method === "Runtime.callFunctionOn") return { result: { value: browserDomFacts() } };
  if (method === "Runtime.releaseObject") return {};
  if (method !== "Input.dispatchMouseEvent") return null;
  if (parameters?.type === "mouseReleased") state.discovered = [
    { attached: true, id: "source", tabId: state.sourceTabId, title: "Source", type: "page",
      url: state.urls.get(state.sourceTabId)! },
    { attached: false, id: "child", tabId: state.childTabId, title: "Child", type: "page",
      url: state.urls.get(state.childTabId)! },
  ];
  return {};
};

const sendForkFailureCommand = async (
  state: ForkFailureState,
  { tabId }: { tabId: number },
  method: string,
  parameters?: Readonly<Record<string, unknown>>,
): Promise<Readonly<Record<string, unknown>>> => {
  const forkResult = sendForkClickCommand(state, method, parameters);
  if (forkResult) return forkResult;
  if (method !== "Page.getFrameTree") return {};
  if (state.stage === "child-frame" && tabId === state.childTabId) {
    state.injectionHits += 1;
    throw new Error("injected child frame failure");
  }
  return { frameTree: { frame: { loaderId: `loader-${tabId}`, url: state.urls.get(tabId)! } } };
};

const createForkFailureApi = (state: ForkFailureState): ExtensionChromeApi => ({
  runtime: runtimeApi,
  debugger: {
    attach: async ({ tabId }) => {
      if (state.stage === "child-attach" && tabId === state.childTabId) {
        state.injectionHits += 1;
        throw new Error("injected child attach failure");
      }
    },
    detach: async ({ tabId }) => {
      if (state.stage === "source-detach" && tabId === state.sourceTabId) {
        state.injectionHits += 1;
        throw new Error("injected source detach failure");
      }
      state.detached.push(tabId);
    },
    getTargets: async () => state.discovered,
    sendCommand: (target, method, parameters) => sendForkFailureCommand(state, target, method, parameters),
    onDetach: { addListener: (listener) => { state.detachListener = listener; } },
    onEvent: { addListener: () => undefined },
  },
  tabs: {
    create: async () => {
      globalThis.setTimeout(() => state.updated(state.sourceTabId, { status: "complete" }, {
        id: state.sourceTabId, url: state.urls.get(state.sourceTabId)!, title: "Source",
      }), 0);
      return { id: state.sourceTabId };
    },
    remove: async (tabId) => {
      if (state.stage === "source-remove" && tabId === state.sourceTabId) {
        state.injectionHits += 1;
        throw new Error("injected source remove failure");
      }
      state.removed.push(tabId);
      state.discovered = state.discovered.filter((candidate) => candidate.tabId !== tabId);
    },
    onUpdated: { addListener: (listener) => { state.updated = listener; } },
    onRemoved: { addListener: () => undefined },
  },
  alarms: alarmsApi,
});

const assertForkFailureOutcome = (
  state: ForkFailureState,
  authority: ExtensionTargetAuthority,
  firstClaimBody: Readonly<Record<string, unknown>>,
): void => {
  assert.ok(state.injectionHits >= 1, `${state.stage} must reach its named failure boundary`);
  assert.equal(state.removed.includes(state.childTabId), false, `${state.stage} must never delete the user-visible child tab`);
  assert.equal(state.discovered.some((candidate) => candidate.tabId === state.childTabId), true,
    `${state.stage} must preserve the user-visible child rather than destroy Provider output`);
  if (state.stage === "child-attach" || state.stage === "child-frame") {
    assert.equal(authority.resolve(String(firstClaimBody.targetRef), String(firstClaimBody.documentRef)).tabId,
      state.sourceTabId, `${state.stage} must leave the verified source as the sole logical production Target`);
    return;
  }
  const successorClaim = state.claimBodies[1];
  assert.ok(successorClaim, `${state.stage} must reach the child Target transfer before failing`);
  assert.equal(authority.resolve(String(successorClaim.targetRef), String(successorClaim.documentRef)).tabId,
    state.childTabId, `${state.stage} must keep the transferred child as the logical production Target`);
};

export const exerciseForkFailureChildSurvival = async (stage: ForkFailureStage): Promise<void> => {
  const state = createForkFailureState(stage);
  const authority = new ExtensionTargetAuthority(createForkFailureApi(state), async (kind, body) => {
    if (kind !== "TARGET_CLAIM") return;
    state.claims += 1;
    state.claimBodies.push(body);
    if (stage === "claim" && state.claims === 2) {
      state.injectionHits += 1;
      throw new Error("injected claim failure");
    }
  }, () => undefined);
  authority.start();
  void state.detachListener;
  await authority.acquireJobBoundChatGptTarget();
  state.discovered = [{ attached: true, id: "source", tabId: state.sourceTabId, title: "Source", type: "page",
    url: state.urls.get(state.sourceTabId)! }];
  const firstClaimBody = state.claimBodies[0];
  assert.ok(firstClaimBody, "initial source claim must be published before fork failure injection");
  const firstClaim = authority.resolve(String(firstClaimBody.targetRef), String(firstClaimBody.documentRef));
  state.forkClick = true;
  await assert.rejects(authority.executeRegisteredCommand({
    kind: "dom-intent",
    intent: {
      kind: "click", selector: "[role='menuitem']", expectedTextEquals: "分支到新聊天", expectedMatches: 1,
      postClickTargetTransition: {
        kind: "gpt-fork-successor",
        sourceCheckpoint: {
          assistantTurnId: "conversation-turn-10", canonicalConversationUrl: state.urls.get(state.sourceTabId)!,
          promptHash: `sha256:${"6".repeat(64)}`, responseHash: `sha256:${"7".repeat(64)}`,
          turnMarker: "[GRASSEYE:fork]",
        },
        timeoutMs: 5_000,
      },
    },
  }, firstClaim), /BROWSER_POSTCONDITION_FAILED/u, `${stage} must fail closed`);
  assertForkFailureOutcome(state, authority, firstClaimBody);
};
