import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { parseBrowserMutationReceiptMessage } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createClickCommand, permit } from "./local-browser-terminal-fixture.js";
import { browserCommandPermitMacPayload } from "../../src/lib/browser/transport/command-permit.js";
import { setExtensionPermitAuthority, clearExtensionPermitAuthority } from "../../src/lib/browser/chrome-extension/command-permit-validator.js";
import { parseBrowserAuthorityDiagnostic } from "../../src/lib/browser/transport/browser-authority-diagnostic.js";
import { GRASSEYE_AUTO_PAIRING_ALARM, GRASSEYE_TOOL_EXTENSION_ID, PairingAutoBootstrap, type WorkbenchPairingState } from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { TargetClaimAwaiter } from "../../src/lib/browser/chrome-extension/websocket-target-claim-awaiter.js";
import { ExtensionWebSocketActor } from "../../src/lib/browser/chrome-extension/websocket-actor.js";
import { encrypt, decrypt, hashBrowserExtensionText } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import type { AuthenticatedSession } from "../../src/lib/browser/chrome-extension/websocket-pairing-proof.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { identity, terminalFact } from "./local-browser-mutation-store-support.js";
import { exercisePairingReadback } from "./local-browser-pairing-readback-support.js";

const chromeFixture = () => {
  let startup: () => void = () => undefined;
  let updated: Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0] = () => undefined;
  let alarm: Parameters<ExtensionChromeApi["alarms"]["onAlarm"]["addListener"]>[0] = () => undefined;
  let alarmConfiguration: unknown, reloads = 0;
  const chrome: ExtensionChromeApi = { runtime: { id: GRASSEYE_TOOL_EXTENSION_ID, getManifest: () => ({ version: "1.0.0" }),
    getPlatformInfo: async () => ({}), reload: () => { reloads += 1; }, onMessage: { addListener: () => undefined }, onStartup: { addListener: cb => { startup = cb; } } },
    debugger: { attach: async () => undefined, detach: async () => undefined, getTargets: async () => [], sendCommand: async () => ({}),
      onDetach: { addListener: () => undefined }, onEvent: { addListener: () => undefined } },
    tabs: { create: async () => ({ id: 1 }), remove: async () => undefined,
      get: async id => ({ active: true, discarded: false, id, status: "complete", title: "ChatGPT", windowId: 1 }),
      update: async id => ({ active: true, discarded: false, id, status: "complete", title: "ChatGPT", windowId: 1 }),
      onActivated: { addListener: () => undefined }, onUpdated: { addListener: cb => { updated = cb; } } },
    alarms: { create: async (name, info) => { alarmConfiguration = { name, periodInMinutes: info.periodInMinutes }; },
      onAlarm: { addListener: cb => { alarm = cb; } } } };
  return { chrome, startup: () => startup(), updated: (...args: Parameters<typeof updated>) => updated(...args),
    alarm: (...args: Parameters<typeof alarm>) => alarm(...args), reloads: () => reloads, configuration: () => alarmConfiguration };
};
type Delivery = { pendingCommandHandlers: Set<Promise<void>>; pendingTargetHandlers: Map<number, { promise: Promise<void> }>; commandAdmissionSuspended: boolean;
  mutationSlot: { jobId: string; commandId: string; receiptBindingHash: string; fact: unknown } | null };
