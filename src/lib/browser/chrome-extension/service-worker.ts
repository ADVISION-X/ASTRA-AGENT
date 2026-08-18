import {
  type BrowserWireCommand,
  type BrowserWireTargetDescriptor,
} from "./protocol.js";
import {
  atomicDomExpression,
  runAtomicDomFillKeyboardCommand,
} from "./atomic-dom-command.js";
import {
  configureNativeTransport,
  connectNativeTransport,
} from "./service-worker-native-transport.js";
import {
  runInteractionCommand,
  runScrollPageCommand,
  type ServiceWorkerInteractionRuntime,
  type InteractionCommand,
} from "./service-worker-interaction-commands.js";
import { createServiceWorkerKeyboard } from "./service-worker-keyboard.js";
declare const chrome: {
  alarms: {
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm: { addListener(listener: (alarm: { name: string }) => void): void };
  };
  debugger: {
    attach(target: { tabId: number }, version: string): Promise<void>;
    detach(target: { tabId: number }): Promise<void>;
    sendCommand(
      target: { tabId: number },
      method: string,
      params?: Record<string, unknown>,
    ): Promise<unknown>;
    onDetach: {
      addListener(listener: (source: { tabId?: number }) => void): void;
    };
  };
  runtime: {
    onInstalled: { addListener(listener: () => void): void };
    onStartup: { addListener(listener: () => void): void };
  };
  tabs: {
    create(input: { url: string; active: boolean }): Promise<ChromeTab>;
    get(tabId: number): Promise<ChromeTab>;
    query(query: Record<string, unknown>): Promise<ChromeTab[]>;
    remove(tabId: number): Promise<void>;
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
  windows: {
    get(windowId: number): Promise<{ focused?: boolean }>;
    update(windowId: number, input: { focused: boolean }): Promise<unknown>;
  };
};

interface ChromeTab {
  readonly id?: number;
  readonly windowId?: number;
  readonly url?: string;
  readonly title?: string;
  readonly status?: string;
  readonly active?: boolean;
}

interface FrameTreeResult {
  readonly frameTree: {
    readonly frame: {
      readonly id: string;
      readonly loaderId: string;
      readonly url: string;
    };
  };
}

interface RuntimeResult {
  readonly result: { readonly value?: unknown; readonly description?: string };
  readonly exceptionDetails?: unknown;
}

const attachedTabs = new Set<number>();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const requireTabIdentity = (
  tab: ChromeTab,
): { tabId: number; windowId: number } => {
  if (!Number.isInteger(tab.id) || !Number.isInteger(tab.windowId)) {
    throw new Error("TARGET_NOT_FOUND:Chrome tab identity is incomplete");
  }
  return { tabId: tab.id as number, windowId: tab.windowId as number };
};

const ensureAttached = async (tabId: number): Promise<void> => {
  if (attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (error) {
    try {
      // A Manifest V3 service worker can be restarted while Chrome keeps the
      // debugger session owned by this extension alive. In that case the
      // in-memory attachedTabs set is empty even though our own attachment
      // still exists. Detach-and-reattach recovers only an attachment owned by
      // this extension; a foreign DevTools/debugger owner remains fail-closed.
      await chrome.debugger.detach({ tabId });
      await chrome.debugger.attach({ tabId }, "1.3");
    } catch {
      throw new Error(
        `DEVTOOLS_ATTACHMENT_CONFLICT:${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  attachedTabs.add(tabId);
  await chrome.debugger.sendCommand({ tabId }, "Page.enable");
  await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
  await chrome.debugger.sendCommand({ tabId }, "DOM.enable");
};

const detachTab = async (tabId: number): Promise<void> => {
  if (!attachedTabs.has(tabId)) return;
  await chrome.debugger.detach({ tabId }).catch(() => undefined);
  attachedTabs.delete(tabId);
};

const detachAllTabs = async (): Promise<void> => {
  await Promise.all([...attachedTabs].map((tabId) => detachTab(tabId)));
};

const evaluate = async <T>(tabId: number, expression: string): Promise<T> => {
  await ensureAttached(tabId);
  const response = (await chrome.debugger.sendCommand(
    { tabId },
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true, userGesture: true },
  )) as RuntimeResult;
  if (response.exceptionDetails) {
    throw new Error(
      `TARGET_EVALUATION_FAILED:${response.result.description ?? "unknown exception"}`,
    );
  }
  return response.result.value as T;
};

const readDescriptor = async (
  tabId: number,
): Promise<BrowserWireTargetDescriptor> => {
  await ensureAttached(tabId);
  const tab = await chrome.tabs.get(tabId);
  const identity = requireTabIdentity(tab);
  const window = await chrome.windows.get(identity.windowId);
  const frameTree = (await chrome.debugger.sendCommand(
    { tabId },
    "Page.getFrameTree",
  )) as FrameTreeResult;
  const viewport = await evaluate<{
    innerWidth: number;
    innerHeight: number;
    deviceScaleFactor: number;
  }>(
    tabId,
    "({innerWidth:window.innerWidth,innerHeight:window.innerHeight,deviceScaleFactor:window.devicePixelRatio||1})",
  );
  return {
    ...identity,
    url: frameTree.frameTree.frame.url,
    title: tab.title ?? "",
    frameId: frameTree.frameTree.frame.id,
    loaderId: frameTree.frameTree.frame.loaderId,
    viewportWidth: viewport.innerWidth,
    viewportHeight: viewport.innerHeight,
    deviceScaleFactor: viewport.deviceScaleFactor,
    active: tab.active === true,
    windowFocused: window.focused === true,
  };
};

const waitForTab = async (tabId: number): Promise<ChromeTab> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return tab;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("COMMAND_TIMEOUT:target page did not finish loading");
};

const sameOrigin = (left: string, right: string): boolean => {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
};

const acquireTarget = async (
  command: Extract<BrowserWireCommand, { kind: "acquire_target" }>,
): Promise<BrowserWireTargetDescriptor> => {
  const tabs = (await chrome.tabs.query({})).filter(
    (tab) => typeof tab.url === "string",
  );
  const excluded = new Set(command.excludedTabIds);
  const exact = tabs.filter(
    (tab) =>
      tab.url === command.url &&
      Number.isInteger(tab.id) &&
      !excluded.has(tab.id as number),
  );
  const sameOriginTabs = tabs.filter(
    (tab) =>
      sameOrigin(tab.url as string, command.url) &&
      Number.isInteger(tab.id) &&
      !excluded.has(tab.id as number),
  );
  let chosen: ChromeTab | undefined;
  if (
    command.reusePolicy === "reuse-exact-url" ||
    command.reusePolicy === "bind-existing-exact-url"
  ) {
    if (exact.length > 1)
      throw new Error("TARGET_AMBIGUOUS:multiple exact URL tabs");
    chosen = exact[0];
  }
  if (command.reusePolicy === "bind-existing-exact-origin") {
    if (sameOriginTabs.length > 1)
      throw new Error("TARGET_AMBIGUOUS:multiple exact origin tabs");
    chosen = sameOriginTabs[0];
  }
  if (!chosen && command.reusePolicy === "bind-existing-exact-url") {
    throw new Error("TARGET_NOT_FOUND:exact URL tab is not already open");
  }
  if (!chosen && command.reusePolicy === "bind-existing-exact-origin") {
    throw new Error("TARGET_NOT_FOUND:exact origin tab is not already open");
  }
  if (!chosen)
    chosen = await chrome.tabs.create({ url: command.url, active: false });
  const { tabId } = requireTabIdentity(chosen);
  await waitForTab(tabId);
  return readDescriptor(tabId);
};

const assertDocument = async (
  tabId: number,
  expectedLoaderId?: string,
): Promise<void> => {
  if (!expectedLoaderId) return;
  const descriptor = await readDescriptor(tabId);
  if (descriptor.loaderId !== expectedLoaderId) {
    throw new Error("DOCUMENT_STALE:target document generation changed");
  }
};

const sendCommand = (tabId: number, method: string, params?: Record<string, unknown>) =>
  chrome.debugger.sendCommand({ tabId }, method, params);
const keyboard = createServiceWorkerKeyboard(sendCommand);
const interactionRuntime: ServiceWorkerInteractionRuntime = {
  ensureAttached,
  sendCommand,
  readDescriptor,
  detachTab,
  removeTab: (tabId) => chrome.tabs.remove(tabId),
  keyCode: keyboard.keyCode,
  dispatchTypedCharacter: keyboard.dispatchTypedCharacter,
};

type PageCommand = Extract<
  BrowserWireCommand,
  {
    kind:
      | "navigate_target"
      | "evaluate_target"
      | "click_target"
      | "click_dom_target"
      | "fill_dom_target"
      | "move_target"
      | "scroll_target";
  }
>;
const runClickPageCommand = async (
  command: Extract<PageCommand, { kind: "click_target" }>,
): Promise<unknown> => {
  await ensureAttached(command.tabId);
  if (command.button !== "left" || command.clickCount !== 1) {
    throw new Error(
      "BROWSER_COMMAND_FAILED:node-bound click supports one approved left click only",
    );
  }
  const point = { x: Math.round(command.x), y: Math.round(command.y) };
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
    throw new Error(
      "BROWSER_COMMAND_FAILED:click point must normalize to finite integer coordinates",
    );
  }
  const located = asRecord(
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "DOM.getNodeForLocation",
      {
        ...point,
        includeUserAgentShadowDOM: false,
        ignorePointerEventsNone: false,
      },
    ),
  );
  if (!Number.isInteger(located.backendNodeId)) {
    throw new Error(
      "TARGET_NOT_FOUND:click point did not resolve to a DOM node",
    );
  }
  const resolved = asRecord(
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "DOM.resolveNode",
      { backendNodeId: located.backendNodeId },
    ),
  );
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error(
      "TARGET_NOT_FOUND:click DOM node did not resolve to a runtime object",
    );
  }
  const clickResponse = asRecord(
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "Runtime.callFunctionOn",
      {
        objectId,
        functionDeclaration:
          "function(){ const owner=this.closest(\"button,a[href],input[type='button'],input[type='submit'],input[type='text'],[role='button'],kat-button\"); if(!owner)return {ok:false}; owner.focus(); owner.click(); return {ok:true}; }",
        userGesture: true,
        awaitPromise: true,
        returnByValue: true,
      },
    ),
  );
  if (asRecord(asRecord(clickResponse.result).value).ok !== true) {
    throw new Error(
      "TARGET_NOT_FOUND:click point did not resolve to an interactive DOM owner",
    );
  }
  return readDescriptor(command.tabId);
};

const runAtomicDomPageCommand = async (
  command: Extract<
    PageCommand,
    { kind: "click_dom_target" | "fill_dom_target" }
  >,
): Promise<unknown> => {
  if (command.kind === "click_dom_target") {
    await evaluate(command.tabId, atomicDomExpression(command));
    return readDescriptor(command.tabId);
  }
  await runAtomicDomFillKeyboardCommand(command, crypto.randomUUID(), {
    evaluate: <T>(expression: string) => evaluate<T>(command.tabId, expression),
    pressBackspace: async () => {
      const key = keyboard.keyCode("Backspace");
      await chrome.debugger.sendCommand(
        { tabId: command.tabId },
        "Input.dispatchKeyEvent",
        { type: "keyDown", ...key },
      );
      await chrome.debugger.sendCommand(
        { tabId: command.tabId },
        "Input.dispatchKeyEvent",
        { type: "keyUp", ...key },
      );
    },
    typeCharacter: (character: string) =>
      keyboard.dispatchTypedCharacter(command.tabId, character),
  });
  return readDescriptor(command.tabId);
};

const runPageCommand = async (command: PageCommand): Promise<unknown> => {
  if (command.kind === "navigate_target") {
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "Page.navigate",
      { url: command.url },
    );
    await waitForTab(command.tabId);
    return readDescriptor(command.tabId);
  }
  if (command.kind === "evaluate_target")
    return evaluate(command.tabId, command.expression);
  if (command.kind === "click_target") return runClickPageCommand(command);
  if (command.kind === "click_dom_target" || command.kind === "fill_dom_target")
    return runAtomicDomPageCommand(command);
  if (command.kind === "move_target") {
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "Input.dispatchMouseEvent",
      { type: "mouseMoved", x: command.x, y: command.y },
    );
    return readDescriptor(command.tabId);
  }
  if (command.kind === "scroll_target") return runScrollPageCommand(interactionRuntime, command);
  throw new Error("UNKNOWN_COMMAND:unsupported page command");
};

const runCommand = async (
  command: BrowserWireCommand,
  expectedLoaderId?: string,
): Promise<unknown> => {
  if (command.kind === "acquire_target") return acquireTarget(command);
  await assertDocument(command.tabId, expectedLoaderId);
  if (command.kind === "inspect_target") return readDescriptor(command.tabId);
  if (
    [
      "navigate_target",
      "evaluate_target",
      "click_target",
      "click_dom_target",
      "fill_dom_target",
      "move_target",
      "scroll_target",
    ].includes(command.kind)
  ) {
    return runPageCommand(command as PageCommand);
  }
  return runInteractionCommand(interactionRuntime, command as InteractionCommand);
};

configureNativeTransport({
  runCommand,
  onDisconnect: () => {
    void detachAllTabs();
  },
});
chrome.runtime.onInstalled.addListener(connectNativeTransport);
chrome.runtime.onStartup.addListener(connectNativeTransport);
chrome.debugger.onDetach.addListener((source) => {
  if (Number.isInteger(source.tabId))
    attachedTabs.delete(source.tabId as number);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "grasseye-native-reconnect") connectNativeTransport();
});
chrome.alarms.create("grasseye-native-reconnect", { periodInMinutes: 0.5 });
connectNativeTransport();
