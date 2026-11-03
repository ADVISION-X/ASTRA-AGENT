import { randomBytes } from "node:crypto";
import type { BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";
import { browserMutationTerminalFactShapeValid, type BrowserMutationTerminalFact, type BrowserMutationDisposeRequest, type BrowserMutationDisposed } from "../exact-target/browser-observation-receipt.js";
import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame,
  type BrowserAuthorityFrame } from "./browser-authority-frame-codec.js";
import { createBrowserAuthorityHandshake, decryptBrowserAuthorityFrame, encryptBrowserAuthorityFrame,
  verifyBrowserAuthorityChallenge, type BrowserAuthorityDirectionalKeys, type BrowserAuthorityHandshakeState } from "./browser-authority-session-crypto.js";
import { BrowserCommandTerminalReplyError, type BrowserGovernedCommand, type BrowserCommandReply,
  type BrowserCommandPort } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "./command-permit.js";
import { authorityRecord, canonicalBrowserAuthorityPlaintext, parseBrowserCommandReply,
  parseBrowserMutationReceiptMessage, encryptedFrameBody, integerField, parseBrowserAuthorityTargetClaim,
  parseBrowserAuthorityTargetRevoke, parseCanonicalPlaintext, stringField,
  type BrowserAuthorityTargetClaim, type BrowserAuthorityTargetRevoke } from "./browser-authority-frame-payload.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS, BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS, BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
  BROWSER_PROTOCOL_REVISION } from "../protocol/generated/browser-protocol.generated.js";
import { parseBrowserAuthorityDiagnostic } from "./browser-authority-diagnostic.js";

export type BrowserAuthoritySocket = Readonly<{ send(frame: string): void; close(code?: number): void }>;
export type BrowserAuthorityReady = Readonly<{
  authorityRef: string; authorityEpoch: number; certificateHash: `sha256:${string}`;
  channelSessionHash: `sha256:${string}`; commandPermitKey: string;
}>;
export type BrowserAuthorityWebSocketOptions = Readonly<{
  pairingSecret: string | null; onPairingStarted(): void; onHeartbeat(): void;
  onAuthenticated(input: Readonly<{ extensionId: string; extensionVersion: string; releaseBuildId: string;
    sessionHash: `sha256:${string}`; commandPermitKey: string }>): BrowserAuthorityReady;
  onMutationReceipt(fact: BrowserMutationTerminalFact | BrowserMutationDisposeRequest, acknowledge: (disposed?: BrowserMutationDisposed) => void): void;
  onTargetClaim(input: BrowserAuthorityTargetClaim): void; onTargetRevoke(input: BrowserAuthorityTargetRevoke): void;
  onDiagnostic(reasonCode: string, refs: Readonly<Record<string, string>>): void;
  onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void;
}>;
type AwaitingReply = Readonly<{
  permit: BrowserCommandPermit; command: BrowserGovernedCommand; receiptBindingHash: `sha256:${string}` | null;
  targetRef: string; replyChannelToken: string; permitSequence: number;
  diagnostic: Readonly<{ reasonCode: string; commandStage: string }> | null;
  resolve(reply: BrowserCommandReply): void; reject(error: Error): void; timeout: ReturnType<typeof setTimeout>;
}>;
type ActiveSocket = Readonly<{
  socket: BrowserAuthoritySocket; keys: BrowserAuthorityDirectionalKeys; lastClientSequence: number;
  nextServerSequence: number; lastHeartbeatAt: number; replies: ReadonlyMap<number, AwaitingReply>;
}>;
const MAX_PREAUTH_FRAMES = 3, AUTH_EPOCH = 1, MUTATION_TERMINAL_REPLY_GRACE_MS = 4_000;
const aadForFrame = (frame: Pick<BrowserAuthorityFrame, "protocolVersion" | "kind" | "epoch" | "sequence" | "deadline">): string =>
  canonicalizeBrowserAuthorityValue({ protocolVersion: frame.protocolVersion, kind: frame.kind,
    epoch: frame.epoch, sequence: frame.sequence, deadline: frame.deadline });

