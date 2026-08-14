import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { GRASSEYE_BROWSER_PROTOCOL_VERSION } from "../../src/lib/browser/chrome-extension/protocol.js";
import { BrowserNativeTransportServer } from "../../src/lib/browser/exact-target/browser-native-transport-server.js";

const root = await mkdtemp(path.join(tmpdir(), "grasseye-browser-transport-"));
const server = new BrowserNativeTransportServer(path.join(root, "controller.sock"));
await server.start();
const client = net.createConnection(server.socketPath);
client.setEncoding("utf8");
let buffer = "";
const lines: string[] = [];
client.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const index = buffer.indexOf("\n"); if (index < 0) break;
    lines.push(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
  }
});
await new Promise<void>((resolve) => client.once("connect", resolve));
client.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_hello" })}\n`);
while (lines.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
const challenge = JSON.parse(lines.shift()!) as { nonce: string };
assert.equal(challenge.nonce.length, 64);
client.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_authenticated", nonce: challenge.nonce })}\n`);
await server.waitUntilReady(500);
const pending = server.command<{ observed: string }>({ command: { kind: "inspect_target", tabId: 7 }, mutationClass: "observation" });
while (lines.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
const command = JSON.parse(lines.shift()!) as { commandId: string; sequence: number };
client.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "response", commandId: command.commandId, sequence: command.sequence, ok: true, result: { observed: "exact" } })}\n`);
assert.deepEqual((await pending).result, { observed: "exact" });
client.destroy();
await server.close();
process.stdout.write("[local-browser-native-transport] PASS\n");
