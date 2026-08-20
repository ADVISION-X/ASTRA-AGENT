import type { BrowserWireCommand } from "../protocol/generated/browser-protocol.js";

type ClickCommand = Extract<BrowserWireCommand, { kind: "click_target" }>;

type DebuggerCommand = (
  target: { tabId: number },
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;

export interface ServiceWorkerClickRuntime {
  readonly ensureAttached: (tabId: number) => Promise<void>;
  readonly sendCommand: DebuggerCommand;
  readonly readDescriptor: (tabId: number) => Promise<unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const requireApprovedPoint = (
  command: ClickCommand,
): { x: number; y: number } => {
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
  return point;
};

const locateBackendNode = async (
  command: ClickCommand,
  point: { x: number; y: number },
  sendCommand: DebuggerCommand,
): Promise<number> => {
  const located = asRecord(
    await sendCommand({ tabId: command.tabId }, "DOM.getNodeForLocation", {
      ...point,
      includeUserAgentShadowDOM: false,
      ignorePointerEventsNone: false,
    }),
  );
  if (!Number.isInteger(located.backendNodeId)) {
    throw new Error(
      "TARGET_NOT_FOUND:click point did not resolve to a DOM node",
    );
  }
  return located.backendNodeId as number;
};

const requireInteractiveObject = async (
  command: ClickCommand,
  point: { x: number; y: number },
  backendNodeId: number,
  sendCommand: DebuggerCommand,
): Promise<void> => {
  const resolved = asRecord(
    await sendCommand({ tabId: command.tabId }, "DOM.resolveNode", {
      backendNodeId,
    }),
  );
  const objectId = asRecord(resolved.object).objectId;
  if (typeof objectId !== "string" || !objectId) {
    throw new Error(
      "TARGET_NOT_FOUND:click DOM node did not resolve to a runtime object",
    );
  }
  const validation = asRecord(
    await sendCommand({ tabId: command.tabId }, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration:
        "function(x,y){const doc=this.ownerDocument||this;const hit=doc.elementFromPoint(x,y);const owner=hit?.closest(\"button,a[href],input[type='button'],input[type='submit'],input[type='text'],[role='button'],kat-button\");if(!owner)return {ok:false};const r=owner.getBoundingClientRect();const s=getComputedStyle(owner);return {ok:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!owner.disabled};}",
      arguments: [{ value: point.x }, { value: point.y }],
      awaitPromise: true,
      returnByValue: true,
    }),
  );
  if (
    validation.exceptionDetails ||
    asRecord(asRecord(validation.result).value).ok !== true
  ) {
    throw new Error(
      "TARGET_NOT_FOUND:click point did not resolve to an interactive DOM owner",
    );
  }
};

const dispatchApprovedClick = async (
  command: ClickCommand,
  point: { x: number; y: number },
  sendCommand: DebuggerCommand,
): Promise<void> => {
  const target = { tabId: command.tabId };
  const event = { x: point.x, y: point.y, button: "left", clickCount: 1 };
  await sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...event,
  });
  await sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...event,
  });
};

export const runServiceWorkerClickPageCommand = async (
  command: ClickCommand,
  runtime: ServiceWorkerClickRuntime,
): Promise<unknown> => {
  await runtime.ensureAttached(command.tabId);
  const point = requireApprovedPoint(command);
  const backendNodeId = await locateBackendNode(
    command,
    point,
    runtime.sendCommand,
  );
  await requireInteractiveObject(
    command,
    point,
    backendNodeId,
    runtime.sendCommand,
  );
  await dispatchApprovedClick(command, point, runtime.sendCommand);
  return runtime.readDescriptor(command.tabId);
};
