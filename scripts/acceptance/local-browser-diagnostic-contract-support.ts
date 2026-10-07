import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserCommandActor, BrowserCommandTerminalReplyError } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { encodeBrowserAuthorityFrame, decodeBrowserAuthorityFrame, canonicalizeBrowserAuthorityValue } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { encryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { createClickCommand, permit } from "./local-browser-terminal-fixture.js";
import { terminalFact, exactHash } from "./local-browser-mutation-store-support.js";

import { parseBrowserAuthorityDiagnostic } from
  "../../src/lib/browser/transport/browser-authority-diagnostic.js";
import { parseBrowserAuthorityTargetClaim } from
  "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { BrowserAuthorityWebSocket } from
  "../../src/lib/browser/transport/browser-authority-websocket.js";


const authenticatedDiagnosticChannel = (onMutationReceipt: ConstructorParameters<typeof BrowserAuthorityWebSocket>[0]["onMutationReceipt"]) => {
  const key = Buffer.alloc(32, 7), sent: string[] = [];
  const socket = { send: (frame: string) => { sent.push(frame); }, close: () => undefined };
  const channel = new BrowserAuthorityWebSocket({
    pairingSecret: "a".repeat(64), onPairingStarted: () => {}, onHeartbeat: () => {},
    onAuthenticated: () => { throw new Error("UNUSED_HANDSHAKE"); }, onMutationReceipt,
    onTargetClaim: () => {}, onTargetRevoke: () => {}, onDiagnostic: () => {}, onRevoked: () => {},
  });
  // Bind a known authenticated session; receive still verifies AEAD, sequence and the real closed payload parser.
  Reflect.set(channel, "active", { socket, keys: { clientToServer: key, serverToClient: key }, lastClientSequence: 1,
    nextServerSequence: 2, lastHeartbeatAt: Date.now(), replies: new Map() });
  let sequence = 1;
  const receive = (kind: "DIAGNOSTIC" | "REPLY", body: Record<string, unknown>) => {
    const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: 1, sequence: ++sequence,
      deadline: new Date(Date.now() + 10_000).toISOString() };
    const encrypted = encryptBrowserAuthorityFrame({ key, direction: "client-to-server", epoch: 1, sequence,
      aad: canonicalizeBrowserAuthorityValue(header), plaintext: canonicalizeBrowserAuthorityValue(body) });
    channel.receive(socket, encodeBrowserAuthorityFrame({ ...header, body: { encrypted } }));
  };
  return { channel, socket, sent, receive };
};
const commandDiagnostic = (requestSequence: number, reasonCode = "BROWSER_TARGET_INVALID", stage = "target-resolution") => ({
  reasonCode, failedFrameKind: "COMMAND", failedFrameSequence: requestSequence,
  diagnosticSource: "extension-runtime", runtimeEventType: "command-handler", commandStage: stage, encodedByteLength: 0,
});
const exerciseAuthenticatedDiagnosticReplies = async (): Promise<void> => {
  const wrongOrigin = { "wrong-frame": { failedFrameKind: "REPLY" },
    "wrong-source": { diagnosticSource: "extension-frame" }, "wrong-event": { runtimeEventType: "message-handler" } };
  for (const mode of ["matching", "mismatch", "other-sequence", "absent", ...Object.keys(wrongOrigin)]) {
    const fixture = authenticatedDiagnosticChannel(() => { throw new Error("UNEXPECTED_OBSERVATION_WAL"); });
    const candidate = { ...permit("diagnostic-observation"), mutationClass: "observation" as const,
      capabilityId: "browser.dom.inspect.v1" as const, childCapabilityId: "reconcile_gpt_attachment_set", replayPolicy: "observation-only" as const };
    const pending = fixture.channel.send(candidate, { kind: "dom-intent", intent: { kind: "inspect", selector: "body", fields: [] } });
    const requestSequence = decodeBrowserAuthorityFrame(fixture.sent[0]!).sequence;
    if (mode !== "absent") fixture.receive("DIAGNOSTIC", { ...commandDiagnostic(
      mode === "other-sequence" ? requestSequence + 1 : requestSequence,
      mode === "mismatch" ? "BROWSER_DOCUMENT_INVALID" : "BROWSER_TARGET_INVALID"),
      ...wrongOrigin[mode as keyof typeof wrongOrigin] });
    if (mode === "matching") fixture.receive("DIAGNOSTIC", commandDiagnostic(requestSequence, "BROWSER_TARGET_INVALID", "registered-command"));
    assert.equal(Reflect.get(fixture.channel, "active").replies.size, 1, "diagnostics cannot settle a pending command");
    fixture.receive("REPLY", { requestSequence, permitSequence: candidate.sequence,
      replyChannelToken: candidate.replyChannelToken, mutationReceipt: null, errorCode: "BROWSER_TARGET_INVALID" });
    await assert.rejects(pending, (error: unknown) => error instanceof BrowserCommandTerminalReplyError
      && error.failureCode === "BROWSER_TARGET_INVALID" && error.commandStage === (mode === "matching" ? "target-resolution" : null));
    fixture.receive("DIAGNOSTIC", commandDiagnostic(requestSequence));
    assert.equal(Reflect.get(fixture.channel, "active").replies.size, 0, "late diagnostics cannot create retained history");
  }
};
const exerciseDiagnosticWalAndLogFailure = async (): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "browser-diagnostic-settlement-"));
  try {
    for (const logFailure of [false, true]) {
      const directory = join(root, String(logFailure)), logDirectory = join(directory, "logs"), phases: string[] = [];
      const store = new BrowserMutationStore(join(directory, "browser")), candidate = permit("diagnostic-" + logFailure);
      store.verifyRuntimeTaskProvenance(null);
      const logger = createRuntimeLogger({ producer: "diagnostic-contract", owner: "browser-session", component: "exact-target",
        terminalEnabled: false, fileSink: { directoryPath: logDirectory } });
      const fixture = authenticatedDiagnosticChannel((fact, acknowledge) => {
        store.settleTerminalReceipt(fact); phases.push("WAL"); acknowledge(); phases.push("ACK");
        if (logFailure) { rmSync(logDirectory, { recursive: true, force: true }); writeFileSync(logDirectory, "blocked"); }
      });
      const send = fixture.socket.send;
      fixture.socket.send = frame => {
        send(frame);
        const request = decodeBrowserAuthorityFrame(frame);
        if (request.kind !== "COMMAND") return;
        const identity = store.readCommand(candidate.commandId)!.identity;
        const fact = terminalFact(identity, { terminal: "rejected", mutationOutcome: "no", physicalInputCount: 0,
          failureCode: "BROWSER_TARGET_INVALID", nativeCauseCode: "BROWSER_TARGET_INVALID",
          resultHash: exactHash(canonicalizeBrowserAuthorityValue({ errorCode: "BROWSER_TARGET_INVALID" })) });
        fixture.receive("DIAGNOSTIC", commandDiagnostic(request.sequence));
        assert.deepEqual(phases, [], "diagnostic is not terminal evidence");
        fixture.receive("REPLY", { requestSequence: request.sequence, permitSequence: candidate.sequence,
          replyChannelToken: candidate.replyChannelToken, mutationReceipt: fact, errorCode: "BROWSER_TARGET_INVALID" });
      };
      const actor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), fixture.channel, store,
        { assertCurrentAuthority: () => undefined }, logger);
      await assert.rejects(actor.execute(candidate, createClickCommand()), (error: unknown) => {
        assert(error instanceof Error);
        assert.equal(error.message, "BROWSER_TARGET_INVALID");
        if (logFailure) {
          assert(error instanceof AggregateError);
          assert(error.cause instanceof BrowserCommandTerminalReplyError);
          assert.deepEqual([error.cause.failureCode, error.cause.replyChannelToken, error.cause.permitSequence],
            ["BROWSER_TARGET_INVALID", candidate.replyChannelToken, candidate.sequence]);
          assert.equal((error.errors[0] as Error).message, "RUNTIME_LOG_SINK_WRITE_FAILED");
        }
        return true;
      });
      assert.deepEqual(phases, ["WAL", "ACK"]);
      assert.equal(store.readCommand(candidate.commandId)?.state, "REJECTED");
      assert.equal(actor.pendingMutationCommandIds({ jobId: candidate.jobId, attemptId: candidate.attemptId,
        leaseVersion: candidate.leaseVersion, writerFenceHash: candidate.writerFenceHash } as never).length, 0);
      if (logFailure) assert.equal(logger.isWritable(), false);
      else {
        const events = readFileSync(logger.currentSegmentPath()!, "utf8").trim().split("\n").map(line => JSON.parse(line));
        const diagnostic = events.filter(event => event.kind === "event" && event.code === "BROWSER_COMMAND_DIAGNOSTIC_TARGET_RESOLUTION");
        assert.equal(diagnostic.length, 1);
        assert.equal(diagnostic[0].typedIdentity.commandId, candidate.commandId);
        assert.equal(diagnostic[0].typedIdentity.attemptId, candidate.attemptId);
        assert.equal(events.filter(event => event.kind === "span.terminal" && event.failure).length, 1);
      }
      store.close();
    }
  } finally { await rm(root, { recursive: true, force: true }); }
};

