import {
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_NATIVE_HOST_NAME,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireMessage,
  type BrowserWireTargetDescriptor,
} from "./protocol.js";
import { commandFingerprint, executeCommand } from "./service-worker-command-execution.js";

declare const chrome: {
  alarms: {
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm: { addListener(listener: (alarm: { name: string }) => void): void };
  };
  debugger: {
    attach(target: { tabId: number }, version: string): Promise<void>;
    detach(target: { tabId: number }): Promise<void>;
    sendCommand(target: { tabId: number }, method: string, params?: Record<string, unknown>): Promise<unknown>;
    onDetach: { addListener(listener: (source: { tabId?: number }) => void): void };
  };
  runtime: {
    connectNative(name: string): NativePort;
    onInstalled: { addListener(listener: () => void): void };
    onStartup: { addListener(listener: () => void): void };
  };
  tabs: {
    create(input: { url: string; active: boolean }): Promise<ChromeTab>;
    get(tabId: number): Promise<ChromeTab>;
    query(query: Record<string, unknown>): Promise<ChromeTab[]>;
    remove(tabId: number): Promise<void>;
    update(tabId: number, input: { active: boolean }): Promise<ChromeTab>;
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
  windows: {
    get(windowId: number): Promise<{ focused?: boolean }>;
    update(windowId: number, input: { focused: boolean }): Promise<unknown>;
  };
};

interface NativePort {
  postMessage(message: BrowserWireMessage): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}

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
    readonly frame: { readonly id: string; readonly loaderId: string; readonly url: string };
  };
}

interface RuntimeResult {
  readonly result: { readonly value?: unknown; readonly description?: string };
  readonly exceptionDetails?: unknown;
}

const attachedTabs = new Set<number>();
let nativePort: NativePort | null = null;
let authenticatedNonce: string | null = null;
let lastAcceptedSequence = 0;

interface CommandReceipt {
  readonly fingerprint: string;
  readonly sequence: number;
  readonly completion: Promise<Extract<BrowserWireMessage, { type: "response" }>>;
  response: Extract<BrowserWireMessage, { type: "response" }> | null;
}

const commandReceipts = new Map<string, CommandReceipt>();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const requireTabIdentity = (tab: ChromeTab): { tabId: number; windowId: number } => {
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
    throw new Error(`DEVTOOLS_ATTACHMENT_CONFLICT:${error instanceof Error ? error.message : String(error)}`);
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
  const response = await chrome.debugger.sendCommand(
    { tabId },
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true, userGesture: true },
  ) as RuntimeResult;
  if (response.exceptionDetails) {
    throw new Error(`TARGET_EVALUATION_FAILED:${response.result.description ?? "unknown exception"}`);
  }
  return response.result.value as T;
};

const readDescriptor = async (tabId: number): Promise<BrowserWireTargetDescriptor> => {
  await ensureAttached(tabId);
  const tab = await chrome.tabs.get(tabId);
  const identity = requireTabIdentity(tab);
  const window = await chrome.windows.get(identity.windowId);
  const frameTree = await chrome.debugger.sendCommand(
    { tabId },
    "Page.getFrameTree",
  ) as FrameTreeResult;
  const viewport = await evaluate<{
    innerWidth: number;
    innerHeight: number;
    deviceScaleFactor: number;
  }>(tabId, "({innerWidth:window.innerWidth,innerHeight:window.innerHeight,deviceScaleFactor:window.devicePixelRatio||1})");
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

const acquireTarget = async (
  command: Extract<BrowserWireCommand, { kind: "acquire_target" }>,
): Promise<BrowserWireTargetDescriptor> => {
  const tabs = (await chrome.tabs.query({})).filter((tab) => typeof tab.url === "string");
  const excluded = new Set(command.excludedTabIds);
  const exact = tabs.filter((tab) =>
    tab.url === command.url && Number.isInteger(tab.id) && !excluded.has(tab.id as number),
  );
  let chosen: ChromeTab | undefined;
  if (command.reusePolicy === "reuse-exact-url") {
    if (exact.length > 1) throw new Error("TARGET_AMBIGUOUS:multiple exact URL tabs");
    chosen = exact[0];
  }
  if (!chosen) chosen = await chrome.tabs.create({ url: command.url, active: false });
  const { tabId } = requireTabIdentity(chosen);
  await waitForTab(tabId);
  return readDescriptor(tabId);
};

const assertDocument = async (tabId: number, expectedLoaderId?: string): Promise<void> => {
  if (!expectedLoaderId) return;
  const descriptor = await readDescriptor(tabId);
  if (descriptor.loaderId !== expectedLoaderId) {
    throw new Error("DOCUMENT_STALE:target document generation changed");
  }
};

const keyCode = (key: string): { code: string; key: string; windowsVirtualKeyCode: number } => {
  const known: Record<string, number> = {
    Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  };
  return { code: key, key, windowsVirtualKeyCode: known[key] ?? key.toUpperCase().charCodeAt(0) };
};

const typedCharacterKey = (character: string): { code: string; key: string; windowsVirtualKeyCode: number } => {
  if (/^[a-z]$/i.test(character)) {
    return { code: `Key${character.toUpperCase()}`, key: character, windowsVirtualKeyCode: character.toUpperCase().charCodeAt(0) };
  }
  if (/^[0-9]$/.test(character)) {
    return { code: `Digit${character}`, key: character, windowsVirtualKeyCode: character.charCodeAt(0) };
  }
  if (character === "-") return { code: "Minus", key: character, windowsVirtualKeyCode: 189 };
  if (character === " ") return { code: "Space", key: character, windowsVirtualKeyCode: 32 };
  return { code: "Unidentified", key: character, windowsVirtualKeyCode: 0 };
};

const dispatchTypedCharacter = async (tabId: number, character: string): Promise<void> => {
  const key = typedCharacterKey(character);
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
    type: "char",
    ...key,
    text: character,
    unmodifiedText: character,
  });
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", ...key });
};

