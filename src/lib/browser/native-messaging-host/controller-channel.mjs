import net from "node:net";

const MAX_BYTES = 4 * 1024 * 1024;

export const connectControllerChannel = (socketPath, handlers) => {
  const socket = net.createConnection({ path: socketPath });
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer, "utf8") > MAX_BYTES) {
      socket.destroy(new Error("controller message exceeds maximum size"));
      return;
    }
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        handlers.onMessage(JSON.parse(line));
      } catch (error) {
        socket.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
  socket.on("connect", handlers.onConnect);
  socket.on("error", handlers.onError);
  socket.on("close", handlers.onClose);
  return {
    send(message) {
      const payload = `${JSON.stringify(message)}\n`;
      if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
        throw new Error("controller message exceeds maximum size");
      }
      socket.write(payload);
    },
    close() { socket.destroy(); },
  };
};