export const workerFixture = async (chrome: ExtensionChromeApi) => {
  Reflect.set(globalThis, "__GRASSEYE_RELEASE_BUILD_ID__", "build-receipt-acceptance");
  const actor = new ExtensionWebSocketActor(chrome), key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const signing = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const session: AuthenticatedSession = { clientToServerKey: key, serverToClientKey: key, serverSigningPublicKey: signing.publicKey, transcript: "fixture", nextClientSequence: 2 };
  const frames: string[] = []; let closes = 0;
  const socket = Object.assign(new EventTarget(), { readyState: WebSocket.OPEN, send: (value: unknown) => { frames.push(String(value)); }, close: () => { closes += 1; } }) as WebSocket;
  const connection = Reflect.get(actor, "connection") as { socket: WebSocket | null; state: string; session: AuthenticatedSession | null; commandReady: boolean };
  Object.assign(connection, { socket, state: "CONNECTED", session, commandReady: true });
  const delivery = Reflect.get(actor, "commandDelivery") as Delivery;
  const authority = Reflect.get(actor, "targetAuthority") as Record<string, unknown>;
  const invoke = (name: string, ...args: unknown[]) => Reflect.get(actor, name).call(actor, ...args) as Promise<void>;
  const frame = async (kind: BrowserAuthorityFrame["kind"], sequence: number, body: Record<string, unknown>): Promise<BrowserAuthorityFrame> => {
    const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: 1, sequence, deadline: new Date(Date.now() + 10_000).toISOString() };
    return { ...header, body: { encrypted: await encrypt(session.serverToClientKey, "server-to-client", header, body) } };
  };
  return { actor, socket, connection, delivery, session, authority, frames, invoke, frame, closes: () => closes };
};
type Worker = Awaited<ReturnType<typeof workerFixture>>;
const putFact = (fixture: Worker, fact: ReturnType<typeof terminalFact>, jobId = "job-1"): void => {
  fixture.delivery.mutationSlot = { jobId, commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, fact };
};
const nextTick = () => new Promise<void>(resolve => setImmediate(resolve));
const operation = async (fixture: Worker, body: Record<string, unknown>, sequence = 2): Promise<void> =>
  fixture.invoke("acceptTargetAcquire", fixture.socket, await fixture.frame("TARGET_ACQUIRE", sequence, body));


const originalCommandDiagnostics = async (chrome: ExtensionChromeApi): Promise<void> => {
  for (const [diagnosticSendFails, retirementFails] of [[false, false], [true, false], [false, true]]) {
    const fixture = await workerFixture(chrome), candidate = permit("extension-diagnostic-" + diagnosticSendFails);
    const key = Buffer.alloc(32, 7), { commandFrameMac: _unused, ...unsigned } = candidate;
    const signed = { ...candidate, commandFrameMac: `sha256:${createHmac("sha256", key).update(browserCommandPermitMacPayload(unsigned)).digest("hex")}` };
    setExtensionPermitAuthority({ authorityRef: candidate.authorityRef, authorityEpoch: candidate.authorityEpoch,
      certificateHash: candidate.certificateHash, channelSessionHash: candidate.channelSessionHash, commandPermitKey: key.toString("base64") });
    let retirements = 0, sends = 0;
    fixture.authority.resolve = () => { throw new Error("BROWSER_TARGET_INVALID"); };
    fixture.authority.retireInvalidCommandTarget = async () => {
      retirements += 1;
      assert.equal(fixture.frames.some(value => decodeBrowserAuthorityFrame(value).kind === "REPLY"), false,
        "the original Target retirement completes before final reply publication");
      assert.ok(fixture.delivery.mutationSlot?.fact, "terminal fact is retained before target retirement");
      if (retirementFails) throw new Error("INJECTED_RETIREMENT_FAILURE");
    };
    const send = fixture.socket.send.bind(fixture.socket);
    Reflect.set(fixture.socket, "send", (value: unknown) => {
      sends += 1;
      if (diagnosticSendFails && sends === 1) throw new Error("INJECTED_DIAGNOSTIC_SEND_FAILURE");
      send(String(value));
    });
    try {
      const command = createClickCommand(), frame = await fixture.frame("COMMAND", 7, {});
      const execution = fixture.invoke("executeCommand", fixture.socket, frame,
        { permit: signed, command, receiptBindingHash: `sha256:${"a".repeat(64)}` });
      if (diagnosticSendFails) await assert.rejects(execution, /INJECTED_DIAGNOSTIC_SEND_FAILURE/u);
      else if (retirementFails) await assert.rejects(execution, /INJECTED_RETIREMENT_FAILURE/u);
      else await execution;
      assert.equal(retirements, 1, "a delivered reply retains its original target retirement even if diagnostic sending failed");
      assert.equal(sends, 2, "diagnostic failure cannot skip the original reply attempt");
      assert.deepEqual(fixture.frames.map(value => decodeBrowserAuthorityFrame(value).kind),
        diagnosticSendFails ? ["REPLY"] : ["DIAGNOSTIC", "REPLY"]);
      const replyFrame = decodeBrowserAuthorityFrame(fixture.frames.at(-1)!);
      const reply = await decrypt(fixture.session.clientToServerKey, "client-to-server", replyFrame);
      assert.equal(reply.errorCode, "BROWSER_TARGET_INVALID");
      assert.deepEqual(reply.mutationReceipt, fixture.delivery.mutationSlot?.fact);
      if (!diagnosticSendFails) {
        const diagnosticFrame = decodeBrowserAuthorityFrame(fixture.frames[0]!);
        const diagnostic = await decrypt(fixture.session.clientToServerKey, "client-to-server", diagnosticFrame);
        const parsed = parseBrowserAuthorityDiagnostic(diagnostic);
        assert.equal(parsed.reasonCode, reply.errorCode);
        assert.equal(parsed.refs.commandStage, "target-resolution");
        assert.equal(parsed.refs.commandIntentKind, command.intent.kind);
      }
    } finally { clearExtensionPermitAuthority(); }
  }
};

