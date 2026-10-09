import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createWorkbenchAssembly } from "../../src/lib/local-runtime/workbench-assembly.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema } from "../../src/lib/browser/exact-target/browser-mutation-schema.js";
import {
  BrowserInfrastructureSupervisor,
  shouldRestoreBrowserHostVisibility,
} from
  "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { BrowserAuthorityWebSocket, type BrowserAuthoritySocket } from
  "../../src/lib/browser/transport/browser-authority-websocket.js";
import { BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS } from
  "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { canonicalizeBrowserAuthorityValue, encodeBrowserAuthorityFrame, decodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { encryptBrowserAuthorityFrame, decryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { identity, terminalFact } from "./local-browser-mutation-store-support.js";
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

const createTransportTerminalFixture = (root: string, runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  restoreBrowserHostVisibility: () => Promise<void>): BrowserInfrastructureSupervisor => {
  const hash = `sha256:${"0".repeat(64)}` as const;
  return new BrowserInfrastructureSupervisor({
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
    restoreBrowserHostVisibility,
  });
};

const exerciseAuthenticatedTransportTerminal = async (input: Readonly<{
  transportEvents: readonly string[];
  rejectRestore?: boolean;
  shutdownFault?: boolean;
  unresolved?: boolean;
}>): Promise<Readonly<{ restoreCalls: number; logText: string }>> => {
  const root = await mkdtemp(join(tmpdir(), "grasseye-browser-host-restore-"));
  const runtimeLogger = createRuntimeLogger({
    producer: "browser-host-restore-acceptance", owner: "browser-session",
    component: "browser-infrastructure", terminalEnabled: false,
    fileSink: { directoryPath: join(root, "runtime-logs") },
  });
  let restoreCalls = 0;
  const supervisor = createTransportTerminalFixture(root, runtimeLogger, async () => {
    restoreCalls += 1;
    if (input.rejectRestore) throw new Error("injected browser-host restore failure");
  });
  const closed: string[] = [];
  const socket: BrowserAuthoritySocket = { send: () => {}, close: () => {
    closed.push("socket"); if (input.shutdownFault) throw new Error("injected socket close failure");
  } };
  try {
    await supervisor.start();
    if (input.unresolved) {
      await exerciseUnresolvedShutdown(supervisor, root);
      return { restoreCalls, logText: "" };
    }
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
    if (input.shutdownFault) {
      await exerciseShutdownFault(supervisor, root, closed);
      return { restoreCalls, logText: "" };
    }
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
    await supervisor.stop().catch(error => { if (!input.shutdownFault && !input.unresolved) throw error; });
    await rm(root, { recursive: true, force: true });
  }
};

const exerciseUnresolvedShutdown = async (supervisor: BrowserInfrastructureSupervisor, root: string): Promise<void> => {
  const store = Reflect.get(supervisor, "state").mutationState as BrowserMutationStore;
  store.verifyRuntimeTaskProvenance(null);
  const mutation = identity("stop-dispatched", "attempt:stop");
  store.prepare(mutation); store.markDispatched(mutation.commandId);
  await assert.rejects(supervisor.stop(), /BROWSER_SHUTDOWN_INCOMPLETE/u);
  const reopened = new BrowserMutationStore(root);
  assert.equal(reopened.readCommand(mutation.commandId)?.state, "DISPATCHED");
  reopened.close();
};
const exerciseShutdownFault = async (supervisor: BrowserInfrastructureSupervisor, root: string, closed: string[]): Promise<void> => {
  const state = Reflect.get(supervisor, "state");
  state.workspace = { revoke: () => { closed.push("workspace"); throw new Error("injected workspace failure"); } };
  const storeClose = state.mutationState.close.bind(state.mutationState);
  state.mutationState.close = () => { closed.push("wal"); storeClose(); };
  const lock = Reflect.get(supervisor, "ownerLock"), release = lock.release.bind(lock);
  lock.release = async () => { closed.push("lock"); await release(); };
  const stopping = supervisor.stop();
  assert.equal(stopping, supervisor.stop(), "repeat stop must join the same actual resources");
  await assert.rejects(stopping, /BROWSER_SHUTDOWN_INCOMPLETE/u);
  assert.deepEqual(closed, ["socket", "workspace", "wal", "lock"]);
  assert.equal(state.mutationState, null); assert.equal(state.ownerLockHeld, false);
  assert.equal(existsSync(join(root, "browser", "owner.lock")), false);
  assert.equal(supervisor.endpoints().websocket.readOperatorPairingSecret(), null);
  let lateClosed = 0;
  supervisor.endpoints().websocket.receive({ send: () => { throw new Error("LATE_AUTH_FORBIDDEN"); },
    close: () => { lateClosed++; } }, "PAIR_HELLO");
  assert.equal(lateClosed, 1, "closed authority must reject late unauthenticated input");
  await assert.rejects(supervisor.start(), /BROWSER_INFRASTRUCTURE_STOPPED/u);
};