/** One Node socket authority; authenticated terminal facts settle before their delivery acknowledgement. */
export class BrowserAuthorityWebSocket implements BrowserCommandPort {
  private active: ActiveSocket | null = null;
  private pending: Readonly<{ socket: BrowserAuthoritySocket; state: BrowserAuthorityHandshakeState; frameCount: number }> | null = null;
  private pairingSecret: string | null;
  private closed = false;
  public constructor(private readonly options: BrowserAuthorityWebSocketOptions) {
    this.pairingSecret = options.pairingSecret ?? this.createPairingSecret();
  }
  public readOperatorPairingSecret(): string | null { return this.closed || this.active ? null : this.pairingSecret; }

  public requestPreauthorizedTargetAcquisitionCancellation(jobRefHash: `sha256:${string}`,
    requestSequence: number, deadlineAt: number): number {
    if (!Number.isSafeInteger(requestSequence) || requestSequence < 1) throw new Error("BROWSER_TARGET_INVALID");
    return this.sendControlFrame(this.active?.socket ?? null, "TARGET_ACQUIRE",
      { action: "cancel-acquisition", jobRefHash, requestSequence }, deadlineAt);
  }

  private sendControlFrame(socket: BrowserAuthoritySocket | null,
    kind: "TARGET_CLAIM" | "MUTATION_RECEIPT" | "TARGET_ACQUIRE", body: Record<string, unknown>,
    deadlineAt = Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS): number {
    this.assertLive();
    const active = this.active, now = Date.now();
    if (!active || active.socket !== socket) throw new Error("BROWSER_LIVENESS_EXPIRED");
    const maximum = kind === "TARGET_ACQUIRE" && body.action === "acquire"
      ? BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS;
    if (!Number.isFinite(deadlineAt) || deadlineAt <= now || deadlineAt > now + maximum) {
      throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
    }
    const sequence = active.nextServerSequence;
    const frame = this.encryptedFrame(active, kind, sequence, new Date(deadlineAt).toISOString(), body);
    this.active = { ...active, nextServerSequence: sequence + 1 };
    try { active.socket.send(encodeBrowserAuthorityFrame(frame)); }
    catch (cause) {
      this.revoke(active.socket, "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", cause);
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { cause });
    }
    return sequence;
  }

  public close(reasonCode: string): void {
    this.closed = true;
    const sockets = new Set([this.active?.socket, this.pending?.socket]);
    const errors: unknown[] = [];
    try { this.detachActive(reasonCode); } catch (error) { errors.push(error); }
    this.pending = null;
    for (const socket of sockets) {
      try { socket?.close(1000); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "BROWSER_SOCKET_CLOSE_INCOMPLETE");
  }

  public receive(socket: BrowserAuthoritySocket, encoded: string): void {
    if (this.closed) { socket.close(1000); return; }
    try {
      const frame = decodeBrowserAuthorityFrame(encoded);
      if (Date.parse(frame.deadline) <= Date.now()) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      if (frame.kind === "PAIR_HELLO") this.acceptHello(socket, frame);
      else if (frame.kind === "PAIR_PROOF") this.acceptProof(socket, frame);
      else this.receiveAuthenticated(socket, frame);
    } catch (error) { this.revoke(socket, error instanceof Error ? error.message : "BROWSER_AUTH_TRANSCRIPT_INVALID", error); }
  }
  public disconnect(socket: BrowserAuthoritySocket, reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
    refs?: Readonly<Record<string, string>>): void {
    if (this.pending?.socket === socket) this.pending = null;
    if (this.active?.socket === socket) this.clearActive(reasonCode, refs);
  }
  public assertLive(now = Date.now()): void {
    const active = this.active;
    if (!active || now - active.lastHeartbeatAt > BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS) {
      if (active) this.revoke(active.socket, "BROWSER_LIVENESS_EXPIRED");
      throw new Error("BROWSER_LIVENESS_EXPIRED");
    }
  }
  public rejectTargetCommands(targetRef: string, reasonCode: string, nativeCauseCode?: string): void {
    const active = this.active;
    if (!active) return;
    const replies = new Map(active.replies);
    for (const [sequence, reply] of replies) {
      if (reply.targetRef !== targetRef) continue;
      clearTimeout(reply.timeout); replies.delete(sequence);
      const cause = nativeCauseCode ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined;
      reply.reject(new Error(reasonCode, { cause }));
    }
    this.active = { ...active, replies };
  }

  public async send(permit: BrowserCommandPermit, command: BrowserGovernedCommand,
    onDispatched?: () => void, receiptBindingHash: `sha256:${string}` | null = null): Promise<BrowserCommandReply> {
    if ((permit.mutationClass === "mutation") !== (receiptBindingHash !== null)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    this.assertLive();
    const active = this.active!;
    const sequence = active.nextServerSequence;
    const budget = Math.min(BROWSER_COMMAND_DEFAULT_DEADLINE_MS, permit.commandTtlMs);
    const frame = this.encryptedFrame(active, "COMMAND", sequence, new Date(Date.now() + budget).toISOString(), { permit, command, receiptBindingHash });
    return new Promise<BrowserCommandReply>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeReply(sequence);
        try { this.revoke(active.socket, "BROWSER_COMMAND_RECEIPT_MISSING"); }
        catch (cause) { reject(new Error("BROWSER_COMMAND_RECEIPT_MISSING", { cause })); return; }
        reject(new Error("BROWSER_COMMAND_RECEIPT_MISSING"));
      }, budget + (permit.mutationClass === "mutation" ? MUTATION_TERMINAL_REPLY_GRACE_MS : 0));
      const replies = new Map(active.replies);
      replies.set(sequence, { permit, command, receiptBindingHash, targetRef: permit.targetRef,
        replyChannelToken: permit.replyChannelToken, permitSequence: permit.sequence, diagnostic: null, resolve, reject, timeout });
      this.active = { ...active, replies, nextServerSequence: sequence + 1 };
      try { onDispatched?.(); active.socket.send(encodeBrowserAuthorityFrame(frame)); }
      catch (error) {
        const code = error instanceof Error && /^(?:BROWSER|RUNTIME_LOG)_[A-Z_]+$/u.test(error.message)
          ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
        this.removeReply(sequence);
        try { this.revoke(active.socket, code); }
        catch (failure) { reject(new Error(code, { cause: new AggregateError([error, failure]) })); return; }
        reject(new Error(code, { cause: error }));
      }
    });
  }

  public requestPreauthorizedTargetAcquisition(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`, parentConversationUrl: string | undefined,
    deadlineAt: number,
  ): number {
    const located = targetMode === "authorized-continuation" || targetMode === "confirmed-readback";
    if (typeof parentConversationUrl !== (located ? "string" : "undefined")) throw new Error("BROWSER_TARGET_INVALID");
    return this.sendControlFrame(this.active?.socket ?? null, "TARGET_ACQUIRE", {
      action: "acquire", targetMode, jobRefHash,
      ...(located ? { parentConversationUrl } : {}),
    }, deadlineAt);
  }
  public requestPreauthorizedTargetRelease(jobRefHash: `sha256:${string}`,
    releaseAuthority: BrowserTargetReleaseAuthority, deadlineAt: number): number {
    return this.sendControlFrame(this.active?.socket ?? null, "TARGET_ACQUIRE", { action: "release", jobRefHash, releaseAuthority }, deadlineAt);
  }

  private acceptHello(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    if (this.active || this.pending || this.pairingSecret === null || frame.epoch !== 0 || frame.sequence !== 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const body = frame.body, releaseBuildId = typeof body.releaseBuildId === "string" ? body.releaseBuildId : "";
    if (!/^build-[a-f0-9-]{36}$/u.test(releaseBuildId)) throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    const signing = authorityRecord(body.clientSigningPublicJwk);
    if (!signing) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const state = createBrowserAuthorityHandshake(this.pairingSecret, { extensionId: stringField(body, "extensionId"),
      extensionVersion: stringField(body, "extensionVersion"), releaseBuildId, clientEcdhPublicKey: stringField(body, "clientEcdhPublicKey"),
      clientSigningPublicJwk: signing as Readonly<Record<string, string>>, deadline: frame.deadline });
    this.pending = { socket, state, frameCount: 1 }; this.options.onPairingStarted();
    socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_CHALLENGE",
      epoch: 0, sequence: 0, deadline: frame.deadline, body: state.challenge }));
  }
  private acceptProof(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    const pending = this.pending;
    if (!pending || pending.socket !== socket || pending.frameCount >= MAX_PREAUTH_FRAMES || frame.epoch !== 0 || frame.sequence !== 1) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const verified = verifyBrowserAuthorityChallenge(pending.state, { clientSignature: stringField(frame.body, "clientSignature"),
      clientPairingMac: stringField(frame.body, "clientPairingMac") });
    const ready = this.options.onAuthenticated({ extensionId: verified.extensionId, extensionVersion: verified.extensionVersion,
      releaseBuildId: verified.releaseBuildId, sessionHash: verified.sessionHash,
      commandPermitKey: verified.directionalKeys.commandPermit.toString("base64") });
    this.pairingSecret = null; this.pending = null;
    this.active = { socket, keys: verified.directionalKeys, lastClientSequence: 1, nextServerSequence: 1,
      lastHeartbeatAt: Date.now(), replies: new Map() };
    const deadline = new Date(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS).toISOString();
    socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "AUTHENTICATED",
      epoch: AUTH_EPOCH, sequence: 0, deadline, body: { sessionHash: verified.sessionHash, serverFinalSignature: verified.serverFinalSignature } }));
    const frameReady = this.encryptedFrame(this.active, "READY", 1, deadline, ready);
    this.active = { ...this.active, nextServerSequence: 2 }; socket.send(encodeBrowserAuthorityFrame(frameReady));
  }

  private receiveAuthenticated(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    const active = this.active;
    if (!active || active.socket !== socket || frame.epoch !== AUTH_EPOCH || frame.sequence <= active.lastClientSequence
      || ["PAIR_CHALLENGE", "AUTHENTICATED"].includes(frame.kind)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const body = parseCanonicalPlaintext(decryptBrowserAuthorityFrame({ key: active.keys.clientToServer, direction: "client-to-server",
      epoch: frame.epoch, sequence: frame.sequence, aad: aadForFrame(frame), encrypted: encryptedFrameBody(frame) }));
    this.active = { ...active, lastClientSequence: frame.sequence, lastHeartbeatAt: Date.now() };
    if (!this.acceptAuthenticatedControl(socket, frame, body)) this.acceptReply(socket, body);
  }
  private acceptAuthenticatedControl(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame, body: Record<string, unknown>): boolean {
    switch (frame.kind) {
      case "MUTATION_RECEIPT": this.settleMutationReceipt(socket, parseBrowserMutationReceiptMessage(body)); return true;
      case "HEARTBEAT":
        if (Object.keys(body).length !== 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
        this.options.onHeartbeat(); return true;
      case "TARGET_CLAIM": {
        const claim = parseBrowserAuthorityTargetClaim(body);
        this.options.onTargetClaim(claim);
        this.sendControlFrame(socket, "TARGET_CLAIM", { targetRef: claim.targetRef, documentRef: claim.documentRef, jobRefHash: claim.jobRefHash });
        return true;
      }
      case "TARGET_REVOKE": this.options.onTargetRevoke(parseBrowserAuthorityTargetRevoke(body)); return true;
      case "DIAGNOSTIC": {
        const diagnostic = parseBrowserAuthorityDiagnostic(body), refs = diagnostic.refs, active = this.active;
        const sequence = Number(refs.failedFrameSequence), pending = active?.replies.get(sequence);
        const origin = [refs.failedFrameKind, refs.diagnosticSource, refs.runtimeEventType].join("\0");
        if (active && pending && pending.diagnostic === null && origin === "COMMAND\0extension-runtime\0command-handler"
          && refs.commandStage) {
          const replies = new Map(active.replies);
          replies.set(sequence, { ...pending, diagnostic: Object.freeze({ reasonCode: diagnostic.reasonCode, commandStage: refs.commandStage }) });
          this.active = { ...active, replies };
        }
        this.options.onDiagnostic(diagnostic.reasonCode, refs); return true;
      }
      case "REVOKE": {
        const diagnostic = parseBrowserAuthorityDiagnostic(body); this.clearActive(diagnostic.reasonCode, diagnostic.refs);
        try { socket.close(1008); } catch { this.options.onDiagnostic("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { failedOperation: "socket-close" }); }
        return true;
      }
      case "REPLY": return false;
      default: throw new Error("BROWSER_CAPABILITY_REJECTED");
    }
  }
  private acceptReply(socket: BrowserAuthoritySocket, body: Record<string, unknown>): void {
    const active = this.active, sequence = integerField(body, "requestSequence", 1), reply = active?.replies.get(sequence);
    if (!active || active.socket !== socket || !reply) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const parsed = parseBrowserCommandReply(body, reply.permit, reply.command, reply.receiptBindingHash);
    if (parsed.fact) this.settleMutationReceipt(socket, parsed.fact);
    this.removeReply(sequence);
    if (parsed.errorCode !== null) reply.reject(new BrowserCommandTerminalReplyError(parsed.errorCode,
      reply.replyChannelToken, sequence, reply.permitSequence,
      reply.diagnostic?.reasonCode === parsed.errorCode ? reply.diagnostic.commandStage : null));
    else reply.resolve({ replyChannelToken: reply.replyChannelToken, transportSequence: sequence,
      permitSequence: reply.permitSequence, result: body.result, mutationReceipt: parsed.fact });
  }
  private settleMutationReceipt(socket: BrowserAuthoritySocket, message: BrowserMutationTerminalFact | BrowserMutationDisposeRequest): void {
    const keys = this.active?.keys;
    this.options.onMutationReceipt(message, disposed => {
      if (!keys || this.active?.socket !== socket || this.active.keys !== keys) throw new Error("BROWSER_LIVENESS_EXPIRED");
      if (disposed) { this.sendControlFrame(socket, "MUTATION_RECEIPT", disposed); return; }
      const fact = message.type === "fact" ? message : message.rejectedFact;
      if (!browserMutationTerminalFactShapeValid(fact)) throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
      this.sendControlFrame(socket, "MUTATION_RECEIPT", { type: "ack", commandId: fact.commandId,
        receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash });
    });
  }

  private encryptedFrame(active: ActiveSocket,
    kind: Extract<BrowserAuthorityFrame["kind"], "COMMAND" | "READY" | "TARGET_ACQUIRE" | "TARGET_CLAIM" | "REVOKE" | "MUTATION_RECEIPT">,
    sequence: number, deadline: string, body: Record<string, unknown>): BrowserAuthorityFrame {
    const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: AUTH_EPOCH, sequence, deadline };
    return { ...header, body: { encrypted: encryptBrowserAuthorityFrame({ key: active.keys.serverToClient,
      direction: "server-to-client", epoch: AUTH_EPOCH, sequence, aad: aadForFrame(header), plaintext: canonicalBrowserAuthorityPlaintext(body) }) } };
  }

  private removeReply(sequence: number): void {
    const active = this.active, reply = active?.replies.get(sequence);
    if (!active || !reply) return;
    clearTimeout(reply.timeout); const replies = new Map(active.replies); replies.delete(sequence); this.active = { ...active, replies };
  }
  private clearActive(reasonCode: string, refs?: Readonly<Record<string, string>>, cause?: unknown): void {
    this.detachActive(reasonCode, cause);
    this.options.onRevoked(reasonCode, refs);
  }
  private detachActive(reasonCode: string, cause?: unknown): BrowserAuthoritySocket | null {
    const active = this.active; this.active = null;
    if (active) for (const reply of active.replies.values()) { clearTimeout(reply.timeout); reply.reject(new Error(reasonCode, { cause })); }
    this.pairingSecret = this.createPairingSecret();
    return active?.socket ?? null;
  }
  private revoke(socket: BrowserAuthoritySocket, reasonCode: string, cause?: unknown): void {
    if (this.pending?.socket === socket) this.pending = null;
    let failure: unknown = null;
    try { if (this.active?.socket === socket) this.clearActive(reasonCode, undefined, cause); else this.options.onRevoked(reasonCode); }
    catch (error) { failure = error; }
    try { socket.close(1008); } catch (error) { failure = new AggregateError([failure, error]); }
    if (failure !== null) throw new Error(reasonCode, { cause: new AggregateError([cause, failure]) });
  }
  private createPairingSecret(): string { return randomBytes(32).toString("hex"); }
}
