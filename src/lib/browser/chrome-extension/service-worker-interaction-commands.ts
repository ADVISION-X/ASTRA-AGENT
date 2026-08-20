import type {
  BrowserWireCommand,
  BrowserWireTargetDescriptor,
} from "../protocol/generated/browser-protocol.js";

export type InteractionCommand = Extract<
  BrowserWireCommand,
  {
    kind:
      | "text_target"
      | "screenshot_target"
      | "stage_file_artifact_chunk"
      | "set_file_input_artifact"
      | "release_target"
      | "close_target";
  }
>;

export type ServiceWorkerInteractionRuntime = {
  ensureAttached(tabId: number): Promise<void>;
  sendCommand(
    tabId: number,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown>;
  readDescriptor(tabId: number): Promise<BrowserWireTargetDescriptor>;
  detachTab(tabId: number): Promise<void>;
  removeTab(tabId: number): Promise<void>;
  keyCode(key: string): {
    code: string;
    key: string;
    windowsVirtualKeyCode: number;
  };
  dispatchTypedCharacter(tabId: number, character: string): Promise<void>;
};

type StagedArtifact = {
  fileName: string;
  contentHash: `sha256:${string}`;
  byteLength: number;
  chunkCount: number;
  chunks: Map<number, string>;
};

const stagedArtifacts = new Map<string, StagedArtifact>();

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const bytesFromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const sha256 = async (bytes: Uint8Array): Promise<`sha256:${string}`> => {
  const owned = new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", owned));
  return `sha256:${[...digest].map((item) => item.toString(16).padStart(2, "0")).join("")}`;
};

export const clearStagedBrowserArtifacts = (): void => stagedArtifacts.clear();

export const runScrollPageCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<BrowserWireCommand, { kind: "scroll_target" }>,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  const root = asRecord(
    await runtime.sendCommand(command.tabId, "DOM.getDocument", { depth: 0 }),
  );
  const rootNode = asRecord(root.root);
  if (!Number.isInteger(rootNode.nodeId)) {
    throw new Error("TARGET_NOT_FOUND:scroll document root is unavailable");
  }
  const resolved = asRecord(
    await runtime.sendCommand(command.tabId, "DOM.resolveNode", {
      nodeId: rootNode.nodeId,
    }),
  );
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error("TARGET_NOT_FOUND:scroll document did not resolve");
  }
  await runtime.sendCommand(command.tabId, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration:
      "function(deltaX,deltaY){const view=this.defaultView;const target=this.scrollingElement||this.documentElement;target.scrollBy(deltaX,deltaY);return {scrollX:view.scrollX,scrollY:view.scrollY};}",
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
  const result = asRecord(
    await runtime.sendCommand(tabId, "Runtime.evaluate", {
      expression:
        "(()=>{const el=document.activeElement;if(!el)return {ok:false};if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){el.value='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));return {ok:true};}if(el instanceof HTMLElement&&el.isContentEditable){el.textContent='';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));return {ok:true};}return {ok:false};})()",
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }),
  );
  if (asRecord(asRecord(result.result).value).ok === true) return;
  throw new Error("TARGET_NOT_FOUND:no focused editable receiver");
};

const runTextCommand = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<InteractionCommand, { kind: "text_target" }>,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  if (command.action === "type-text") {
    await runtime.sendCommand(command.tabId, "Input.insertText", {
      text: command.text ?? "",
    });
  } else if (command.action === "clear-input") {
    await clearFocusedEditable(runtime, command.tabId);
  } else {
    const key = runtime.keyCode(command.key ?? "Enter");
    await runtime.sendCommand(command.tabId, "Input.dispatchKeyEvent", {
      type: "keyDown",
      ...key,
    });
    await runtime.sendCommand(command.tabId, "Input.dispatchKeyEvent", {
      type: "keyUp",
      ...key,
    });
  }
  return runtime.readDescriptor(command.tabId);
};

