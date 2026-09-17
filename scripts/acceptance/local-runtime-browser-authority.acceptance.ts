import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createWorkbenchAssembly } from "../../src/lib/local-runtime/workbench-assembly.js";
import {
  BrowserInfrastructureSupervisor,
  shouldRestoreBrowserHostVisibility,
} from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import type { BrowserAuthoritySocket } from
  "../../src/lib/browser/transport/browser-authority-websocket.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const retiredPaths = [
  "src/lib/local-runtime/workbench-browser-support.ts",
] as const;

for (const retiredPath of retiredPaths) {
  assert.equal(existsSync(resolve(repoRoot, retiredPath)), false, `Retired Local Runtime path remains: ${retiredPath}`);
}

const authenticatedTransportLoss = (transportEvent: string) =>
  shouldRestoreBrowserHostVisibility({
    authorityWasPresent: true,
    reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
    transportEvent,
    started: true,
  });
for (const transportEvent of ["peer_close", "tcp_close", "tcp_error"]) {
  assert.equal(authenticatedTransportLoss(transportEvent), true,
    `${transportEvent} from the authenticated Browser authority must request the existing host check`);
}
for (const input of [
  { authorityWasPresent: false, reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", transportEvent: "tcp_close", started: true },
  { authorityWasPresent: true, reasonCode: "BROWSER_AUTH_FRAME_INVALID", transportEvent: "tcp_close", started: true },
  { authorityWasPresent: true, reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", transportEvent: "explicit_revoke", started: true },
  { authorityWasPresent: true, reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", transportEvent: "tcp_close", started: false },
]) {
  assert.equal(shouldRestoreBrowserHostVisibility(input), false,
    "pending, invalid, non-transport, and stopped revocations must not request browser-host recovery");
}

const exerciseAuthenticatedTransportTerminal = async (input: Readonly<{
  transportEvents: readonly string[];
  rejectRestore?: boolean;
}>): Promise<Readonly<{ restoreCalls: number; logText: string }>> => {
  const root = await mkdtemp(join(tmpdir(), "grasseye-browser-host-restore-"));
  const runtimeLogger = createRuntimeLogger({
    producer: "browser-host-restore-acceptance", owner: "browser-session",
    component: "browser-infrastructure", terminalEnabled: false,
    fileSink: { directoryPath: join(root, "runtime-logs") },
  });
  let restoreCalls = 0;
  const hash = `sha256:${"0".repeat(64)}` as const;
  const supervisor = new BrowserInfrastructureSupervisor({
    dataDir: root,
    sourceFingerprint: "browser-host-restore-acceptance",
    profileConfig: {
      profileRef: "acceptance-profile", profileDir: join(root, "profile"),
      extensionId: "emkmbecadncngofidjgocmifhbonifgm",
      unpackedExtensionDirectory: join(root, "extension"),
    },
    enrolledProfile: {
      profileRef: "acceptance-profile", enrollmentHash: hash, policyHash: hash, extensionTreeHash: hash,
      enrolledAt: new Date().toISOString(),
    },
    releaseIdentity: {
      schemaVersion: "grasseye.browser.unpacked-release.v1",
      releaseBuildId: "build-browser-host-restore-acceptance",
      extensionId: "emkmbecadncngofidjgocmifhbonifgm", version: "1.0.0",
      extensionDirectoryHashV1: hash, manifestHash: hash, protocolHash: hash, sitePolicyHash: hash,
      createdAt: new Date().toISOString(),
    },
    runtimeLogger,
    restoreBrowserHostVisibility: async () => {
      restoreCalls += 1;
      if (input.rejectRestore) throw new Error("injected browser-host restore failure");
    },
  });
  const socket: BrowserAuthoritySocket = { send: () => {}, close: () => {} };
  try {
    await supervisor.start();
    Reflect.set(Reflect.get(supervisor, "issuer"), "slot", {
      kind: "PRESENT",
      authority: { authorityRef: "authority-browser-host-restore-acceptance" },
    });
    Reflect.set(supervisor.endpoints().websocket, "active", {
      socket,
      keys: { clientToServer: Buffer.alloc(32), serverToClient: Buffer.alloc(32) },
      lastClientSequence: 1,
      nextServerSequence: 1,
      lastHeartbeatAt: Date.now(),
      replies: new Map(),
    });
    for (const transportEvent of input.transportEvents) {
      supervisor.endpoints().websocket.disconnect(
        socket,
        "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
        { transportEvent },
      );
    }
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    const segmentPath = runtimeLogger.currentSegmentPath();
    return {
      restoreCalls,
      logText: segmentPath ? await readFile(segmentPath, "utf8") : "",
    };
  } finally {
    await supervisor.stop();
    await rm(root, { recursive: true, force: true });
  }
};

for (const transportEvent of ["peer_close", "tcp_close", "tcp_error"] as const) {
  const result = await exerciseAuthenticatedTransportTerminal({ transportEvents: [transportEvent] });
  assert.equal(result.restoreCalls, 1,
    `${transportEvent} must traverse the authenticated WebSocket/Supervisor chain exactly once`);
}
const duplicateTerminal = await exerciseAuthenticatedTransportTerminal({
  transportEvents: ["tcp_error", "tcp_close"],
});
assert.equal(duplicateTerminal.restoreCalls, 1,
  "duplicate close/error terminals for one authenticated socket must request one host recovery");
const rejectedRestore = await exerciseAuthenticatedTransportTerminal({
  transportEvents: ["tcp_close"],
  rejectRestore: true,
});
assert.equal(rejectedRestore.restoreCalls, 1,
  "a rejected host recovery callback must not schedule a second attempt");
assert.equal(
  rejectedRestore.logText.match(/"code":"BROWSER_HOST_UNAVAILABLE"/gu)?.length ?? 0,
  1,
  "a rejected host recovery callback must emit exactly one BROWSER_HOST_UNAVAILABLE failure",
);

const project = new Project({ tsConfigFilePath: resolve(repoRoot, "tsconfig.json") });
const assemblySource = project.getSourceFile(resolve(repoRoot, "src/lib/local-runtime/workbench-assembly.ts"));
assert.ok(assemblySource, "Workbench assembly must remain a TypeScript source file.");
assert.equal(
  assemblySource.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes("workbench-browser-support")),
  false,
  "Workbench assembly must not import a retired Browser support path.",
);
const forbiddenAssemblyIdentifiers = new Set(["acquireTargetLease", "tryAcquireTargetLease", "createTargetSession"]);
const presentAssemblyIdentifiers = new Set(assemblySource.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
for (const identifier of forbiddenAssemblyIdentifiers) {
  assert.equal(presentAssemblyIdentifiers.has(identifier), false, `Workbench assembly must not ${identifier}.`);
}
assert.equal(
  assemblySource.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) =>
    Node.isIdentifier(expression.getExpression()) && expression.getExpression().getText() === "BrowserInfrastructureSupervisor"),
  false,
  "Workbench assembly must receive Browser authority through its Local Runtime support boundary.",
);

const dataDir = await mkdtemp(join(tmpdir(), "grasseye-local-runtime-browser-authority-"));
let restoreCalls = 0;
const assembly = await createWorkbenchAssembly({
  dataDir,
  restoreBrowserHostVisibility: async () => { restoreCalls += 1; },
});
try {
  assert.equal("acquireTargetLease" in assembly.browserAuthority, false, "Local Runtime must expose the Broker, not a cached target lease surface.");
  assert.equal("tryAcquireTargetLease" in assembly.browserAuthority, false, "Local Runtime must not offer startup target-lease probing.");
  assert.deepEqual(Object.keys(assembly.browserAuthority.health()).sort(), ["browserAuthority", "browserInfrastructure"]);
  assert.equal(assembly.browserAuthority.health().browserInfrastructure.ok, true, "Workbench infrastructure must start before the extension page channel connects.");
  assert.equal(assembly.browserAuthority.health().browserAuthority.ok, false, "Browser authority must remain absent until the exact extension authenticates through the Workbench page.");
  const pairing = assembly.browserAuthority.readOperatorPairingState();
  assert.equal(pairing.authority, "absent");
  assert.match(pairing.pairingSecret ?? "", /^[a-f0-9]{64}$/u, "Cold start must issue one memory-only 256-bit operator pairing secret.");
  assert.equal(JSON.stringify(assembly.browserAuthority.health()).includes(pairing.pairingSecret ?? ""), false, "Pairing secret must not enter health output.");
  assert.equal("approveSessionWorkspace" in assembly.browserAuthority, false, "Pair plus claim must be the only operator admission; a second workspace approval surface is forbidden.");
  assert.equal("videoDownload" in assembly, false, "Retired video-download must not remain in Workbench composition.");
  assert.equal("mediaProcessing" in assembly, false, "Retired generic media-processing must not remain in Workbench composition.");
  assert.equal(restoreCalls, 0,
    "cold start without an authenticated transport terminal must not request host recovery");
} finally {
  await assembly.browserAuthority.shutdown();
}

console.log("LOCAL_RUNTIME_BROWSER_AUTHORITY_ACCEPTANCE_PASS");
