#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { connectControllerChannel } from "./controller-channel.mjs";

const MAX_BYTES = 4 * 1024 * 1024;
const configPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "GrassEye",
  "browser-native-host.json",
);
const config = JSON.parse(await readFile(configPath, "utf8"));
if (config.protocolVersion !== "grasseye-browser-v1") {
  throw new Error("GrassEye Native host protocol version mismatch");
}
if (typeof config.socketPath !== "string" || !path.isAbsolute(config.socketPath)) {
  throw new Error("GrassEye Native host socket path is missing or not absolute");
}

const writeNativeMessage = (message) => {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.byteLength > MAX_BYTES) throw new Error("native response exceeds maximum size");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.byteLength, 0);
  process.stdout.write(header);
  process.stdout.write(body);
};

const channel = connectControllerChannel(config.socketPath, {
  onConnect() {},
  onMessage: writeNativeMessage,
  onError(error) {
    process.stderr.write(`${JSON.stringify({ code: "GRASSEYE_CONTROLLER_CHANNEL_FAILED", reason: error.message })}\n`);
    process.exitCode = 1;
  },
  onClose() { process.exit(); },
});

let input = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  for (;;) {
    if (input.byteLength < 4) return;
    const size = input.readUInt32LE(0);
    if (size > MAX_BYTES) throw new Error("native request exceeds maximum size");
    if (input.byteLength < 4 + size) return;
    const body = input.subarray(4, 4 + size);
    input = input.subarray(4 + size);
    channel.send(JSON.parse(body.toString("utf8")));
  }
});
process.stdin.on("end", () => channel.close());
