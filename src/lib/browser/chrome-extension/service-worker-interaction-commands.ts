import type { BrowserWireCommand, BrowserWireTargetDescriptor } from "./protocol.js";

export type InteractionCommand = Extract<
  BrowserWireCommand,
  {
    kind:
      | "text_target"
      | "screenshot_target"
      | "set_file_input_files"
      | "release_target"
      | "close_target";
  }
>;

export type ServiceWorkerInteractionRuntime = {
  ensureAttached: (tabId: number) => Promise<void>;
  sendCommand: (
    tabId: number,
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  readDescriptor: (tabId: number) => Promise<BrowserWireTargetDescriptor>;
  detachTab: (tabId: number) => Promise<void>;
  removeTab: (tabId: number) => Promise<void>;
  keyCode: (key: string) => {
    code: string;
    key: string;
    windowsVirtualKeyCode: number;
  };
  dispatchTypedCharacter: (tabId: number, character: string) => Promise<void>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const runScrollPageCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<BrowserWireCommand, { kind: "scroll_target" }>,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  const root = asRecord(await runtime.sendCommand(command.tabId, "DOM.getDocument", { depth: 0 }));
  const rootNode = asRecord(root.root);
  if (!Number.isInteger(rootNode.nodeId)) {
    throw new Error("TARGET_NOT_FOUND:scroll document root is unavailable");
  }
  const resolved = asRecord(await runtime.sendCommand(command.tabId, "DOM.resolveNode", {
    nodeId: rootNode.nodeId,
  }));
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error("TARGET_NOT_FOUND:scroll document did not resolve");
  }
  await runtime.sendCommand(command.tabId, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration:
      "function(deltaX,deltaY){ const view=this.defaultView; const target=this.scrollingElement||this.documentElement; target.scrollBy(deltaX,deltaY); return {scrollX:view.scrollX,scrollY:view.scrollY}; }",
    arguments: [{ value: command.deltaX }, { value: command.deltaY }],
    userGesture: true,
    awaitPromise: true,
    returnByValue: true,
  });
  return runtime.readDescriptor(command.tabId);
};

const clearFocusedEditable = async (
  runtime: ServiceWorkerInteractionRuntime,
  tabId: number,
): Promise<void> => {
  const result = asRecord(await runtime.sendCommand(tabId, "Runtime.evaluate", {
    expression: "(()=>{const el=document.activeElement;if(!el)return {ok:false};if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){el.value='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));return {ok:true};}if(el instanceof HTMLElement&&el.isContentEditable){el.textContent='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));return {ok:true};}return {ok:false};})()",
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }));
  if (asRecord(result.result).value && asRecord(asRecord(result.result).value).ok === true) return;
  throw new Error("TARGET_NOT_FOUND:no focused editable receiver");
};

const runTextCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<InteractionCommand, { kind: "text_target" }>,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  if (command.action === "type-text") {
    await runtime.sendCommand(command.tabId, "Input.insertText", { text: command.text ?? "" });
  } else if (command.action === "clear-input") {
    await clearFocusedEditable(runtime, command.tabId);
  } else {
    const key = runtime.keyCode(command.key ?? "Enter");
    await runtime.sendCommand(command.tabId, "Input.dispatchKeyEvent", {
      type: "keyDown", ...key,
    });
    await runtime.sendCommand(command.tabId, "Input.dispatchKeyEvent", {
      type: "keyUp", ...key,
    });
  }
  return runtime.readDescriptor(command.tabId);
};

const runFileInputCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<InteractionCommand, { kind: "set_file_input_files" }>,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  if (!command.fileGrant.grantId || !command.fileGrant.resolvedPath || !command.fileGrant.sha256.startsWith("sha256:")) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  if (!Number.isSafeInteger(command.fileGrant.size) || command.fileGrant.size < 0) {
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }
  const root = asRecord(await runtime.sendCommand(command.tabId, "DOM.getDocument", { depth: 0 }));
  const rootNode = asRecord(root.root);
  const proxyNode = asRecord(await runtime.sendCommand(command.tabId, "DOM.querySelector", {
    nodeId: rootNode.nodeId, selector: command.selector,
  }));
  if (!Number.isInteger(proxyNode.nodeId) || proxyNode.nodeId === 0) {
    throw new Error("TARGET_NOT_FOUND:file input selector did not resolve");
  }
  const proxyResolved = asRecord(await runtime.sendCommand(command.tabId, "DOM.resolveNode", {
    nodeId: proxyNode.nodeId,
  }));
  const proxyObjectId = asRecord(proxyResolved.object).objectId;
  if (typeof proxyObjectId !== "string" || !proxyObjectId) {
    throw new Error("TARGET_NOT_FOUND:file input proxy did not resolve to a runtime object");
  }
  const receiverResponse = asRecord(await runtime.sendCommand(command.tabId, "Runtime.callFunctionOn", {
    objectId: proxyObjectId,
    functionDeclaration:
      "function(){ if(!(this instanceof HTMLInputElement)||this.type!=='file'||this.disabled)return null; let ancestor=this.parentElement; while(ancestor){ if(ancestor.shadowRoot){ const receivers=Array.from(ancestor.shadowRoot.querySelectorAll(\"input[type='file']\")).filter((input)=>!input.disabled); return receivers.length===1?receivers[0]:null; } ancestor=ancestor.parentElement; } return this; }",
    returnByValue: false,
  }));
  const receiverObjectId = asRecord(receiverResponse.result).objectId;
  if (typeof receiverObjectId !== "string" || !receiverObjectId) {
    throw new Error("TARGET_NOT_FOUND:file input did not resolve to one enabled real receiver");
  }
  const receiverNode = asRecord(await runtime.sendCommand(command.tabId, "DOM.requestNode", {
    objectId: receiverObjectId,
  }));
  if (!Number.isInteger(receiverNode.nodeId) || receiverNode.nodeId === 0) {
    throw new Error("TARGET_NOT_FOUND:real file receiver did not resolve to a DOM node");
  }
  await runtime.sendCommand(command.tabId, "DOM.setFileInputFiles", {
    nodeId: receiverNode.nodeId,
    files: [command.fileGrant.resolvedPath],
  });
  return runtime.readDescriptor(command.tabId);
};

export const runInteractionCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: InteractionCommand,
): Promise<unknown> => {
  if (command.kind === "text_target") return runTextCommand(runtime, command);
  if (command.kind === "screenshot_target") {
    await runtime.ensureAttached(command.tabId);
    return runtime.sendCommand(command.tabId, "Page.captureScreenshot", {
      format: "png", fromSurface: true,
    });
  }
  if (command.kind === "set_file_input_files") return runFileInputCommand(runtime, command);
  await runtime.detachTab(command.tabId);
  if (command.kind === "release_target") return { released: true };
  await runtime.removeTab(command.tabId);
  return { closed: true };
};