const originalDelivery = async (chrome: ExtensionChromeApi): Promise<void> => {
  await originalCommandDiagnostics(chrome);
  const fixture = await workerFixture(chrome), slot = () => fixture.delivery.mutationSlot, fact = terminalFact(identity("original-worker", "original-attempt"));
  let finish!: () => void; const handler = new Promise<void>(resolve => { finish = resolve; });
  fixture.delivery.pendingCommandHandlers.add(handler); void handler.then(() => { fixture.delivery.pendingCommandHandlers.delete(handler); putFact(fixture, fact); });
  let releases = 0; fixture.authority.releaseActiveTarget = async () => { assert.equal(slot()?.fact, fact); releases += 1; };
  const drain = fixture.invoke("drainDisconnectedHandlers"); assert.equal(fixture.invoke("drainDisconnectedHandlers"), drain);
  await fixture.invoke("flushMutationReceipt"); assert.equal(fixture.frames.length, 0); finish(); await drain;
  assert.equal(releases, 1); assert.equal(fixture.frames.length, 1);
  const delivered = decodeBrowserAuthorityFrame(fixture.frames[0]!); assert.equal(delivered.kind, "MUTATION_RECEIPT");
  const receiptMessage = { type: "dispose", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash,
    rejectedFact: fact, rejectedFactHash: await hashBrowserExtensionText(canonicalizeBrowserAuthorityValue(fact)) };
  assert.deepEqual(await decrypt(fixture.session.clientToServerKey, "client-to-server", delivered), receiptMessage);
  await fixture.invoke("flushMutationReceipt"); assert.equal(fixture.frames.length, 2,
    "lost ACK must redeliver the full exact fact on the same authenticated connection");
  assert.deepEqual(await decrypt(fixture.session.clientToServerKey, "client-to-server",
    decodeBrowserAuthorityFrame(fixture.frames[1]!)), receiptMessage);
  await receiptAcknowledgements(fixture, fact);
  assert.equal((await workerFixture(chrome)).delivery.mutationSlot, null);
};
const receiptAcknowledgements = async (fixture: Worker, fact: ReturnType<typeof terminalFact>): Promise<void> => {
  const slot = () => fixture.delivery.mutationSlot;
  const body = { type: "ack", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash };
  const ack = await fixture.frame("MUTATION_RECEIPT", 2, body); await fixture.invoke("acceptMutationAck", fixture.socket, ack); assert.equal(slot(), null);
  const next = terminalFact(identity("next", "next-attempt")); putFact(fixture, next);
  await fixture.invoke("acceptMutationAck", fixture.socket, await fixture.frame("MUTATION_RECEIPT", 3, body)); assert.equal(slot()?.fact, next);
  await assert.rejects(fixture.invoke("acceptMutationAck", fixture.socket, ack), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  await assert.rejects(fixture.invoke("acceptMutationAck", fixture.socket, await fixture.frame("MUTATION_RECEIPT", 4, { ...body, commandId: next.commandId })), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
  const late = fixture.invoke("acceptMutationAck", fixture.socket, ack); fixture.connection.socket = null; fixture.connection.session = null;
  await late; assert.equal(slot()?.fact, next);
};
const verifyDispositionAckRetention = async (worker: Awaited<ReturnType<typeof workerFixture>>,
  first: Record<string, unknown>, raw: unknown): Promise<void> => {
        await assert.rejects(worker.invoke("acceptMutationAck", worker.socket, await worker.frame("MUTATION_RECEIPT", 2,
          { ...first, rejectedFactHash: `sha256:${"0".repeat(64)}` })), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
        const pending = Promise.resolve(); worker.delivery.pendingCommandHandlers.add(pending);
        await worker.invoke("acceptMutationAck", worker.socket, await worker.frame("MUTATION_RECEIPT", 3, first));
        assert.equal(worker.delivery.mutationSlot?.fact, raw, "live handlers retain the slot"); worker.delivery.pendingCommandHandlers.delete(pending);
};
const verifyLateDisposition = async (worker: Awaited<ReturnType<typeof workerFixture>>,
  first: Record<string, unknown>, mode: string): Promise<void> => {
      const next = terminalFact(identity(`next-${mode}`, `next-attempt-${mode}`)); putFact(worker, next);
      await worker.invoke("acceptMutationAck", worker.socket, await worker.frame("MUTATION_RECEIPT", 5, first));
      assert.equal((worker.delivery.mutationSlot as Delivery["mutationSlot"])?.fact, next, "late disposition cannot clear another command");
};
const dispositionRoundTrips = async (chrome: ExtensionChromeApi): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "browser-disposition-"));
  const store = new BrowserMutationStore(join(root, "wal")); store.verifyRuntimeTaskProvenance(null);
  const supervisor = Object.create(BrowserInfrastructureSupervisor.prototype) as BrowserInfrastructureSupervisor;
  const logger = createRuntimeLogger({ producer: "disposition-exam", owner: "browser-session", component: "receipt",
    terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } });
  Object.assign(supervisor, { state: { started: true, mutationState: store }, options: { runtimeLogger: logger },
    lane: { notifyMutationSettled: () => undefined } });
  const settle = (message: unknown): Record<string, unknown> => {
    let response: Readonly<Record<string, unknown>> | undefined; let acknowledged = false;
    Reflect.get(supervisor, "settleMutationTerminal").call(supervisor, parseBrowserMutationReceiptMessage(message),
      (disposed?: Readonly<Record<string, unknown>>) => { response = disposed; acknowledged = true; });
    assert.equal(acknowledged, true);
    if (response) return { ...response };
    const request = message as { rejectedFact: ReturnType<typeof terminalFact> };
    const fact = request.rejectedFact;
    return { type: "ack", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash };
  };
  try {
    for (const mode of ["bad-code", "bad-identity", "missing", "valid", "conflict"] as const) {
      const worker = await workerFixture(chrome), command = identity(`dispose-${mode}`, `attempt-${mode}`);
      store.prepare(command); store.markDispatched(command.commandId);
      const good = terminalFact(command);
      if (mode === "conflict") store.settleTerminalReceipt(good);
      const raw = mode === "missing" ? null : mode === "bad-code" ? { ...good, terminalReceipt: { ...good.terminalReceipt, failureCode: "UNDEFINED_PRODUCER_CODE" } }
        : mode === "bad-identity" ? { ...good, commandId: "unrelated-command" }
        : mode === "conflict" ? terminalFact(command, { resultHash: `sha256:${"f".repeat(64)}` }) : good;
      putFact(worker, good); worker.delivery.mutationSlot!.fact = raw;
      const before = store.readCommand(command.commandId);
      await worker.invoke("flushMutationReceipt"); await worker.invoke("flushMutationReceipt");
      const messages = await Promise.all(worker.frames.map(value => decrypt(worker.session.clientToServerKey, "client-to-server", decodeBrowserAuthorityFrame(value))));
      assert.deepEqual(messages[0], messages[1], "lost disposition redelivers the complete same slot fact");
      assert.throws(() => parseBrowserMutationReceiptMessage({ ...messages[0], rejectedFactHash: `sha256:${"0".repeat(64)}` }), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
      assert.throws(() => settle({ ...messages[0], receiptBindingHash: `sha256:${"0".repeat(64)}` }), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
      const first = settle(messages[0]), repeated = settle(messages[1]); assert.deepEqual(repeated, first);
      if (mode === "valid") { assert.equal(first.type, "ack"); assert.equal(store.readCommand(command.commandId)?.state, "CONFIRMED"); }
      else {
        assert.equal(first.type, "disposed");
        assert.equal(first.reasonCode, mode === "missing" ? "BROWSER_COMMAND_RECEIPT_MISSING" : mode === "conflict" ? "BROWSER_MUTATION_STATE_CONFLICT" : "BROWSER_RECONCILIATION_RECEIPT_INVALID");
        assert.deepEqual(store.readCommand(command.commandId), before, "disposition never fabricates or replaces WAL completion");
        await verifyDispositionAckRetention(worker, first, raw);
      }
      await worker.invoke("acceptMutationAck", worker.socket, await worker.frame("MUTATION_RECEIPT", 4, first));
      assert.equal(worker.delivery.mutationSlot, null);
      await verifyLateDisposition(worker, first, mode);
    }
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
};
const sessionBoundaries = async (chrome: ExtensionChromeApi): Promise<void> => {
  const ordered = await workerFixture(chrome);
  await Promise.all([ordered.invoke("sendEncrypted", ordered.socket, "HEARTBEAT", {}), ordered.invoke("sendEncrypted", ordered.socket, "MUTATION_RECEIPT", {})]);
  assert.deepEqual(ordered.frames.map(value => decodeBrowserAuthorityFrame(value).sequence), [2, 3]);
  const fact = terminalFact(identity("unsent", "unsent-attempt")); putFact(ordered, fact);
  Reflect.set(ordered.socket, "send", () => { throw new Error("INJECTED_SEND_FAILURE"); });
  await assert.rejects(ordered.invoke("flushMutationReceipt"), /INJECTED_SEND_FAILURE/u); assert.equal(ordered.closes(), 1); assert.equal(ordered.delivery.mutationSlot?.fact, fact);
  const obsolete = await workerFixture(chrome), replacement = await workerFixture(chrome); let unblock!: () => void;
  Reflect.set(Reflect.get(obsolete.actor, "commandDelivery"), "sendTail", new Promise<void>(resolve => { unblock = resolve; })); putFact(obsolete, fact);
  const sending = obsolete.invoke("flushMutationReceipt"); Object.assign(obsolete.connection, { socket: replacement.socket, session: replacement.session });
  unblock(); await sending; assert.equal(replacement.closes(), 0);
  assert.equal(replacement.frames.length, 0); assert.equal(obsolete.frames.length, 0);
  assert.equal(obsolete.delivery.mutationSlot?.fact, fact, "a stale session returns before sending and preserves the original slot");
  await obsolete.invoke("flushMutationReceipt"); assert.equal(replacement.frames.length, 1); assert.equal(obsolete.delivery.mutationSlot?.fact, fact);
  await obsoleteDiagnostics(chrome); await replayAdmission(chrome, fact); await claimHandoff();
};
const obsoleteDiagnostics = async (chrome: ExtensionChromeApi): Promise<void> => {
  for (const name of ["reportRuntimeFailure", "reportTargetFailure"]) {
    const stale = await workerFixture(chrome), current = await workerFixture(chrome); let release!: () => void;
    Reflect.set(Reflect.get(stale.actor, "commandDelivery"), "sendTail", new Promise<void>(resolve => { release = resolve; }));
    const report = name === "reportRuntimeFailure" ? stale.invoke(name, new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"), "liveness-pulse")
      : stale.invoke(name, { targetRef: "old", runtimeEventType: "tab-remove", reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" });
    Object.assign(stale.connection, { socket: current.socket, session: current.session }); release(); await report; await nextTick(); assert.equal(current.closes(), 0);
  }
};
const replayAdmission = async (chrome: ExtensionChromeApi, fact: ReturnType<typeof terminalFact>): Promise<void> => {
  const replay = await workerFixture(chrome); let executions = 0;
  Reflect.set(replay.actor, "executeCommand", async () => { executions += 1; putFact(replay, fact); });
  const command = await replay.frame("COMMAND", 2, {});
  await replay.invoke("onMessage", replay.socket, encodeBrowserAuthorityFrame(command)); assert.equal(executions, 1);
  await replay.invoke("onMessage", replay.socket, encodeBrowserAuthorityFrame(await replay.frame("MUTATION_RECEIPT", 3,
    { type: "ack", commandId: fact.commandId, receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash })));
  assert.equal(replay.delivery.mutationSlot, null);
  await replay.invoke("onMessage", replay.socket, encodeBrowserAuthorityFrame(command)); assert.equal(executions, 1); assert.equal(replay.closes(), 1);
};
const claimHandoff = async (): Promise<void> => {
  const claims = new TargetClaimAwaiter(); let reject!: (error: Error) => void;
  const old = claims.begin({ targetRef: "old", documentRef: "old", jobRefHash: identity("old", "old").executionFenceHash,
    send: () => new Promise<void>((_resolve, failed) => { reject = failed; }) });
  claims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); await assert.rejects(old);
  const current = { targetRef: "new", documentRef: "new", jobRefHash: identity("new", "new").executionFenceHash };
  const next = claims.begin({ ...current, send: async () => undefined }); reject(new Error("OLD_SEND_FAILURE")); await nextTick(); claims.accept(current); await next;
};

const authorizedWithdrawal = async (chrome: ExtensionChromeApi): Promise<void> => {
  for (const mode of ["admin", "ordinary", "other", "failed"] as const) {
    const fixture = await workerFixture(chrome), fact = terminalFact(identity("withdraw", "attempt")); putFact(fixture, fact);
    const job = await hashBrowserExtensionText("job-1"), other = await hashBrowserExtensionText("other-job"), registry = new ExtensionExactTargetRegistry();
    const bound = registry.claimOperatorTarget(23, job, "loader", "chrome-23"), retained = registry.claimOperatorTarget(24, other, "other-loader", "chrome-24");
    let open = true, removals = 0, finish!: () => void;
    const handler = new Promise<void>(resolve => { finish = resolve; }); fixture.delivery.pendingCommandHandlers.add(handler);
    void handler.then(() => fixture.delivery.pendingCommandHandlers.delete(handler));
    Object.assign(fixture.authority, { targets: registry, activeTarget: mode === "other" ? retained : mode === "ordinary" ? null : bound,
      debuggerRuntime: { awaitPageReadPermission: async () => undefined,
        readTargets: async () => open ? [{ id: "chrome-23", tabId: 23 }] : [], forgetAttached: () => undefined,
        readTab: async () => { if (!open) throw new Error("ABSENT"); return { id: 23 }; }, removeTab: async () => {
          assert.equal(fixture.delivery.pendingCommandHandlers.size, 0); assert.equal(fixture.delivery.mutationSlot?.fact, fact);
          if (mode === "failed") throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); removals += 1; open = false;
        } } });
    await operation(fixture, { action: "release", jobRefHash: mode === "other" ? await hashBrowserExtensionText("unrelated") : job,
      releaseAuthority: mode === "ordinary" ? "business-admitted" : "website-admin-deletion" });
    assert.equal(fixture.delivery.commandAdmissionSuspended, true); assert.equal(removals, 0);
    const handlers = Array.from(fixture.delivery.pendingTargetHandlers.values(), record => record.promise); finish(); const outcomes = await Promise.allSettled(handlers); await nextTick();
    assert.equal(fixture.delivery.pendingTargetHandlers.size, 0);
    if (mode === "failed") { assert.equal(outcomes[0]?.status, "rejected"); assert.equal(fixture.delivery.mutationSlot?.fact, fact); assert.equal(registry.findByJobRefHash(job), bound); }
    else { assert.equal(outcomes[0]?.status, "fulfilled", String(outcomes[0])); assert.equal(fixture.delivery.mutationSlot === null, mode === "admin"); assert.equal(removals, mode === "other" ? 0 : 1); }
    assert.equal(registry.findByTabId(24), retained);
  }
};
const withdrawalRaces = async (chrome: ExtensionChromeApi): Promise<void> => {
  const fixture = await workerFixture(chrome), job = await hashBrowserExtensionText("job-1");
  let guard!: () => void, finishAcquire!: () => void, finishCommand!: () => void;
  fixture.authority.acquireJobBoundChatGptTarget = (_mode: string, _job: string, _url: unknown, input: () => void) => {
    guard = input; return new Promise<void>(resolve => { finishAcquire = resolve; }); };
  await operation(fixture, { action: "acquire", jobRefHash: job, targetMode: "fresh" }); assert.doesNotThrow(guard);
  const command = new Promise<void>(resolve => { finishCommand = resolve; }); fixture.delivery.pendingCommandHandlers.add(command);
  void command.then(() => fixture.delivery.pendingCommandHandlers.delete(command));
  await operation(fixture, { action: "release", jobRefHash: job, releaseAuthority: "website-admin-deletion" }, 3);
  assert.doesNotThrow(guard); assert.equal(fixture.delivery.pendingTargetHandlers.size, 1); const handlers = Array.from(fixture.delivery.pendingTargetHandlers.values(), record => record.promise); finishAcquire(); await nextTick();
  assert.equal(fixture.delivery.commandAdmissionSuspended, false); finishCommand(); await Promise.all(handlers);
  await assert.rejects(operation(fixture, { action: "release", jobRefHash: job }, 4), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  await reconnectedWithdrawal(chrome, job);
};
const verifyWithdrawalReceipts = async (old: Awaited<ReturnType<typeof workerFixture>>, sameJob: boolean,
  fact: ReturnType<typeof terminalFact>): Promise<void> => {
    const receipts = old.frames.map(value => decodeBrowserAuthorityFrame(value)).filter(frame => frame.kind === "MUTATION_RECEIPT");
    if (sameJob) assert.equal(receipts.length, 0);
    else {
      assert.ok(receipts.length >= 1);
      for (const frame of receipts) {
        const message = parseBrowserMutationReceiptMessage(await decrypt(old.session.clientToServerKey, "client-to-server", frame));
        assert.equal(message.type, "dispose");
        assert.deepEqual(message.type === "dispose" ? message.rejectedFact : null, fact);
        assert.equal(message.commandId, fact.commandId); assert.equal(message.receiptBindingHash, fact.receiptBindingHash);
      }
    }
};
const verifyWithdrawalDrain = async (old: Awaited<ReturnType<typeof workerFixture>>,
  releases: Promise<void>[], sameJob: boolean): Promise<void> => {
    await Promise.all(releases); await nextTick(); await Reflect.get(Reflect.get(old.actor, "commandDelivery"), "sendTail");
    assert.equal(old.delivery.pendingTargetHandlers.size, 0); assert.equal(old.delivery.commandAdmissionSuspended, false); assert.equal(old.delivery.mutationSlot === null, sameJob);
};
const reconnectedWithdrawal = async (chrome: ExtensionChromeApi, job: `sha256:${string}`): Promise<void> => {
  for (const sameJob of [true, false]) {
    const [old, other] = await Promise.all([workerFixture(chrome), hashBrowserExtensionText("another")]);
    const fact = terminalFact(identity("reconnected", "attempt")), registry = new ExtensionExactTargetRegistry();
    const bound = registry.claimOperatorTarget(23, job, "loader", "chrome-23"); let finish!: () => void, finishRead!: () => void,
      finishRemove!: () => void, startedRemove!: () => void, open = true;
    const removed = new Promise<void>(resolve => { finishRemove = resolve; }), started = new Promise<void>(resolve => { startedRemove = resolve; });
    const read = new Promise<void>(resolve => { finishRead = resolve; }), handler = new Promise<void>(resolve => { finish = resolve; });
    putFact(old, fact); old.delivery.mutationSlot!.fact = null; old.delivery.pendingCommandHandlers.add(handler);
    void handler.then(() => { old.delivery.pendingCommandHandlers.delete(handler); old.delivery.mutationSlot!.fact = fact; });
    Object.assign(old.authority, { targets: registry, activeTarget: bound,
      debuggerRuntime: { awaitPageReadPermission: () => read,
        forgetAttached: () => undefined, readTargets: async () => open ? [{ id: "chrome-23", tabId: 23 }] : [],
        readTab: async () => { if (!open) throw new Error("ABSENT"); return { id: 23 }; },
        removeTab: async () => { startedRemove(); await removed; open = false; } } });
    const drain = old.invoke("drainDisconnectedHandlers"); await operation(old, { action: "release",
      jobRefHash: sameJob ? job : other, releaseAuthority: "website-admin-deletion" });
    assert.equal(old.delivery.pendingTargetHandlers.size, 0, "old drain rejects new release without creating a handler"); finish(); await nextTick(); assert.equal(old.delivery.commandAdmissionSuspended, true);
    finishRead(); await drain; const deliveredBeforeRelease = old.frames.length;
    await operation(old, { action: "release", jobRefHash: sameJob ? job : other, releaseAuthority: "website-admin-deletion" }, 3);
    const releases = Array.from(old.delivery.pendingTargetHandlers.values(), record => record.promise);
    if (sameJob) { await started; assert.equal(old.delivery.commandAdmissionSuspended, true); assert.equal(old.delivery.mutationSlot?.fact, fact); finishRemove(); }
    await verifyWithdrawalDrain(old, releases, sameJob);
    await old.invoke("flushMutationReceipt");
    await verifyWithdrawalReceipts({ ...old, frames: old.frames.slice(deliveredBeforeRelease) }, sameJob, fact);
  }
};

const pairingWakeSources = async (fixture: ReturnType<typeof chromeFixture>, build: string): Promise<void> => {
  let wakeReads = 0; const wakes = new PairingAutoBootstrap(fixture.chrome, { canAttemptAutomaticPairing: () => true, pair: async () => undefined }, build,
    async () => { wakeReads += 1; return { authority: "present", pairingSecret: null, releaseBuildId: build }; });
  wakes.start(); await wakes.attempt(); assert.equal(wakeReads, 1); assert.deepEqual(fixture.configuration(), { name: GRASSEYE_AUTO_PAIRING_ALARM, periodInMinutes: 1 });
  fixture.startup(); await wakes.attempt(); assert.equal(wakeReads, 2);
  fixture.updated(1, { status: "complete" }, { id: 1, url: "http://127.0.0.1:4174/" }); await Promise.resolve(); assert.equal(wakeReads, 2);
  fixture.updated(2, { status: "complete" }, { id: 2, url: "http://127.0.0.1:4173/" }); await wakes.attempt(); assert.equal(wakeReads, 3);
  fixture.alarm({ name: "unrelated" }); await Promise.resolve(); assert.equal(wakeReads, 3); fixture.alarm({ name: GRASSEYE_AUTO_PAIRING_ALARM }); await wakes.attempt(); assert.equal(wakeReads, 4);
};

const verifyAutomaticDeliveryRecovery = async (chrome: ExtensionChromeApi): Promise<void> => {
  await originalDelivery(chrome); await dispositionRoundTrips(chrome); await sessionBoundaries(chrome); await authorizedWithdrawal(chrome); await withdrawalRaces(chrome);
};

export const exerciseAutomaticPairing = async (): Promise<ExtensionChromeApi> => {
  const fixture = chromeFixture(), build = "build-00000000-0000-4000-8000-000000000001", secret = "a".repeat(64);
  await exercisePairingReadback(secret, build);
  let resolve!: (state: WorkbenchPairingState) => void, reads = 0, pairs = 0;
  const single = new PairingAutoBootstrap(fixture.chrome, { canAttemptAutomaticPairing: () => true,
    pair: async value => { assert.equal(value, secret); pairs += 1; } }, build, () => { reads += 1; return new Promise<WorkbenchPairingState>(done => { resolve = done; }); });
  const first = single.attempt(); assert.equal(single.attempt(), first); assert.equal(reads, 1); resolve({ authority: "absent", pairingSecret: secret, releaseBuildId: build });
  await first; assert.equal(pairs, 1);
  await new PairingAutoBootstrap(fixture.chrome, { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("MUST_RELOAD"); } }, build,
    async () => ({ authority: "absent", pairingSecret: secret, releaseBuildId: "build-00000000-0000-4000-8000-000000000002" })).attempt(); assert.equal(fixture.reloads(), 1);
  await pairingWakeSources(fixture, build);
  await new PairingAutoBootstrap(fixture.chrome, { canAttemptAutomaticPairing: () => false, pair: async () => { throw new Error("CONNECTED"); } }, build,
    async () => { throw new Error("MUST_NOT_FETCH"); }).attempt();
  const rejected = new PairingAutoBootstrap(fixture.chrome, { canAttemptAutomaticPairing: () => true, pair: async () => { throw new Error("MUST_NOT_PAIR"); } }, build,
    async () => { throw new Error("BROWSER_PAIRING_ORIGIN_REJECTED"); }); await rejected.attempt(); assert.equal(rejected.currentFailureCode(), "BROWSER_PAIRING_ORIGIN_REJECTED");
  await verifyAutomaticDeliveryRecovery(fixture.chrome);
  return fixture.chrome;
};
