import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { GRASSEYE_BROWSER_PROTOCOL_VERSION } from "../../src/lib/browser/chrome-extension/protocol.js";
import { BrowserNativeTransportServer } from "../../src/lib/browser/exact-target/browser-native-transport-server.js";

const execFileAsync = promisify(execFile);

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

const installerPath = path.resolve("src/lib/browser/native-messaging-host/install.mjs");
const sourceHostPath = path.resolve("src/lib/browser/native-messaging-host/host.mjs");
const installHome = await mkdtemp(path.join(tmpdir(), "grasseye-browser-install-"));
const installDataDir = path.join(installHome, "data");
const sourceModeBefore = (await stat(sourceHostPath)).mode;
const runInstaller = async (...args: string[]) => execFileAsync(
  process.execPath,
  [installerPath, "--data-dir", installDataDir, ...args],
  { env: { ...process.env, HOME: installHome } },
);
try {
  const installed = JSON.parse((await runInstaller()).stdout) as { hostPath: string; installedManifest: string };
  assert.ok(installed.hostPath.startsWith(path.join(installHome, "Library", "Application Support", "GrassEye")));
  assert.equal((await readFile(installed.hostPath, "utf8")).startsWith(`#!${process.execPath}\n`), true);
  const nativeManifest = JSON.parse(await readFile(installed.installedManifest, "utf8")) as { path: string };
  assert.equal(nativeManifest.path, installed.hostPath);
  assert.equal((await stat(installed.hostPath)).mode & 0o100, 0o100);
  assert.equal((await stat(sourceHostPath)).mode, sourceModeBefore);
  assert.equal(JSON.parse((await runInstaller("--verify")).stdout).status, "VERIFIED");
  assert.equal(JSON.parse((await runInstaller("--uninstall")).stdout).status, "UNINSTALLED");
  await assert.rejects(stat(installed.hostPath));
} finally {
  await rm(installHome, { force: true, recursive: true });
}
process.stdout.write("[local-browser-native-transport] PASS\n");
