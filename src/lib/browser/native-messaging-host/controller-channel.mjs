import net from "node:net";

const MAX_BYTES = 4 * 1024 * 1024;
const INITIAL_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;

export const connectControllerChannel = (socketPath, handlers) => {
  let socket = null;
  let buffer = "";
  let closed = false;
  let retryTimer = null;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;
  let hasConnected = false;
  let pending = [];
  let pendingBytes = 0;

  const flushPending = () => {
    if (!socket || socket.destroyed || !socket.writable) return;
    const queued = pending;
    pending = [];
    pendingBytes = 0;
    for (const payload of queued) socket.write(payload);
  };

  const scheduleRetry = () => {
    if (closed || hasConnected || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
  };

  const connect = () => {
    if (closed || socket) return;
    const nextSocket = net.createConnection({ path: socketPath });
    socket = nextSocket;
    let nextBuffer = "";
    nextSocket.setEncoding("utf8");
    nextSocket.on("data", (chunk) => {
      nextBuffer += chunk;
      if (Buffer.byteLength(nextBuffer, "utf8") > MAX_BYTES) {
        nextSocket.destroy(new Error("controller message exceeds maximum size"));
        return;
      }
      for (;;) {
        const newline = nextBuffer.indexOf("\n");
        if (newline < 0) break;
        const line = nextBuffer.slice(0, newline);
        nextBuffer = nextBuffer.slice(newline + 1);
        if (!line) continue;
        try {
          handlers.onMessage(JSON.parse(line));
        } catch (error) {
          nextSocket.destroy(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
    nextSocket.on("connect", () => {
      hasConnected = true;
      retryDelayMs = INITIAL_RETRY_DELAY_MS;
      handlers.onConnect();
      flushPending();
    });
    nextSocket.on("error", (error) => {
      if (hasConnected) handlers.onError(error);
    });
    nextSocket.on("close", () => {
      if (socket !== nextSocket) return;
      socket = null;
      if (hasConnected) handlers.onClose();
      else scheduleRetry();
    });
  };

  connect();
  return {
    send(message) {
      const payload = `${JSON.stringify(message)}\n`;
      if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
        throw new Error("controller message exceeds maximum size");
      }
      if (!socket || socket.destroyed || !socket.writable) {
        if (pendingBytes + Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
          throw new Error("pending controller messages exceed maximum size");
        }
        pending.push(payload);
        pendingBytes += Buffer.byteLength(payload, "utf8");
        return;
      }
      socket.write(payload);
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      pending = [];
      pendingBytes = 0;
      socket?.destroy();
      socket = null;
    },
  };
};