assert.equal((await exerciseAuthenticatedTransportTerminal({ transportEvents: [], shutdownFault: true })).restoreCalls, 0);
assert.equal((await exerciseAuthenticatedTransportTerminal({ transportEvents: [], unresolved: true })).restoreCalls, 0);

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

const exercisePairingStateLiveness = async (
  lastHeartbeatAt: number,
): Promise<Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }>> => {
  const root = await mkdtemp(join(tmpdir(), "grasseye-browser-pairing-liveness-"));
  const runtimeLogger = createRuntimeLogger({
    producer: "browser-pairing-liveness-acceptance", owner: "browser-session",
    component: "browser-infrastructure", terminalEnabled: false,
    fileSink: { directoryPath: join(root, "runtime-logs") },
  });
  const hash = `sha256:${"0".repeat(64)}` as const;
  const supervisor = new BrowserInfrastructureSupervisor({
    dataDir: root,
    sourceFingerprint: "browser-pairing-liveness-acceptance",
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
      releaseBuildId: "build-browser-pairing-liveness-acceptance",
      extensionId: "emkmbecadncngofidjgocmifhbonifgm", version: "1.0.0",
      extensionDirectoryHashV1: hash, manifestHash: hash, protocolHash: hash, sitePolicyHash: hash,
      createdAt: new Date().toISOString(),
    },
    runtimeLogger,
  });
  const socket: BrowserAuthoritySocket = { send: () => {}, close: () => {} };
  try {
    await supervisor.start();
    Reflect.set(Reflect.get(supervisor, "issuer"), "slot", {
      kind: "PRESENT",
      authority: { authorityRef: "authority-browser-pairing-liveness-acceptance" },
    });
    Reflect.set(supervisor.endpoints().websocket, "active", {
      socket,
      keys: { clientToServer: Buffer.alloc(32), serverToClient: Buffer.alloc(32) },
      lastClientSequence: 1,
      nextServerSequence: 1,
      lastHeartbeatAt,
      replies: new Map(),
    });
    return supervisor.readOperatorPairingState();
  } finally {
    await supervisor.stop();
    await rm(root, { recursive: true, force: true });
  }
};

const freshPairingState = await exercisePairingStateLiveness(Date.now());
assert.equal(freshPairingState.authority, "present",
  "a healthy, recently-heartbeating connection must not be reported as absent by the pairing readback");
assert.equal(freshPairingState.pairingSecret, null,
  "a still-present authority must not reveal a pairing secret to the pairing readback");

const stalePairingState = await exercisePairingStateLiveness(
  Date.now() - BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS - 1,
);
assert.equal(stalePairingState.authority, "absent",
  "a connection stale past BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS must self-correct to absent on the next pairing readback, without waiting for a command dispatch");
assert.match(stalePairingState.pairingSecret ?? "", /^[a-f0-9]{64}$/u,
  "self-correcting a stale authority to absent must mint a fresh one-time operator pairing secret so the extension can re-pair");

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