type PageCommand = Extract<BrowserWireCommand, { kind:
  | "navigate_target" | "evaluate_target" | "click_target" | "move_target" | "scroll_target" }>;
type InteractionCommand = Extract<BrowserWireCommand, { kind:
  | "text_target" | "screenshot_target" | "set_file_input_files" | "focus_target" | "release_target" | "close_target" }>;

const runClickPageCommand = async (
  command: Extract<PageCommand, { kind: "click_target" }>,
): Promise<unknown> => {
  await ensureAttached(command.tabId);
  if (command.button !== "left" || command.clickCount !== 1) {
    throw new Error("BROWSER_COMMAND_FAILED:node-bound click supports one approved left click only");
  }
  const point = { x: Math.round(command.x), y: Math.round(command.y) };
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
    throw new Error("BROWSER_COMMAND_FAILED:click point must normalize to finite integer coordinates");
  }
  const located = asRecord(await chrome.debugger.sendCommand(
    { tabId: command.tabId },
    "DOM.getNodeForLocation",
    { ...point, includeUserAgentShadowDOM: false, ignorePointerEventsNone: false },
  ));
  if (!Number.isInteger(located.backendNodeId)) {
    throw new Error("TARGET_NOT_FOUND:click point did not resolve to a DOM node");
  }
  const resolved = asRecord(await chrome.debugger.sendCommand(
    { tabId: command.tabId },
    "DOM.resolveNode",
    { backendNodeId: located.backendNodeId },
  ));
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error("TARGET_NOT_FOUND:click DOM node did not resolve to a runtime object");
  }
  const clickResponse = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: "function(){ const owner=this.closest(\"button,a[href],input[type='button'],input[type='submit'],input[type='text'],[role='button'],kat-button\"); if(!owner)return {ok:false}; owner.focus(); owner.click(); return {ok:true}; }",
    userGesture: true, awaitPromise: true, returnByValue: true,
  }));
  if (asRecord(asRecord(clickResponse.result).value).ok !== true) {
    throw new Error("TARGET_NOT_FOUND:click point did not resolve to an interactive DOM owner");
  }
  return readDescriptor(command.tabId);
};

const runScrollPageCommand = async (
  command: Extract<PageCommand, { kind: "scroll_target" }>,
): Promise<unknown> => {
  await ensureAttached(command.tabId);
  const root = asRecord(await chrome.debugger.sendCommand(
    { tabId: command.tabId }, "DOM.getDocument", { depth: 0 },
  ));
  const rootNode = asRecord(root.root);
  if (!Number.isInteger(rootNode.nodeId)) throw new Error("TARGET_NOT_FOUND:scroll document root is unavailable");
  const resolved = asRecord(await chrome.debugger.sendCommand(
    { tabId: command.tabId }, "DOM.resolveNode", { nodeId: rootNode.nodeId },
  ));
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) throw new Error("TARGET_NOT_FOUND:scroll document did not resolve");
  await chrome.debugger.sendCommand({ tabId: command.tabId }, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: "function(deltaX,deltaY){ const view=this.defaultView; const target=this.scrollingElement||this.documentElement; target.scrollBy(deltaX,deltaY); return {scrollX:view.scrollX,scrollY:view.scrollY}; }",
    arguments: [{ value: command.deltaX }, { value: command.deltaY }],
    userGesture: true, awaitPromise: true, returnByValue: true,
  });
  return readDescriptor(command.tabId);
};

