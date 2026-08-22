import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Socket } from "node:net";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";

const path = "/browser-authority/v1";
const acceptKey = (key: string): string => createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");

export const upgradeWorkbenchBrowserAuthoritySocket = (input: Readonly<{ request: IncomingMessage; socket: Duplex; head: Buffer; workbench: GrassEyeWorkbenchHandle }>): boolean => {
  const requestUrl = new URL(input.request.url ?? "/", "http://127.0.0.1");
  const upgrade = input.request.headers.upgrade;
  const key = input.request.headers["sec-websocket-key"];
  const version = input.request.headers["sec-websocket-version"];
  const address = (input.socket as Socket).remoteAddress;
  if (requestUrl.pathname !== path || typeof key !== "string" || version !== "13" || typeof upgrade !== "string" || upgrade.toLowerCase() !== "websocket" || !isLoopback(address)) return false;
  input.socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${acceptKey(key)}`, "", ""].join("\r\n"));
  const endpoint = input.workbench.acceptBrowserAuthoritySocket({
    send: (payload) => input.socket.write(encodeServerWebSocketTextFrame(payload)),
    close: () => input.socket.destroy(),
  });
  let buffer = input.head;
  let disconnected = false;
  const disconnect = (reasonCode: string, refs?: Readonly<Record<string, string>>): void => {
    if (disconnected) return;
    disconnected = true;
    endpoint.disconnect(reasonCode, refs);
  };
  const consume = (): void => {
    const result = decodeClientWebSocketFrames(buffer);
    buffer = result.rest;
    for (const reply of result.controlReplies) input.socket.write(reply);
    for (const payload of result.payloads) endpoint.receive(payload);
    if (result.closed) disconnect("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", {
      transportEvent: "peer_close",
      closeCode: String(result.closeCode ?? 1005),
      closeReason: result.closeReason || "none",
    });
  };
  try { consume(); } catch { disconnect("BROWSER_AUTH_FRAME_INVALID"); input.socket.destroy(); }
  input.socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    try { consume(); } catch { disconnect("BROWSER_AUTH_FRAME_INVALID"); input.socket.destroy(); }
  });
  input.socket.on("close", (hadError: boolean) => disconnect("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", {
    transportEvent: "tcp_close",
    hadError: String(hadError),
  }));
  input.socket.on("error", (error: NodeJS.ErrnoException) => disconnect("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", {
    transportEvent: "tcp_error",
    errorCode: error.code ?? error.name,
  }));
  return true;
};

const isLoopback = (address: string | undefined): boolean => address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";

export const encodeServerWebSocketTextFrame = (payload: string): Buffer => {
  const bytes = Buffer.from(payload, "utf8");
  let head: Buffer;
  if (bytes.byteLength < 126) {
    head = Buffer.from([0x81, bytes.byteLength]);
  } else if (bytes.byteLength <= 65_535) {
    head = Buffer.allocUnsafe(4);
    head[0] = 0x81;
    head[1] = 126;
    head.writeUInt16BE(bytes.byteLength, 2);
  } else {
    head = Buffer.allocUnsafe(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(bytes.byteLength), 2);
  }
  return Buffer.concat([head, bytes]);
};

type DecodedClientFrame = Readonly<{
  body: Buffer;
  final: boolean;
  nextOffset: number;
  opcode: number;
}>;

const assertClientFrameHeader = (input: {
  final: boolean;
  opcode: number;
  masked: boolean;
  control: boolean;
  lengthMarker: number;
}): void => {
  if (!input.masked) throw new Error("BROWSER_AUTH_FRAME_INVALID");
  if (![0x0, 0x1, 0x8, 0x9, 0xa].includes(input.opcode)) {
    throw new Error("BROWSER_AUTH_FRAME_INVALID");
  }
  if (input.control && (!input.final || input.lengthMarker > 125)) throw new Error("BROWSER_AUTH_FRAME_INVALID");
};

const clientFrameHeaderLength = (lengthMarker: number): number => {
  if (lengthMarker < 126) return 2;
  if (lengthMarker === 126) return 4;
  return 10;
};

const clientFramePayloadLength = (input: Buffer, offset: number, lengthMarker: number): number | null => {
  if (lengthMarker < 126) return lengthMarker;
  const header = clientFrameHeaderLength(lengthMarker);
  if (offset + header > input.byteLength) return null;
  const encoded = lengthMarker === 126
    ? BigInt(input.readUInt16BE(offset + 2))
    : input.readBigUInt64BE(offset + 2);
  if (encoded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("BROWSER_AUTH_FRAME_INVALID");
  return Number(encoded);
};

const decodeClientFrameAt = (
  input: Buffer,
  offset: number,
): DecodedClientFrame | null => {
  if (offset + 2 > input.byteLength) return null;
  const first = input[offset]!;
  const second = input[offset + 1]!;
  const opcode = first & 0x0f;
  const lengthMarker = second & 0x7f;
  assertClientFrameHeader({
    final: (first & 0x80) !== 0,
    opcode,
    masked: (second & 0x80) !== 0,
    control: opcode >= 0x8,
    lengthMarker,
  });
  const header = clientFrameHeaderLength(lengthMarker);
  const length = clientFramePayloadLength(input, offset, lengthMarker);
  if (length === null) return null;
  if (offset + header + 4 > input.byteLength) return null;
  const bodyStart = offset + header + 4;
  const nextOffset = bodyStart + length;
  if (nextOffset > input.byteLength) return null;
  const mask = input.subarray(offset + header, bodyStart);
  const body = Buffer.from(input.subarray(bodyStart, nextOffset));
  for (let index = 0; index < body.byteLength; index += 1) {
    body[index] = body[index]! ^ mask[index % 4]!;
  }
  return { body, final: (first & 0x80) !== 0, nextOffset, opcode };
};

const applyDecodedClientFrame = (input: {
  frame: DecodedClientFrame;
  payloads: string[];
  controlReplies: Buffer[];
}): Readonly<{ closed: boolean; closeCode: number | null; closeReason: string }> => {
  if (input.frame.opcode === 0x1) input.payloads.push(input.frame.body.toString("utf8"));
  if (input.frame.opcode === 0x8) {
    const closeCode = input.frame.body.byteLength >= 2 ? input.frame.body.readUInt16BE(0) : null;
    const closeReason = input.frame.body.byteLength > 2 ? input.frame.body.subarray(2).toString("utf8").slice(0, 123) : "";
    return { closed: true, closeCode, closeReason };
  }
  if (input.frame.opcode === 0x9) input.controlReplies.push(encodeControlFrame(0x0a, input.frame.body));
  return { closed: false, closeCode: null, closeReason: "" };
};

export const decodeClientWebSocketFrames = (input: Buffer): Readonly<{
  payloads: readonly string[];
  controlReplies: readonly Buffer[];
  closed: boolean;
  closeCode: number | null;
  closeReason: string;
  rest: Buffer;
}> => {
  const payloads: string[] = [];
  const controlReplies: Buffer[] = [];
  let closed = false;
  let closeCode: number | null = null;
  let closeReason = "";
  let offset = 0;
  let fragmentedMessageStart: number | null = null;
  let fragmentedMessage: Buffer[] | null = null;
  const deferredControlReplies: Buffer[] = [];
  while (true) {
    const frameOffset = offset;
    const frame = decodeClientFrameAt(input, offset);
    if (!frame) break;
    offset = frame.nextOffset;
    if (frame.opcode === 0x1) {
      if (fragmentedMessage) throw new Error("BROWSER_AUTH_FRAME_INVALID");
      if (frame.final) payloads.push(frame.body.toString("utf8"));
      else {
        fragmentedMessageStart = frameOffset;
        fragmentedMessage = [frame.body];
      }
      continue;
    }
    if (frame.opcode === 0x0) {
      if (!fragmentedMessage) throw new Error("BROWSER_AUTH_FRAME_INVALID");
      fragmentedMessage.push(frame.body);
      if (frame.final) {
        payloads.push(Buffer.concat(fragmentedMessage).toString("utf8"));
        fragmentedMessage = null;
        fragmentedMessageStart = null;
        controlReplies.push(...deferredControlReplies.splice(0));
      }
      continue;
    }
    const replies = fragmentedMessage ? deferredControlReplies : controlReplies;
    const applied = applyDecodedClientFrame({ frame, payloads, controlReplies: replies });
    closed = applied.closed;
    closeCode = applied.closeCode;
    closeReason = applied.closeReason;
    if (closed) break;
  }
  if (fragmentedMessage && fragmentedMessageStart !== null) {
    return { payloads, controlReplies, closed, closeCode, closeReason, rest: input.subarray(fragmentedMessageStart) };
  }
  return { payloads, controlReplies, closed, closeCode, closeReason, rest: input.subarray(offset) };
};

const encodeControlFrame = (opcode: 0x0a, payload: Buffer): Buffer =>
  Buffer.concat([Buffer.from([0x80 | opcode, payload.byteLength]), payload]);