export const exerciseBrowserDiagnosticContract = async (): Promise<void> => {
  await exerciseAuthenticatedDiagnosticReplies();
  await exerciseDiagnosticWalAndLogFailure();
  const jobRefHash = `sha256:${"a".repeat(64)}` as const;
  assert.deepEqual(parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash,
  }), { targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash });
  assert.throws(() => parseBrowserAuthorityTargetClaim({
    targetRef: "target-tab-7", documentRef: "document-7", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash, title: "must-not-cross-wire",
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "page title is not an admitted Target claim wire field");

  assert.deepEqual(parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7",
    nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED", encodedByteLength: 0,
  }).refs, {
    failedFrameKind: "COMMAND", failedFrameSequence: "7", encodedByteLength: "0",
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    commandStage: "target-resolution", commandKind: "dom-intent", commandIntentKind: "click",
    capabilityId: "browser.dom.click.v1", targetRef: "target-tab-7",
    nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
  });
  for (const invalid of [
    { errorName: "Error" },
    { runtimeEventType: "unbounded-runtime-event" },
    { targetRef: "raw-uncontrolled-target" },
    { nativeCauseCode: "raw-uncontrolled-cause" },
  ]) assert.throws(() => parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    diagnosticSource: "extension-runtime", runtimeEventType: "command-handler",
    encodedByteLength: 0, ...invalid,
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "diagnostic refs must be complete controlled values or fail the whole frame");
  assert.throws(() => parseBrowserAuthorityDiagnostic({
    reasonCode: "BROWSER_DOCUMENT_INVALID", failedFrameKind: "COMMAND", failedFrameSequence: 7,
    encodedByteLength: 0,
  }), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "diagnostic source and event type are mandatory controlled facts");

  const rejected: Error[] = [];
  const timeout = setTimeout(() => undefined, 10_000);
  const websocket = new BrowserAuthorityWebSocket({
  onMutationReceipt: () => { throw new Error("UNEXPECTED_MUTATION_RECEIPT"); },
    pairingSecret: "a".repeat(64), onPairingStarted: () => {}, onHeartbeat: () => {},
    onAuthenticated: () => { throw new Error("UNUSED_AUTHENTICATION"); }, onTargetClaim: () => {},
    onTargetRevoke: () => {}, onDiagnostic: () => {}, onRevoked: () => {},
  });
  Reflect.set(websocket, "active", {
    socket: { send: () => {}, close: () => {} }, keys: {}, lastClientSequence: 0,
    nextServerSequence: 1, lastHeartbeatAt: Date.now(), replies: new Map([[7, {
      targetRef: "target-tab-7", replyChannelToken: "reply-7", permitSequence: 7,
      resolve: () => {}, reject: (error: Error) => { rejected.push(error); }, timeout,
    }]]),
  });
  websocket.rejectTargetCommands(
    "target-tab-7", "BROWSER_DEVTOOLS_CONFLICT", "CHROME_DEBUGGER_CANCELED_BY_USER",
  );
  assert.equal(rejected[0]?.message, "BROWSER_DEVTOOLS_CONFLICT");
  assert.equal((rejected[0]?.cause as { code?: string } | undefined)?.code,
    "CHROME_DEBUGGER_CANCELED_BY_USER",
    "a Target detach must reject the in-flight exact command with its native cause");

};