const runPageCommand = async (command: PageCommand): Promise<unknown> => {
  if (command.kind === "navigate_target") {
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Page.navigate", { url: command.url });
    await waitForTab(command.tabId);
    return readDescriptor(command.tabId);
  }
  if (command.kind === "evaluate_target") return evaluate(command.tabId, command.expression);
  if (command.kind === "click_target") return runClickPageCommand(command);
  if (command.kind === "move_target") {
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchMouseEvent", { type: "mouseMoved", x: command.x, y: command.y });
    return readDescriptor(command.tabId);
  }
  if (command.kind === "scroll_target") return runScrollPageCommand(command);
  throw new Error("UNKNOWN_COMMAND:unsupported page command");
};

const runTextCommand = async (
  command: Extract<InteractionCommand, { kind: "text_target" }>,
): Promise<unknown> => {
  await ensureAttached(command.tabId);
  if (command.action === "type-text") {
    for (const character of command.text ?? "") {
      await dispatchTypedCharacter(command.tabId, character);
    }
  } else if (command.action === "clear-input") {
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4 });
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyDown", ...keyCode("Backspace") });
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyUp", ...keyCode("Backspace") });
  } else {
    const key = keyCode(command.key ?? "Enter");
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyDown", ...key });
    await chrome.debugger.sendCommand({ tabId: command.tabId }, "Input.dispatchKeyEvent", { type: "keyUp", ...key });
  }
  return readDescriptor(command.tabId);
};

const runFileInputCommand = async (
  command: Extract<InteractionCommand, { kind: "set_file_input_files" }>,
): Promise<unknown> => {
  await ensureAttached(command.tabId);
  const root = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.getDocument", { depth: 0 }));
  const rootNode = asRecord(root.root);
  const proxyNode = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.querySelector", { nodeId: rootNode.nodeId, selector: command.selector }));
  if (!Number.isInteger(proxyNode.nodeId) || proxyNode.nodeId === 0) throw new Error("TARGET_NOT_FOUND:file input selector did not resolve");
  const proxyResolved = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.resolveNode", { nodeId: proxyNode.nodeId }));
  const proxyObjectId = asRecord(proxyResolved.object).objectId;
  if (typeof proxyObjectId !== "string" || !proxyObjectId) throw new Error("TARGET_NOT_FOUND:file input proxy did not resolve to a runtime object");
  const receiverResponse = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "Runtime.callFunctionOn", {
    objectId: proxyObjectId,
    functionDeclaration: "function(){ if(!(this instanceof HTMLInputElement)||this.type!=='file'||this.disabled)return null; let ancestor=this.parentElement; while(ancestor){ if(ancestor.shadowRoot){ const receivers=Array.from(ancestor.shadowRoot.querySelectorAll(\"input[type='file']\")).filter((input)=>!input.disabled); return receivers.length===1?receivers[0]:null; } ancestor=ancestor.parentElement; } return this; }",
    returnByValue: false,
  }));
  const receiverObjectId = asRecord(receiverResponse.result).objectId;
  if (typeof receiverObjectId !== "string" || !receiverObjectId) {
    throw new Error("TARGET_NOT_FOUND:file input did not resolve to one enabled real receiver");
  }
  const receiverNode = asRecord(await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.requestNode", { objectId: receiverObjectId }));
  if (!Number.isInteger(receiverNode.nodeId) || receiverNode.nodeId === 0) throw new Error("TARGET_NOT_FOUND:real file receiver did not resolve to a DOM node");
  await chrome.debugger.sendCommand({ tabId: command.tabId }, "DOM.setFileInputFiles", { nodeId: receiverNode.nodeId, files: [command.filePath] });
  return readDescriptor(command.tabId);
};

const runFocusCommand = async (
  command: Extract<InteractionCommand, { kind: "focus_target" }>,
): Promise<unknown> => {
  await chrome.windows.update(command.windowId, { focused: true });
  await chrome.tabs.update(command.tabId, { active: true });
  return readDescriptor(command.tabId);
};