const stageArtifactChunk = (
  command: Extract<InteractionCommand, { kind: "stage_file_artifact_chunk" }>,
): { staged: true } => {
  if (
    command.chunkIndex < 0 ||
    command.chunkIndex >= command.chunkCount ||
    command.chunkCount < 1 ||
    !Number.isSafeInteger(command.byteLength) ||
    command.byteLength < 0
  ) {
    throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:chunk topology");
  }
  const current = stagedArtifacts.get(command.grantRef);
  if (
    current &&
    (current.fileName !== command.fileName ||
      current.contentHash !== command.contentHash ||
      current.byteLength !== command.byteLength ||
      current.chunkCount !== command.chunkCount)
  ) {
    throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:chunk binding");
  }
  const staged = current ?? {
    fileName: command.fileName,
    contentHash: command.contentHash,
    byteLength: command.byteLength,
    chunkCount: command.chunkCount,
    chunks: new Map<number, string>(),
  };
  const prior = staged.chunks.get(command.chunkIndex);
  if (prior && prior !== command.dataBase64) {
    throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:chunk replay");
  }
  staged.chunks.set(command.chunkIndex, command.dataBase64);
  stagedArtifacts.set(command.grantRef, staged);
  return { staged: true };
};

const takeStagedArtifact = async (
  grantRef: string,
): Promise<Readonly<{ fileName: string; base64: string }>> => {
  const staged = stagedArtifacts.get(grantRef);
  stagedArtifacts.delete(grantRef);
  if (!staged || staged.chunks.size !== staged.chunkCount) {
    throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:incomplete artifact");
  }
  const chunks = [...Array(staged.chunkCount)].map((_, index) => {
    const value = staged.chunks.get(index);
    if (!value)
      throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:missing chunk");
    return bytesFromBase64(value);
  });
  const bytes = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (
    bytes.byteLength !== staged.byteLength ||
    (await sha256(bytes)) !== staged.contentHash
  ) {
    throw new Error("BROWSER_FILE_ARTIFACT_GRANT_INVALID:readback mismatch");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return Object.freeze({ fileName: staged.fileName, base64: btoa(binary) });
};

const setFileInputArtifact = async (
  runtime: ServiceWorkerInteractionRuntime,
  command: Extract<InteractionCommand, { kind: "set_file_input_artifact" }>,
): Promise<unknown> => {
  const artifact = await takeStagedArtifact(command.fileGrant.grantRef);
  await runtime.ensureAttached(command.tabId);
  const root = asRecord(
    await runtime.sendCommand(command.tabId, "DOM.getDocument", { depth: 0 }),
  );
  const nodeId = asRecord(root.root).nodeId;
  const matched = asRecord(
    await runtime.sendCommand(command.tabId, "DOM.querySelector", {
      nodeId,
      selector: command.selector,
    }),
  );
  if (!Number.isInteger(matched.nodeId) || matched.nodeId === 0) {
    throw new Error("TARGET_NOT_FOUND:file input selector did not resolve");
  }
  const resolved = asRecord(
    await runtime.sendCommand(command.tabId, "DOM.resolveNode", {
      nodeId: matched.nodeId,
    }),
  );
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error("TARGET_NOT_FOUND:file input did not resolve");
  }
  const result = asRecord(
    await runtime.sendCommand(command.tabId, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration:
        "function(base64,fileName){if(!(this instanceof HTMLInputElement)||this.type!=='file'||this.disabled)return {ok:false};const raw=atob(base64);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const files=new DataTransfer();files.items.add(new File([bytes],fileName));this.files=files.files;this.dispatchEvent(new Event('input',{bubbles:true}));this.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true,count:this.files.length,name:this.files[0]?.name||null};}",
      arguments: [{ value: artifact.base64 }, { value: artifact.fileName }],
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }),
  );
  if (asRecord(asRecord(result.result).value).ok !== true) {
    throw new Error("TARGET_NOT_FOUND:file input receiver is unavailable");
  }
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
      format: "png",
      fromSurface: true,
    });
  }
  if (command.kind === "stage_file_artifact_chunk")
    return stageArtifactChunk(command);
  if (command.kind === "set_file_input_artifact")
    return setFileInputArtifact(runtime, command);
  await runtime.detachTab(command.tabId);
  if (command.kind === "release_target") return { released: true };
  await runtime.removeTab(command.tabId);
  return { closed: true };
};