const admissionRoot = await mkdtemp(join(tmpdir(), "browser-schema-startup-"));
try {
  for (const variant of ["old-table", "wrong-journal"] as const) {
    const dir = join(admissionRoot, variant, "browser");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "browser-mutations.sqlite");
    const database = new Database(file);
    ensureCurrentSchema(database);
    if (variant === "old-table") {
      database.pragma("journal_mode = WAL");
      database.exec("create table browser_mutations_physical_input_v2 (old_effect text)");
      database.exec("insert into browser_mutations_physical_input_v2 values ('historical-effect')");
    }
    database.close();
    assert.throws(() => new BrowserMutationStore(join(admissionRoot, variant)), /BROWSER_REPAIR_REQUIRED/u);
    assert.equal(existsSync(join(dir, "browser-mutation.key")), false,
      "a rejected existing database must not create an encryption key");
    const readback = new Database(file, { readonly: true, fileMustExist: true });
    assert.equal(readback.pragma("journal_mode", { simple: true }), variant === "old-table" ? "wal" : "delete");
    if (variant === "old-table") assert.deepEqual(readback.prepare(
      "select old_effect from browser_mutations_physical_input_v2").all(), [{ old_effect: "historical-effect" }]);
    readback.close();
  }
  const emptyDir = join(admissionRoot, "empty-file", "browser");
  mkdirSync(emptyDir, { recursive: true });
  writeFileSync(join(emptyDir, "browser-mutations.sqlite"), "");
  const emptyRecovered = new BrowserMutationStore(join(admissionRoot, "empty-file"));
  assert.equal(emptyRecovered.existedAtOpen, false);
  emptyRecovered.verifyRuntimeTaskProvenance("2020-01-01T00:00:00Z");
  assert.throws(() => emptyRecovered.assertRuntimeTaskProvenance(), /BROWSER_WAL_HISTORY_UNVERIFIED/u);
} finally {
  await rm(admissionRoot, { recursive: true, force: true });
}


const exerciseCommittedReceiptLogFailures = async (): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "browser-receipt-log-failure-"));
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  const logger = createRuntimeLogger({ producer: "receipt-acceptance", owner: "browser-session",
    component: "browser-infrastructure", terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } });
  let fault: "healthy" | "write" | "capacity" = "healthy";
  let pumps = 0;
  let writeFailed = false;
  const owner = Object.create(BrowserInfrastructureSupervisor.prototype) as BrowserInfrastructureSupervisor;
  Reflect.set(owner, "state", { started: true, mutationState: store });
  Reflect.set(owner, "lane", { notifyMutationSettled: () => { pumps += 1; } });
  Reflect.set(owner, "options", { runtimeLogger: new Proxy(logger, { get(target, key) {
    if (key === "isWritable") return () => fault !== "capacity" && !writeFailed;
    if (key === "getSinkState") return () => fault === "capacity" ? "capacity_blocked" : writeFailed ? "failed" : "ready";
    if (key === "emitEvent") return (...args: Parameters<typeof logger.emitEvent>) => {
      if (fault !== "write") return target.emitEvent(...args);
      writeFailed = true; return { ok: false, code: "RUNTIME_LOG_SINK_WRITE_FAILED" }; };
    return Reflect.get(target, key);
  } }) });
  const settle = Reflect.get(owner, "settleMutationTerminal").bind(owner) as BrowserInfrastructureSupervisorReceiptFixture;
  try {
    for (const scenario of ["healthy", "write", "capacity"] as const) {
      const original = identity("receipt-" + scenario, "receipt-attempt-" + scenario);
      store.prepare(original); store.markDispatched(original.commandId);
      const fact = terminalFact(original);
      const beforePumps = pumps;
      let acks = 0;
      fault = scenario; writeFailed = false;
      const ack = () => { acks += 1;
        assert.equal(store.readCommand(original.commandId)?.state, "CONFIRMED", "ACK follows durable commit"); };
      if (scenario === "healthy") settle(fact, ack);
      else assert.throws(() => settle(fact, ack), scenario === "write"
        ? /RUNTIME_LOG_SINK_WRITE_FAILED/u : /RUNTIME_LOG_CAPACITY_BLOCKED/u);
      assert.equal(acks, 1, "log faults cannot hold a committed fact hostage");
      assert.equal(pumps - beforePumps, scenario === "healthy" ? 1 : 0);
      const authority = store.authorityHash(original.commandId);
      if (scenario === "healthy") settle(fact, ack);
      else assert.throws(() => settle(fact, ack), /RUNTIME_LOG_/u);
      assert.equal(acks, 2); assert.equal(store.authorityHash(original.commandId), authority);
      assert.throws(() => settle(fact, () => { throw new Error("injected ACK loss"); }),
        scenario === "healthy" ? /injected ACK loss/u : /RUNTIME_LOG_/u);
      assert.equal(store.authorityHash(original.commandId), authority, "lost ACK cannot undo the terminal");
      if (scenario !== "healthy") exerciseReceiptTransportCleanup(settle, fact);
    }
    fault = "healthy"; writeFailed = false;
    const original = identity("write-failed-receipt", "write-failed-attempt");
    store.prepare(original); store.markDispatched(original.commandId);
    const database = Reflect.get(store, "database") as Database.Database;
    database.exec("create trigger reject_terminal before update of terminal_at on browser_mutations begin select raise(abort, 'injected WAL commit failure'); end");
    let acked = false;
    assert.throws(() => settle(terminalFact(original), () => { acked = true; }), /injected WAL commit failure/u);
    assert.equal(acked, false); assert.equal(store.readCommand(original.commandId)?.state, "DISPATCHED");
    database.exec("drop trigger reject_terminal");
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
};
type BrowserInfrastructureSupervisorReceiptFixture = (fact: ReturnType<typeof terminalFact>, acknowledge: () => void) => void;

