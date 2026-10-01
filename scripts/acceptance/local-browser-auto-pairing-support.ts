import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import {
  GRASSEYE_AUTO_PAIRING_ALARM,
  GRASSEYE_TOOL_EXTENSION_ID,
  PairingAutoBootstrap,
  type WorkbenchPairingState,
} from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { TargetClaimAwaiter } from "../../src/lib/browser/chrome-extension/websocket-target-claim-awaiter.js";
import { ExtensionWebSocketActor } from "../../src/lib/browser/chrome-extension/websocket-actor.js";
import { encrypt, decrypt } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import type { AuthenticatedSession } from "../../src/lib/browser/chrome-extension/websocket-pairing-proof.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { identity, terminalFact } from "./local-browser-mutation-store-support.js";
import { exercisePairingReadback } from "./local-browser-pairing-readback-support.js";

type RuntimeStartupListener = () => void;
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];
type AlarmListener = Parameters<ExtensionChromeApi["alarms"]["onAlarm"]["addListener"]>[0];
type PairingListeners = { runtimeStartup?: RuntimeStartupListener; tabUpdated?: TabUpdatedListener; alarm?: AlarmListener };

const pairingFixture = () => {
  const listeners: PairingListeners = {};
  let createdAlarm: Readonly<{ name: string; periodInMinutes: number }> | null = null;
  let reloads = 0;
  const chromeApi: ExtensionChromeApi = {
    runtime: {
      id: GRASSEYE_TOOL_EXTENSION_ID, getManifest: () => ({ version: "1.0.0" }),
      getPlatformInfo: async () => ({}), reload: () => { reloads += 1; },
      onMessage: { addListener: () => undefined },
      onStartup: { addListener: (listener) => { listeners.runtimeStartup = listener; } },
    },
    debugger: {
      attach: async () => undefined, detach: async () => undefined,
      getTargets: async () => [], sendCommand: async () => ({}),
      onDetach: { addListener: () => undefined }, onEvent: { addListener: () => undefined },
    },
    tabs: {
      create: async () => ({ id: 1 }),
      get: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 }),
      remove: async () => undefined,
      update: async (tabId) => ({ active: true, discarded: false, id: tabId, status: "complete",
        title: "ChatGPT", windowId: 1 }),
      onActivated: { addListener: () => undefined },
      onUpdated: { addListener: (listener) => { listeners.tabUpdated = listener; } },
    },
    alarms: {
      create: async (name, alarmInfo) => { createdAlarm = { name, periodInMinutes: alarmInfo.periodInMinutes }; },
      onAlarm: { addListener: (listener) => { listeners.alarm = listener; } },
    },
  };
  return { chromeApi, listeners, createdAlarm: () => createdAlarm, reloads: () => reloads };
};

const exerciseSingleFlight = async (
  chromeApi: ExtensionChromeApi,
  secret: string,
  currentBuild: string,
  nextBuild: string,
  reloads: () => number,
): Promise<void> => {
  let resolveRead: (value: WorkbenchPairingState) => void = () => {
    throw new Error("pairing read was not started");
  };
  let reads = 0;
  let pairs = 0;
  const singleFlight = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async (value) => { assert.equal(value, secret); pairs += 1; } }, currentBuild,
    () => { reads += 1;
      return new Promise<WorkbenchPairingState>((resolve) => { resolveRead = resolve; }); });
  const first = singleFlight.attempt();
  assert.equal(first, singleFlight.attempt(), "concurrent wake events must share one in-flight pairing attempt");
  assert.equal(reads, 1);
  resolveRead({ authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild });
  await first;
  assert.equal(pairs, 1);
  const stale = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true,
      pair: async () => { throw new Error("stale code must reload before pairing"); } }, currentBuild,
    async () => ({ authority: "absent", pairingSecret: secret, releaseBuildId: nextBuild }));
  await stale.attempt();
  assert.equal(reloads(), 1, "a different exact AGENT build identity must trigger one extension reload");
};

