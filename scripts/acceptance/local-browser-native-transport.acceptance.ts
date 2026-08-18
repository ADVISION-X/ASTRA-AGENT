import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { GRASSEYE_BROWSER_PROTOCOL_VERSION } from "../../src/lib/browser/chrome-extension/protocol.js";
import {
  configureNativeTransport,
  connectNativeTransport,
} from "../../src/lib/browser/chrome-extension/service-worker-native-transport.js";
import { BrowserCommandRuntime } from "../../src/lib/browser/exact-target/browser-command-runtime.js";
import { BrowserNativeTransportServer } from "../../src/lib/browser/exact-target/browser-native-transport-server.js";
import type { BrowserWireTargetDescriptor } from "../../src/lib/browser/chrome-extension/protocol.js";

const execFileAsync = promisify(execFile);

const root = await mkdtemp(path.join(tmpdir(), "grasseye-browser-transport-"));
const lifecycleStages: string[] = [];
const server = new BrowserNativeTransportServer(
  path.join(root, "controller.sock"),
  (event) => lifecycleStages.push(event.stage),
);
await server.start();
assert.deepEqual(lifecycleStages, ["listener_ready"]);
const duplicate = new BrowserNativeTransportServer(server.socketPath);
await assert.rejects(duplicate.start(), /BROWSER_CONTROLLER_ALREADY_OWNED/u);
assert.deepEqual(lifecycleStages, ["listener_ready"], "duplicate owner must not replace the first listener");
await duplicate.close();
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
assert.deepEqual(lifecycleStages, ["listener_ready", "socket_connected", "extension_hello", "authenticated"]);
const pending = server.command<{ observed: string }>({ command: { kind: "inspect_target", tabId: 7 }, mutationClass: "observation" });
while (lines.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
const command = JSON.parse(lines.shift()!) as { commandId: string; sequence: number };
client.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "response", commandId: command.commandId, sequence: command.sequence, ok: true, result: { observed: "exact" } })}\n`);
assert.deepEqual((await pending).result, { observed: "exact" });
client.destroy();
while (!lifecycleStages.includes("disconnected")) await new Promise((resolve) => setTimeout(resolve, 5));
await server.close();

const runtimeSocket = path.join(root, "runtime.sock");
const runtime = new BrowserCommandRuntime("acceptance-controller", runtimeSocket, root);
while (!(await stat(runtimeSocket).catch(() => null))) await new Promise((resolve) => setTimeout(resolve, 5));
const descriptor: BrowserWireTargetDescriptor = {
  tabId: 19,
  windowId: 2,
  url: "https://example.test/target",
  title: "exact target",
  frameId: "frame-1",
  loaderId: "loader-1",
  viewportWidth: 100,
  viewportHeight: 100,
  deviceScaleFactor: 1,
  active: false,
  windowFocused: false,
};
const runtimeTarget = runtime.registry.register("acceptance-owner", descriptor);
const runtimeClient = net.createConnection(runtimeSocket);
runtimeClient.setEncoding("utf8");
let runtimeBuffer = "";
runtimeClient.on("data", (chunk) => { runtimeBuffer += chunk; });
await new Promise<void>((resolve) => runtimeClient.once("connect", resolve));
runtimeClient.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_hello" })}\n`);
while (!runtimeBuffer.includes("\n")) await new Promise((resolve) => setTimeout(resolve, 5));
const runtimeChallenge = JSON.parse(runtimeBuffer.slice(0, runtimeBuffer.indexOf("\n"))) as { nonce: string };
runtimeClient.write(`${JSON.stringify({ protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION, type: "extension_authenticated", nonce: runtimeChallenge.nonce })}\n`);
await runtime.transport.waitUntilReady(500);
runtimeClient.destroy();
while (runtime.isReady()) await new Promise((resolve) => setTimeout(resolve, 5));
assert.throws(
  () => runtime.registry.resolve(runtimeTarget.targetRef, runtimeTarget.documentRef),
  /TARGET_CLOSED/u,
  "transport disconnect must invalidate every issued target ref",
);
await runtime.close();

type NativeListener<T> = (value: T) => void;
const createFakeNativePort = () => {
  const messages: unknown[] = [];
  const messageListeners: NativeListener<unknown>[] = [];
  const disconnectListeners: NativeListener<void>[] = [];
  return {
    messages,
    port: {
      postMessage(message: unknown) { messages.push(message); },
      disconnect() {},
      onMessage: {
        addListener(listener: NativeListener<unknown>) {
          messageListeners.push(listener);
        },
      },
      onDisconnect: {
        addListener(listener: NativeListener<void>) {
          disconnectListeners.push(listener);
        },
      },
    },
    emitMessage(message: unknown) {
      for (const listener of messageListeners) listener(message);
    },
    emitDisconnect() {
      for (const listener of disconnectListeners) listener();
    },
  };
};
const firstPort = createFakeNativePort();
const secondPort = createFakeNativePort();
const ports = [firstPort.port, secondPort.port];
(globalThis as typeof globalThis & { chrome: unknown }).chrome = {
  runtime: {
    connectNative() {
      const next = ports.shift();
      assert.ok(next, "acceptance expected another Native port");
      return next;
    },
  },
};
let executedCommands = 0;
configureNativeTransport({
  runCommand: async () => {
    executedCommands += 1;
    return { observed: "current-port-only" };
  },
  onDisconnect: () => undefined,
});
connectNativeTransport();
firstPort.emitDisconnect();
connectNativeTransport();
secondPort.emitMessage({
  protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
  type: "controller_challenge",
  nonce: "current-port-nonce-0000000000000000",
});
const currentAuthCount = secondPort.messages.length;
firstPort.emitMessage({
  protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
  type: "controller_challenge",
  nonce: "retired-port-late-nonce-000000000000",
});
assert.equal(secondPort.messages.length, currentAuthCount);
secondPort.emitMessage({
  protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
  type: "command",
  commandId: "current-port-command-1",
  sequence: 1,
  deadlineAt: Date.now() + 1_000,
  mutationClass: "observation",
  command: { kind: "inspect_target", tabId: 7 },
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(executedCommands, 1);
assert.equal(
  (secondPort.messages.at(-1) as { sequence?: number }).sequence,
  1,
  "the current Native port must still accept sequence 1 after a retired port's late challenge",
);

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
