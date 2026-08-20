import {
  type BrowserWireCommand,
  type BrowserWireTargetDescriptor,
} from "../protocol/generated/browser-protocol.js";
import {
  atomicDomExpression,
  runAtomicDomFillKeyboardCommand,
} from "./atomic-dom-command.js";
import {
  configureNativeTransport,
  connectNativeTransport,
  handleNativeReconnectAlarm,
} from "./service-worker-native-transport.js";
import {
  runInteractionCommand,
  runScrollPageCommand,
  type ServiceWorkerInteractionRuntime,
  type InteractionCommand,
} from "./service-worker-interaction-commands.js";
import { createServiceWorkerKeyboard } from "./service-worker-keyboard.js";
import type {
  ChromeTab,
  FrameTreeResult,
  RuntimeResult,
} from "./service-worker-contracts.js";
import {
  assertAllowedUrl,
  sameOrigin,
} from "./service-worker-origin-policy.js";
import { runServiceWorkerClickPageCommand } from "./service-worker-click-command.js";

declare const chrome: {
  alarms: {
    create(
      name: string,
      info: { periodInMinutes?: number; delayInMinutes?: number },
    ): void;
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
  };
};

const attachedTabs = new Set<number>();

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

const runStaticPageProcedure = async <T>(
  tabId: number,
  expression: string,
  allowSideEffects: boolean,
): Promise<T> => {
  await ensureAttached(tabId);
  const response = (await chrome.debugger.sendCommand(
    { tabId },
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: allowSideEffects,
      throwOnSideEffect: !allowSideEffects,
      timeout: 10_000,
    },
  )) as RuntimeResult;
  if (response.exceptionDetails) {
    throw new Error(
      `TARGET_EVALUATION_FAILED:${response.result.description ?? "unknown exception"}`,
    );
  }
  return response.result.value as T;
};

const readStaticPageValue = <T>(
  tabId: number,
  expression: string,
): Promise<T> => runStaticPageProcedure<T>(tabId, expression, false);

const runStaticPageMutation = <T>(
  tabId: number,
  expression: string,
): Promise<T> => runStaticPageProcedure<T>(tabId, expression, true);