const exerciseWakeEvents = async (
  chromeApi: ExtensionChromeApi,
  listeners: PairingListeners,
  createdAlarm: () => Readonly<{ name: string; periodInMinutes: number }> | null,
  currentBuild: string,
): Promise<void> => {
  let reads = 0;
  const bootstrap = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true, pair: async () => undefined }, currentBuild,
    async () => { reads += 1;
      return { authority: "present", pairingSecret: null, releaseBuildId: currentBuild }; });
  bootstrap.start();
  await bootstrap.attempt();
  assert.deepEqual(createdAlarm(), { name: GRASSEYE_AUTO_PAIRING_ALARM, periodInMinutes: 1 });
  assert.equal(reads, 1, "service-worker load must make one immediate attempt");
  listeners.runtimeStartup?.(); await bootstrap.attempt();
  assert.equal(reads, 2, "Chrome startup must wake automatic pairing");
  listeners.tabUpdated?.(1, { status: "complete" }, { id: 1, url: "http://127.0.0.1:4174/" });
  await Promise.resolve();
  assert.equal(reads, 2, "non-Workbench tabs must not wake pairing");
  listeners.tabUpdated?.(2, { status: "complete" }, { id: 2, url: "http://127.0.0.1:4173/" });
  await bootstrap.attempt();
  assert.equal(reads, 3, "the exact Workbench tab must wake automatic pairing");
  listeners.alarm?.({ name: "unrelated" }); await Promise.resolve();
  assert.equal(reads, 3, "unrelated alarms must not wake pairing");
  listeners.alarm?.({ name: GRASSEYE_AUTO_PAIRING_ALARM }); await bootstrap.attempt();
  assert.equal(reads, 4, "the sole fallback alarm must wake automatic pairing");
};

const exerciseClosedPairing = async (chromeApi: ExtensionChromeApi, currentBuild: string): Promise<void> => {
  const connected = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => false, pair: async () => { throw new Error("must not pair"); } },
    currentBuild, async () => { throw new Error("must not fetch"); });
  await connected.attempt();
  const rejected = new PairingAutoBootstrap(chromeApi,
    { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("must not pair"); } },
    currentBuild, async () => { throw new Error("BROWSER_PAIRING_ORIGIN_REJECTED"); });
  await rejected.attempt();
  assert.equal(rejected.currentFailureCode(), "BROWSER_PAIRING_ORIGIN_REJECTED");
};

export const exerciseAutomaticPairing = async (): Promise<ExtensionChromeApi> => {
  const secret = "a".repeat(64);
  const currentBuild = "build-00000000-0000-4000-8000-000000000001";
  const nextBuild = "build-00000000-0000-4000-8000-000000000002";
  await exercisePairingReadback(secret, currentBuild);
  const fixture = pairingFixture();
  await exerciseSingleFlight(fixture.chromeApi, secret, currentBuild, nextBuild, fixture.reloads);
  await exerciseWakeEvents(fixture.chromeApi, fixture.listeners, fixture.createdAlarm, currentBuild);
  await exerciseClosedPairing(fixture.chromeApi, currentBuild);
  await exerciseOriginalWorkerReceiptDelivery(fixture.chromeApi);
  return fixture.chromeApi;
};

