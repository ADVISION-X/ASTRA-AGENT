type CdpPageTarget = {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type CdpResponse = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
};

type CdpClient = {
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
};
type PendingCdpCommand = {
  resolve(value: unknown): void;
  reject(reason: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

const DEFAULT_CHROME_DEBUGGING_PORT = 9222;
const CDP_RESPONSE_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCdpPageTarget(value: unknown): value is CdpPageTarget {
  if (!isRecord(value)) return false;
  return typeof value.webSocketDebuggerUrl === "string";
}

function readDebuggingPort(): number {
  const rawPort = process.env.GRASSEYE_CHROME_DEBUGGING_PORT;
  if (!rawPort) return DEFAULT_CHROME_DEBUGGING_PORT;
  const parsed = Number(rawPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHROME_DEBUGGING_PORT;
}

async function readCdpTargets(port: number): Promise<CdpPageTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) {
    throw new Error(`Chrome CDP target list failed with ${response.status}.`);
  }
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload.filter(isCdpPageTarget) : [];
}

function targetMatchesCurrentUrl(target: CdpPageTarget, currentUrl: string): boolean {
  if (target.type !== "page" || !target.url) return false;
  if (target.url === currentUrl) return true;
  try {
    const targetUrl = new URL(target.url);
    const current = new URL(currentUrl);
    return targetUrl.origin === current.origin && targetUrl.pathname === current.pathname;
  } catch {
    return false;
  }
}

async function selectCdpTarget(currentUrl: string, port: number): Promise<CdpPageTarget> {
  const targets = await readCdpTargets(port);
  const matched = targets.find((target) => targetMatchesCurrentUrl(target, currentUrl));
  if (matched) return matched;
  const firstPage = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (firstPage) return firstPage;
  throw new Error("Chrome CDP has no page target for the current tab.");
}

const createCdpSend = (
  socket: WebSocket,
  pending: Map<number, PendingCdpCommand>,
  nextId: { value: number },
) =>
  <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
    const id = nextId.value;
    nextId.value += 1;
    return new Promise<T>((messageResolve, messageReject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        messageReject(new Error(`Chrome CDP command ${method} timed out.`));
      }, CDP_RESPONSE_TIMEOUT_MS);
      pending.set(id, { resolve: (value) => messageResolve(value as T), reject: messageReject, timeout });
      socket.send(JSON.stringify({ id, method, params: params ?? {} }));
    });
  };

const handleCdpMessage = (
  pending: Map<number, PendingCdpCommand>,
  event: MessageEvent,
): void => {
  const parsed: unknown = JSON.parse(String(event.data));
  if (!isRecord(parsed) || typeof parsed.id !== "number") return;
  const handler = pending.get(parsed.id);
  if (!handler) return;
  pending.delete(parsed.id);
  clearTimeout(handler.timeout);
  const response = parsed as CdpResponse;
  if (response.error) {
    handler.reject(new Error(response.error.message ?? "Chrome CDP command failed."));
    return;
  }
  handler.resolve(response.result ?? {});
};

function openCdpClient(webSocketUrl: string): Promise<CdpClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map<number, PendingCdpCommand>();
    const nextId = { value: 1 };
    socket.addEventListener("open", () => {
      resolve({ send: createCdpSend(socket, pending, nextId), close: () => socket.close() });
    }, { once: true });
    socket.addEventListener("message", (event) => handleCdpMessage(pending, event));
    socket.addEventListener("error", () => reject(new Error("Chrome CDP websocket connection failed.")), { once: true });
  });
}

function readNodeId(payload: unknown): number {
  if (!isRecord(payload) || typeof payload.nodeId !== "number" || payload.nodeId <= 0) {
    throw new Error("Chrome CDP could not resolve the file input node.");
  }
  return payload.nodeId;
}

function buildDispatchFileInputEventsScript(selector: string): string {
  return `
const input = document.querySelector(${JSON.stringify(selector)});
if (!(input instanceof HTMLInputElement) || input.type !== "file") {
  return {attached: false, message: "file input not found after CDP selection"};
}
input.dispatchEvent(new Event("input", {bubbles: true}));
input.dispatchEvent(new Event("change", {bubbles: true}));
return {
  attached: Boolean(input.files && input.files.length > 0),
  fileCount: input.files ? input.files.length : 0,
  message: input.files && input.files.length > 0 ? "file input has selected files" : "file input has no selected files",
};
`;
}

function readFileInputVerification(payload: unknown): { attached: boolean; message: string } {
  const result = isRecord(payload) ? payload.result : null;
  const value = isRecord(result) ? result.value : null;
  if (!isRecord(value)) return { attached: false, message: "file input verification returned no value" };
  return {
    attached: value.attached === true,
    message: typeof value.message === "string" ? value.message : "file input verification failed",
  };
}

export async function setFileInputFilesWithCurrentChromeCdp(input: {
  currentUrl: string;
  selector: string;
  filePath: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const port = readDebuggingPort();
    const target = await selectCdpTarget(input.currentUrl, port);
    if (!target.webSocketDebuggerUrl) {
      return { ok: false, message: "Chrome CDP target has no websocket URL." };
    }
    const client = await openCdpClient(target.webSocketDebuggerUrl);
    try {
      const documentPayload = await client.send<{ root: { nodeId: number } }>("DOM.getDocument", { depth: 0, pierce: true });
      const queryPayload = await client.send<unknown>("DOM.querySelector", {
        nodeId: documentPayload.root.nodeId,
        selector: input.selector,
      });
      const nodeId = readNodeId(queryPayload);
      await client.send("DOM.setFileInputFiles", {
        nodeId,
        files: [input.filePath],
      });
      const verification = readFileInputVerification(await client.send("Runtime.evaluate", {
        expression: buildDispatchFileInputEventsScript(input.selector),
        awaitPromise: true,
        returnByValue: true,
      }));
      if (!verification.attached) return { ok: false, message: verification.message };
      return { ok: true, message: "approved file selected through local Chrome CDP" };
    } finally {
      client.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}