const readDescriptor = async (
  tabId: number,
): Promise<BrowserWireTargetDescriptor> => {
  await ensureAttached(tabId);
  const tab = await chrome.tabs.get(tabId);
  const identity = requireTabIdentity(tab);
  await chrome.windows.get(identity.windowId);
  const frameTree = (await chrome.debugger.sendCommand(
    { tabId },
    "Page.getFrameTree",
  )) as FrameTreeResult;
  assertAllowedUrl(frameTree.frameTree.frame.url);
  const viewport = await readStaticPageValue<{
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
    loaderId: frameTree.frameTree.frame.loaderId,
    viewportWidth: viewport.innerWidth,
    viewportHeight: viewport.innerHeight,
    deviceScaleFactor: viewport.deviceScaleFactor,
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
  assertAllowedUrl(command.url);
  const tabs = (await chrome.tabs.query({})).filter(
    (tab) =>
      typeof tab.url === "string" &&
      (() => {
        try {
          assertAllowedUrl(tab.url as string);
          return true;
        } catch {
          return false;
        }
      })(),
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

const structuralDomSnapshotExpression = `
(() => {
  const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, 120);
  const selector = (el) => {
    const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
    if (testId) return "[data-testid='" + CSS.escape(testId) + "']";
    if (el.id) return "#" + CSS.escape(el.id);
    const name = el.getAttribute("name");
    if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
    return el.tagName.toLowerCase();
  };
  const summary = (el) => {
    const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
    const tagName = el.tagName.toLowerCase(); const type = clip(el.getAttribute("type"));
    return { tagName, ...(type ? { type } : {}), ...(clip(el.getAttribute("role")) ? { role: clip(el.getAttribute("role")) } : {}), ...(clip(el.getAttribute("aria-label") || el.getAttribute("label")) ? { ariaLabel: clip(el.getAttribute("aria-label") || el.getAttribute("label")) } : {}), ...(clip(el.getAttribute("placeholder")) ? { placeholder: clip(el.getAttribute("placeholder")) } : {}), ...(clip(el.getAttribute("name")) ? { name: clip(el.getAttribute("name")) } : {}), ...(clip(el.id) ? { id: clip(el.id) } : {}), ...(clip(el.innerText || el.textContent || el.value) ? { visibleText: clip(el.innerText || el.textContent || el.value) } : {}), disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"), hidden: style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0, selectorCandidate: selector(el), ...(el.form?.id ? { formId: el.form.id } : {}), ...(clip(el.getAttribute("data-testid") || el.getAttribute("data-automation-id")) ? { testId: clip(el.getAttribute("data-testid") || el.getAttribute("data-automation-id")) } : {}) };
  };
  const visible = (item) => !item.hidden;
  const inputs = Array.from(document.querySelectorAll("input,textarea,select,kat-input")).map((el) => ({ ...summary(el), type: clip(el.getAttribute("type")) || el.tagName.toLowerCase(), ...(el.getAttribute("type") === "password" ? {} : { valuePreview: clip(el.value) }) })).filter(visible);
  const buttons = Array.from(document.querySelectorAll("button,kat-button,[role='button'],input[type='button'],input[type='submit']")).map(summary).filter(visible);
  const links = Array.from(document.querySelectorAll("a[href]")).map((el) => { let hrefHost; try { hrefHost = new URL(el.href).host; } catch {} return { ...summary(el), ...(hrefHost ? { hrefHost } : {}) }; }).filter(visible);
  const fileInputs = Array.from(document.querySelectorAll("input[type='file']")).map((el) => ({ ...summary(el), type: "file", ...(clip(el.getAttribute("accept")) ? { accept: clip(el.getAttribute("accept")) } : {}) }));
  const candidates = (query, candidateKind, max) => Array.from(document.querySelectorAll(query)).map((el) => ({ ...summary(el), candidateKind })).filter(visible).slice(0, max);
  const raw = String(document.body?.innerText || ""); const detectedStates = [];
  if (/sign\\s*in|log\\s*in|password|session expired/i.test(raw)) detectedStates.push("login_required");
  if (/captcha|verification code|two[- ]?factor|2fa|otp/i.test(raw)) detectedStates.push("captcha_or_2fa_required");
  if (/file attached|attachment added|file selected/i.test(raw)) detectedStates.push("file_selected");
  if (/success|successful|completed|submitted|saved|done|完成|成功|已提交/i.test(raw)) detectedStates.push("success_message");
  if (/failed|invalid|error|unable|cannot|失败|无效|错误|无法/i.test(raw)) detectedStates.push("error_message");
  return { url: location.href, title: document.title, forms: Array.from(document.forms).map((form) => ({ selectorCandidate: selector(form), ...(form.id ? { id: form.id } : {}), ...(form.getAttribute("name") ? { name: form.getAttribute("name") } : {}), inputCount: form.querySelectorAll("input,textarea,select").length, buttonCount: form.querySelectorAll("button,[role='button'],input[type='submit']").length })), inputs, buttons, links, fileInputs, dialogs: [], frames: [], textBlocks: candidates("td,th,p,li", "text-block", 120), tableRows: candidates("tr", "table-row", 80), roleRows: candidates("[role='row']", "role-row", 80), genericClickableElements: candidates("[onclick],[tabindex],[role='button'],[role='link']", "clickable", 80), dropdownTriggers: candidates("[role='combobox'],[aria-haspopup='listbox'],[aria-expanded],select", "dropdown-trigger", 80), overlays: candidates("dialog,[role='dialog'],[aria-modal='true']", "overlay", 40), loadingIndicators: candidates("[aria-busy='true'],[role='progressbar']", "loading-indicator", 40), stickyElements: candidates("header,nav", "sticky-element", 40), detectedStates: Array.from(new Set(detectedStates)), capturedAt: new Date().toISOString() };
})()
`;

const observeNamedCapability = async (
  tabId: number,
  capabilityId: Extract<
    BrowserWireCommand,
    { kind: "observe_capability" }
  >["capabilityId"],
): Promise<unknown> => {
  if (capabilityId === "dom.snapshot.structural.v1") {
    return readStaticPageValue(tabId, structuralDomSnapshotExpression);
  }
  throw new Error(`BROWSER_CAPABILITY_PROBE_FAILED:${capabilityId}`);
};

const sendCommand = (
  tabId: number,
  method: string,
  params?: Record<string, unknown>,
) => chrome.debugger.sendCommand({ tabId }, method, params);
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
      | "click_target"
      | "click_dom_target"
      | "fill_dom_target"
      | "move_target"
      | "scroll_target";
  }
>;

const runAtomicDomPageCommand = async (
  command: Extract<
    PageCommand,
    { kind: "click_dom_target" | "fill_dom_target" }
  >,
): Promise<unknown> => {
  if (command.kind === "click_dom_target") {
    await runStaticPageMutation(command.tabId, atomicDomExpression(command));
    return readDescriptor(command.tabId);
  }
  await runAtomicDomFillKeyboardCommand(command, crypto.randomUUID(), {
    evaluate: <T>(expression: string) =>
      runStaticPageMutation<T>(command.tabId, expression),
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
    assertAllowedUrl(command.url);
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "Page.navigate",
      { url: command.url },
    );
    await waitForTab(command.tabId);
    return readDescriptor(command.tabId);
  }
  if (command.kind === "click_target") {
    return runServiceWorkerClickPageCommand(command, {
      ensureAttached,
      sendCommand: (target, method, params) =>
        sendCommand(target.tabId, method, params),
      readDescriptor,
    });
  }
  if (
    command.kind === "click_dom_target" ||
    command.kind === "fill_dom_target"
  ) {
    return runAtomicDomPageCommand(command);
  }
  if (command.kind === "move_target") {
    await ensureAttached(command.tabId);
    await chrome.debugger.sendCommand(
      { tabId: command.tabId },
      "Input.dispatchMouseEvent",
      {
        type: "mouseMoved",
        x: command.x,
        y: command.y,
      },
    );
    return readDescriptor(command.tabId);
  }
  if (command.kind === "scroll_target")
    return runScrollPageCommand(interactionRuntime, command);
  throw new Error("UNKNOWN_COMMAND:unsupported page command");
};

const runCommand = async (
  command: BrowserWireCommand,
  expectedLoaderId?: string,
): Promise<unknown> => {
  if (command.kind === "acquire_target") return acquireTarget(command);
  await assertDocument(command.tabId, expectedLoaderId);
  if (command.kind === "inspect_target") return readDescriptor(command.tabId);
  if (command.kind === "observe_capability") {
    return observeNamedCapability(command.tabId, command.capabilityId);
  }
  if (
    [
      "navigate_target",
      "click_target",
      "click_dom_target",
      "fill_dom_target",
      "move_target",
      "scroll_target",
    ].includes(command.kind)
  ) {
    return runPageCommand(command as PageCommand);
  }
  return runInteractionCommand(
    interactionRuntime,
    command as InteractionCommand,
  );
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
  if (alarm.name === "grasseye-native-reconnect") handleNativeReconnectAlarm();
});
chrome.alarms.create("grasseye-native-reconnect", { periodInMinutes: 0.5 });
connectNativeTransport();