const runInteractionCommand = async (command: InteractionCommand): Promise<unknown> => {
  if (command.kind === "text_target") return runTextCommand(command);
  if (command.kind === "screenshot_target") {
    await ensureAttached(command.tabId);
    return chrome.debugger.sendCommand({ tabId: command.tabId }, "Page.captureScreenshot", { format: "png", fromSurface: true });
  }
  if (command.kind === "set_file_input_files") return runFileInputCommand(command);
  if (command.kind === "focus_target") return runFocusCommand(command);
  await detachTab(command.tabId);
  if (command.kind === "release_target") return { released: true };
  await chrome.tabs.remove(command.tabId);
  return { closed: true };
};

const runCommand = async (
  command: BrowserWireCommand,
  expectedLoaderId?: string,
): Promise<unknown> => {
  if (command.kind === "acquire_target") return acquireTarget(command);
  await assertDocument(command.tabId, expectedLoaderId);
  if (command.kind === "inspect_target") return readDescriptor(command.tabId);
  if (["navigate_target", "evaluate_target", "click_target", "move_target", "scroll_target"].includes(command.kind)) {
    return runPageCommand(command as PageCommand);
  }
  return runInteractionCommand(command as InteractionCommand);
};

const trimCommandReceipts = (): void => {
  if (commandReceipts.size <= 512) return;
  for (const [commandId, receipt] of commandReceipts) {
    if (receipt.response) commandReceipts.delete(commandId);
    if (commandReceipts.size <= 512) return;
  }
};

const rejectProtocolCommand = (
  message: Extract<BrowserWireMessage, { type: "command" }>,
  code: string,
  reason: string,
): void => {
  nativePort?.postMessage({
    protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    type: "response",
    commandId: message.commandId,
    sequence: message.sequence,
    ok: false,
    errorCode: code,
    errorMessage: reason,
  });
};

const handleMessage = async (message: unknown): Promise<void> => {
  if (!nativePort || !isBrowserWireMessage(message)) return;
  if (message.type === "controller_challenge") {
    authenticatedNonce = message.nonce;
    lastAcceptedSequence = 0;
    commandReceipts.clear();
    nativePort.postMessage({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_authenticated", nonce: message.nonce });
    return;
  }
  if (message.type !== "command" || !authenticatedNonce) return;
  const fingerprint = commandFingerprint(message);
  const existing = commandReceipts.get(message.commandId);
  if (existing) {
    if (existing.sequence !== message.sequence || existing.fingerprint !== fingerprint) {
      rejectProtocolCommand(message, "COMMAND_ID_CONFLICT", "command id was reused with different content");
      return;
    }
    nativePort.postMessage(await existing.completion);
    return;
  }
  if (!Number.isSafeInteger(message.sequence) || message.sequence !== lastAcceptedSequence + 1) {
    rejectProtocolCommand(
      message,
      message.sequence <= lastAcceptedSequence ? "COMMAND_SEQUENCE_REPLAY" : "COMMAND_SEQUENCE_OUT_OF_ORDER",
      `expected command sequence ${lastAcceptedSequence + 1}, received ${message.sequence}`,
    );
    return;
  }
  lastAcceptedSequence = message.sequence;
  const receipt: CommandReceipt = {
    fingerprint,
    sequence: message.sequence,
    completion: executeCommand(message, runCommand),
    response: null,
  };
  commandReceipts.set(message.commandId, receipt);
  const response = await receipt.completion;
  receipt.response = response;
  nativePort.postMessage(response);
  trimCommandReceipts();
};

const connect = (): void => {
  if (nativePort) return;
  authenticatedNonce = null;
  lastAcceptedSequence = 0;
  commandReceipts.clear();
  const port = chrome.runtime.connectNative(GRASSEYE_NATIVE_HOST_NAME);
  nativePort = port;
  port.onMessage.addListener((message) => { void handleMessage(message); });
  port.onDisconnect.addListener(() => {
    if (nativePort === port) nativePort = null;
    authenticatedNonce = null;
    lastAcceptedSequence = 0;
    commandReceipts.clear();
    void detachAllTabs();
  });
  port.postMessage({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_hello" });
};

chrome.runtime.onInstalled.addListener(connect);
chrome.runtime.onStartup.addListener(connect);
chrome.debugger.onDetach.addListener((source) => { if (Number.isInteger(source.tabId)) attachedTabs.delete(source.tabId as number); });
chrome.tabs.onRemoved.addListener((tabId) => { attachedTabs.delete(tabId); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "grasseye-native-reconnect") connect(); });
chrome.alarms.create("grasseye-native-reconnect", { periodInMinutes: 0.5 });
connect();