const exerciseReceiptTransportCleanup = (settle: BrowserInfrastructureSupervisorReceiptFixture,
  fact: ReturnType<typeof terminalFact>): void => {
  const frames: string[] = [];
  let closes = 0;
  const socket: BrowserAuthoritySocket = { send: encoded => { frames.push(encoded); },
    close: () => { closes += 1; throw new Error("injected close failure"); } };
  const channel = new BrowserAuthorityWebSocket({ pairingSecret: "a".repeat(64),
    onMutationReceipt: settle, onPairingStarted: () => {}, onHeartbeat: () => {},
    onAuthenticated: () => { throw new Error("unexpected authentication"); }, onTargetClaim: () => {},
    onTargetRevoke: () => {}, onDiagnostic: () => {},
    onRevoked: () => { throw new Error("injected revoke log failure"); } });
  const key = Buffer.alloc(32, 1);
  Reflect.set(channel, "active", { socket, keys: { clientToServer: key, serverToClient: key },
    lastClientSequence: 1, nextServerSequence: 2, lastHeartbeatAt: Date.now(), replies: new Map() });
  const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "MUTATION_RECEIPT" as const,
    epoch: 1, sequence: 2, deadline: new Date(Date.now() + 10_000).toISOString() };
  const aad = canonicalizeBrowserAuthorityValue(header);
  const encrypted = encryptBrowserAuthorityFrame({ key, direction: "client-to-server", epoch: 1,
    sequence: 2, aad, plaintext: canonicalizeBrowserAuthorityValue(fact) });
  assert.throws(() => channel.receive(socket, encodeBrowserAuthorityFrame({ ...header, body: { encrypted } })),
    (error: unknown) => error instanceof Error && /^RUNTIME_LOG_/u.test(error.message)
      && error.cause instanceof AggregateError, "cleanup faults preserve the original log failure");
  assert.equal(closes, 1, "actual socket close is attempted despite a failed revoke log");
  assert.equal(frames.length, 1, "committed receipt gets its encrypted ACK before channel revocation");
  const ack = decodeBrowserAuthorityFrame(frames[0]!);
  assert.equal(ack.kind, "MUTATION_RECEIPT");
  const { body, ...ackHeader } = ack;
  const plaintext = decryptBrowserAuthorityFrame({ key, direction: "server-to-client", epoch: ack.epoch,
    sequence: ack.sequence, aad: canonicalizeBrowserAuthorityValue(ackHeader),
    encrypted: body.encrypted as ReturnType<typeof encryptBrowserAuthorityFrame> });
  assert.deepEqual(JSON.parse(plaintext), { type: "ack", commandId: fact.commandId,
    receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash });
};

await exerciseCommittedReceiptLogFailures();

console.log("LOCAL_RUNTIME_BROWSER_AUTHORITY_ACCEPTANCE_PASS");