type DeliveryFixture = {
  pendingCommandHandlers: Set<Promise<void>>; pendingTargetHandlers: Set<Promise<void>>;
  commandAdmissionSuspended: boolean; mutationSlot: { commandId: string; receiptBindingHash: string; fact: ReturnType<typeof terminalFact> } | null;
};
const receiptActorFixture = async (chromeApi: ExtensionChromeApi) => {
  Reflect.set(globalThis, "__GRASSEYE_RELEASE_BUILD_ID__", "build-receipt-acceptance");
  const actor = new ExtensionWebSocketActor(chromeApi);
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const signing = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const session: AuthenticatedSession = { clientToServerKey: key, serverToClientKey: key,
    serverSigningPublicKey: signing.publicKey, transcript: "fixture", nextClientSequence: 2 };
  const frames: string[] = [];
  let closed = 0;
  const socket: WebSocket = Object.assign(new EventTarget(), {
    readyState: WebSocket.OPEN, binaryType: "arraybuffer" as const,
    bufferedAmount: 0, extensions: "", protocol: "", url: "ws://127.0.0.1/receipt-fixture",
    onclose: null, onerror: null, onmessage: null, onopen: null,
    CONNECTING: WebSocket.CONNECTING, OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING, CLOSED: WebSocket.CLOSED,
    send: (value: Parameters<WebSocket["send"]>[0]) => { frames.push(String(value)); },
    close: () => { closed += 1; },
  });
  const connection = Reflect.get(actor, "connection") as { socket: WebSocket | null; state: string; session: AuthenticatedSession | null };
  Object.assign(connection, { socket, state: "CONNECTED", session });
  Reflect.set(connection, "commandReady", true);
  const delivery = Reflect.get(actor, "commandDelivery") as DeliveryFixture;
  return { actor, connection, delivery, session, socket, frames, closed: () => closed };
};
const exerciseOriginalWorkerReceiptDelivery = async (chromeApi: ExtensionChromeApi): Promise<void> => {
  const fixture = await receiptActorFixture(chromeApi);
  const { actor, delivery, frames } = fixture;
  const fact = terminalFact(identity("original-worker-receipt", "original-worker-attempt"));
  let finishHandler: () => void = () => { throw new Error("handler was not started"); };
  const handler = new Promise<void>(resolve => { finishHandler = resolve; });
  delivery.pendingCommandHandlers.add(handler);
  void handler.then(() => { delivery.pendingCommandHandlers.delete(handler);
    delivery.mutationSlot = { commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, fact }; });
  const order: string[] = [];
  Reflect.set(Reflect.get(actor, "targetAuthority"), "releaseActiveTarget", async () => {
    assert.equal(delivery.mutationSlot?.fact, fact, "terminal must be fixed before Target release"); order.push("release"); });
  const drain = Reflect.get(actor, "drainDisconnectedHandlers").bind(actor) as () => Promise<void>;
  const flush = Reflect.get(actor, "flushMutationReceipt").bind(actor) as () => Promise<void>;
  const first = drain(); assert.equal(drain(), first, "concurrent disconnections share the original drain");
  await flush(); assert.equal(frames.length, 0, "READY cannot deliver before original handler exits");
  finishHandler(); await first;
  assert.deepEqual(order, ["release"]); assert.equal(frames.length, 1);
  const frame = decodeBrowserAuthorityFrame(frames[0]!);
  assert.equal(frame.kind, "MUTATION_RECEIPT");
  assert.deepEqual(await decrypt(fixture.session.clientToServerKey, "client-to-server", frame), fact);
  await flush(); assert.equal(frames.length, 1, "one terminal delivery per authenticated session");
  await exerciseMutationAcknowledgements(fixture, fact);
  const freshWorker = await receiptActorFixture(chromeApi);
  assert.equal(freshWorker.delivery.mutationSlot, null, "MV3 worker loss cannot manufacture the original fact");
  await exerciseReplacedSessionDelivery(freshWorker, chromeApi);
  await exerciseReceiptSessionBoundaries(chromeApi);
};
const exerciseMutationAcknowledgements = async (fixture: Awaited<ReturnType<typeof receiptActorFixture>>,
  fact: ReturnType<typeof terminalFact>): Promise<void> => {
  const { actor, socket, session, delivery, connection } = fixture;
  const accept = Reflect.get(actor, "acceptMutationAck").bind(actor) as (socket: WebSocket, frame: BrowserAuthorityFrame) => Promise<void>;
  const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "MUTATION_RECEIPT" as const, epoch: 1,
    sequence: 2, deadline: new Date(Date.now() + 10_000).toISOString() };
  const body = { type: "ack", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash };
  const ack = { ...header, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", header, body) } };
  await accept(socket, ack); assert.equal(delivery.mutationSlot, null);
  const next = terminalFact(identity("next-receipt", "next-attempt"));
  delivery.mutationSlot = { commandId: next.commandId, receiptBindingHash: next.receiptBindingHash, fact: next };
  const repeatedHeader = { ...header, sequence: 3 };
  const repeatedAck = { ...repeatedHeader, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", repeatedHeader, body) } };
  await accept(socket, repeatedAck); assert.equal(delivery.mutationSlot.fact, next, "duplicate old ACK cannot erase the next slot");
  await assert.rejects(accept(socket, ack), /BROWSER_AUTH_TRANSCRIPT_INVALID/u, "replayed AEAD sequence must be rejected");
  const bad = { ...body, commandId: next.commandId };
  const conflictingHeader = { ...header, sequence: 4 };
  const conflictingAck = { ...conflictingHeader, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", conflictingHeader, bad) } };
  await assert.rejects(accept(socket, conflictingAck), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
  const inFlight = accept(socket, ack);
  connection.socket = null; connection.session = null;
  await inFlight; assert.equal(delivery.mutationSlot.fact, next, "late decrypt cannot affect a replacement session");
};
const exerciseOrderedReceiptFrames = async (fixture: Awaited<ReturnType<typeof receiptActorFixture>>): Promise<void> => {
  const send = Reflect.get(fixture.actor, "sendEncrypted").bind(fixture.actor) as
    (socket: WebSocket, kind: "HEARTBEAT" | "MUTATION_RECEIPT", body: Record<string, unknown>) => Promise<void>;
  await Promise.all([send(fixture.socket, "HEARTBEAT", {}), send(fixture.socket, "MUTATION_RECEIPT", {})]);
  assert.deepEqual(fixture.frames.map(value => decodeBrowserAuthorityFrame(value).sequence), [2, 3],
    "asynchronous encryption cannot reorder frame nonces");
  const fact = terminalFact(identity("unsent-receipt", "unsent-attempt"));
  fixture.delivery.mutationSlot = { commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, fact };
  Reflect.set(fixture.socket, "send", () => { throw new Error("injected socket failure"); });
  const flush = Reflect.get(fixture.actor, "flushMutationReceipt").bind(fixture.actor) as () => Promise<void>;
  await assert.rejects(flush(), /injected socket failure/u);
  assert.equal(fixture.closed(), 1); assert.equal(fixture.delivery.mutationSlot?.fact, fact,
    "failed delivery closes the channel while retaining the original terminal");
};

const exerciseReplacedSessionDelivery = async (fixture: Awaited<ReturnType<typeof receiptActorFixture>>,
  chromeApi: ExtensionChromeApi): Promise<void> => {
  let unblock: () => void = () => undefined;
  const blockedSend = new Promise<void>(resolve => { unblock = resolve; });
  Reflect.set(Reflect.get(fixture.actor, "commandDelivery"), "sendTail", blockedSend);
  const fact = terminalFact(identity("replaced-session", "replaced-attempt"));
  fixture.delivery.mutationSlot = { commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, fact };
  const flush = Reflect.get(fixture.actor, "flushMutationReceipt").bind(fixture.actor) as () => Promise<void>;
  const oldDelivery = flush();
  const replacement = await receiptActorFixture(chromeApi);
  Object.assign(fixture.connection, { socket: replacement.socket, session: replacement.session });
  unblock(); await assert.rejects(oldDelivery, /BROWSER_EXTENSION_CHANNEL_UNAVAILABLE/u);
  assert.equal(replacement.closed(), 0, "obsolete send failure cannot close a replacement session");
  assert.equal(fixture.delivery.mutationSlot?.fact, fact);
  await flush(); assert.equal(replacement.frames.length, 1, "new READY can deliver the unchanged original fact");
};

const exerciseCommandReplayAfterAck = async (fixture: Awaited<ReturnType<typeof receiptActorFixture>>): Promise<void> => {
  const { actor, socket, session, delivery } = fixture;
  const fact = terminalFact(identity("replay-command", "replay-attempt"));
  let executions = 0;
  Reflect.set(actor, "executeCommand", async () => { executions += 1;
    delivery.mutationSlot = { commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, fact }; });
  const receive = Reflect.get(actor, "onMessage").bind(actor) as (socket: WebSocket, data: unknown) => Promise<void>;
  const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "COMMAND" as const, epoch: 1,
    sequence: 2, deadline: new Date(Date.now() + 10_000).toISOString() };
  const command = { ...header, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", header, {}) } };
  const encode = encodeBrowserAuthorityFrame;
  await receive(socket, encode(command)); assert.equal(executions, 1);
  const ackHeader = { ...header, kind: "MUTATION_RECEIPT" as const, sequence: 3 };
  const ack = { ...ackHeader, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", ackHeader,
    { type: "ack", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash }) } };
  await receive(socket, encode(ack)); assert.equal(delivery.mutationSlot, null);
  await receive(socket, encode(command));
  assert.equal(executions, 1, "ACK clearing cannot let an authenticated old COMMAND execute twice");
  assert.equal(fixture.closed(), 1, "same-session sequence replay revokes before execution");
};
const exerciseReplacedDiagnostics = async (chromeApi: ExtensionChromeApi): Promise<void> => {
  for (const name of ["reportRuntimeFailure", "reportTargetFailure"]) {
    const fixture = await receiptActorFixture(chromeApi), replacement = await receiptActorFixture(chromeApi);
    let unblock: () => void = () => undefined;
    const blocked = new Promise<void>(resolve => { unblock = resolve; });
    Reflect.set(Reflect.get(fixture.actor, "commandDelivery"), "sendTail", blocked);
    const report = Reflect.get(fixture.actor, name).bind(fixture.actor);
    const pending = name === "reportRuntimeFailure" ? report(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"), "liveness-pulse")
      : report({ targetRef: "obsolete-target", runtimeEventType: "tab-remove", reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" });
    Object.assign(fixture.connection, { socket: replacement.socket, session: replacement.session });
    unblock(); await pending; await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(replacement.closed(), 0, "obsolete diagnostic failure cannot close the replacement channel");
  }
};

const exerciseReplacedTargetClaim = async (): Promise<void> => {
  const claims = new TargetClaimAwaiter();
  let rejectOldSend: (reason: Error) => void = () => undefined;
  const oldSend = new Promise<void>((_resolve, reject) => { rejectOldSend = reject; });
  const oldClaim = claims.begin({ targetRef: "old-target", documentRef: "old-document", jobRefHash: identity("old", "old").executionFenceHash,
    send: () => oldSend });
  await assert.rejects(async () => {
    claims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    await oldClaim;
  }, /BROWSER_EXTENSION_CHANNEL_UNAVAILABLE/u);
  const next = { targetRef: "new-target", documentRef: "new-document", jobRefHash: identity("new", "new").executionFenceHash };
  const current = claims.begin({ ...next, send: async () => {} });
  rejectOldSend(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"));
  await new Promise<void>(resolve => setImmediate(resolve));
  claims.accept(next); await current;
};

const exerciseReceiptSessionBoundaries = async (chromeApi: ExtensionChromeApi): Promise<void> => {
  await exerciseOrderedReceiptFrames(await receiptActorFixture(chromeApi));
  await exerciseCommandReplayAfterAck(await receiptActorFixture(chromeApi));
  await exerciseReplacedDiagnostics(chromeApi);
  await exerciseReplacedTargetClaim();
};
