import { randomBytes } from "node:crypto";
import {
  canonicalizeBrowserAuthorityValue,
  decodeBrowserAuthorityFrame,
  encodeBrowserAuthorityFrame,
  type BrowserAuthorityFrame,
} from "./browser-authority-frame-codec.js";
import {
  createBrowserAuthorityHandshake,
  decryptBrowserAuthorityFrame,
  encryptBrowserAuthorityFrame,
  type BrowserAuthorityDirectionalKeys,
  type BrowserAuthorityHandshakeState,
  verifyBrowserAuthorityChallenge,
} from "./browser-authority-session-crypto.js";
import {
  BrowserCommandTerminalReplyError,
  type BrowserGovernedCommand,
  type BrowserCommandReply,
  type BrowserCommandPort,
} from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "./command-permit.js";
import {
  authorityRecord,
  canonicalBrowserAuthorityPlaintext,
  compareReplyToken,
  encryptedFrameBody,
  parseCanonicalPlaintext,
} from "./browser-authority-frame-payload.js";
import {
  BROWSER_COMMAND_DEFAULT_DEADLINE_MS,
  BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
  BROWSER_PROTOCOL_REVISION,
} from "../protocol/generated/browser-protocol.generated.js";
import { parseBrowserAuthorityDiagnostic } from "./browser-authority-diagnostic.js";
import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";
export type BrowserAuthoritySocket = Readonly<{
  send(frame: string): void;
  close(code?: number): void;
}>;

export type BrowserAuthorityWebSocketOptions = Readonly<{
  pairingSecret: string | null;
  onPairingStarted(): void;
  onHeartbeat(): void;
  onAuthenticated(input: Readonly<{
    extensionId: string;
    extensionVersion: string;
    releaseBuildId: string;
    sessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }>): BrowserAuthorityReady;
  onTargetClaim(input: BrowserAuthorityTargetClaim): void;
  onTargetRevoke(targetRef: string): void;
  onDiagnostic(reasonCode: string, refs: Readonly<Record<string, string>>): void;
  onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void;
}>;

export type BrowserAuthorityReady = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: `sha256:${string}`;
  channelSessionHash: `sha256:${string}`;
  commandPermitKey: string;
}>;

export type BrowserAuthorityTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  claimOrigin: "https://chatgpt.com";
}>;

type AwaitingReply = Readonly<{
  targetRef: string;
  replyChannelToken: string;
  permitSequence: number;
  resolve: (reply: BrowserCommandReply) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>;
type ActiveSocket = Readonly<{
  socket: BrowserAuthoritySocket;
  keys: BrowserAuthorityDirectionalKeys;
  lastClientSequence: number;
  nextServerSequence: number;
  lastHeartbeatAt: number;
  replies: ReadonlyMap<number, AwaitingReply>;
}>;

const MAX_PREAUTH_FRAMES = 3;
const AUTH_EPOCH = 1;
const COMMAND_DEADLINE_MS = BROWSER_COMMAND_DEFAULT_DEADLINE_MS;
const MUTATION_TERMINAL_REPLY_GRACE_MS = 1_000;
const aadForFrame = (frame: Pick<BrowserAuthorityFrame, "protocolVersion" | "kind" | "epoch" | "sequence" | "deadline">): string =>
  canonicalizeBrowserAuthorityValue({
    protocolVersion: frame.protocolVersion,
    kind: frame.kind,
    epoch: frame.epoch,
    sequence: frame.sequence,
    deadline: frame.deadline,
  });

/**
 * The only Agent-side socket session owner.  It never reconnects, never
 * accepts plaintext post-auth frames, and clears authority before closing a
 * malformed, stale, or duplicate socket.
 */
export class BrowserAuthorityWebSocket implements BrowserCommandPort {
  private active: ActiveSocket | null = null;
  private pending: Readonly<{ socket: BrowserAuthoritySocket; state: BrowserAuthorityHandshakeState; frameCount: number }> | null = null;
  private pairingSecret: string | null;

  public constructor(private readonly options: BrowserAuthorityWebSocketOptions) {
    this.pairingSecret = options.pairingSecret ?? this.createPairingSecret();
  }

  /** The local Workbench may reveal the current one-time secret to the operator only. */
  public readOperatorPairingSecret(): string | null {
    return this.active ? null : this.pairingSecret;
  }

  public receive(socket: BrowserAuthoritySocket, encoded: string): void {
    try {
      const frame = decodeBrowserAuthorityFrame(encoded);
      if (Date.parse(frame.deadline) <= Date.now()) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      if (frame.kind === "PAIR_HELLO") return this.acceptHello(socket, frame);
      if (frame.kind === "PAIR_PROOF") return this.acceptProof(socket, frame);
      this.receiveAuthenticated(socket, frame);
    } catch (error) {
      this.revoke(socket, error instanceof Error ? error.message : "BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
  }

  public disconnect(socket: BrowserAuthoritySocket, reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", refs?: Readonly<Record<string, string>>): void {
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
      clearTimeout(reply.timeout);
      replies.delete(sequence);
      const cause = nativeCauseCode
        ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined;
      reply.reject(new Error(reasonCode, { cause }));
    }
    this.active = { ...active, replies };
  }

  public async send(
    permit: BrowserCommandPermit,
    command: BrowserGovernedCommand,
    onDispatched?: () => void,
  ): Promise<BrowserCommandReply> {
    this.assertLive();
    const active = this.active;
    if (!active) throw new Error("BROWSER_LIVENESS_EXPIRED");
    const sequence = active.nextServerSequence;
    const commandDeadlineMs = Math.min(
      COMMAND_DEADLINE_MS,
      permit.commandTtlMs,
    );
    const deadline = new Date(Date.now() + commandDeadlineMs).toISOString();
    const frame = this.encryptedFrame(active, "COMMAND", sequence, deadline, { permit, command });
    return new Promise<BrowserCommandReply>((resolve, reject) => {
      const replyDeadlineMs = commandDeadlineMs
        + (onDispatched === undefined ? 0 : MUTATION_TERMINAL_REPLY_GRACE_MS);
      const timeout = setTimeout(() => {
        this.removeReply(sequence);
        this.revoke(active.socket, "BROWSER_COMMAND_RECEIPT_MISSING");
        reject(new Error("BROWSER_COMMAND_RECEIPT_MISSING"));
      }, replyDeadlineMs);
      const replies = new Map(active.replies);
      replies.set(sequence, {
        targetRef: permit.targetRef,
        replyChannelToken: permit.replyChannelToken,
        permitSequence: permit.sequence,
        resolve,
        reject,
        timeout,
      });
      this.active = { ...active, nextServerSequence: sequence + 1, replies };
      try {
        onDispatched?.();
        active.socket.send(encodeBrowserAuthorityFrame(frame));
      } catch (error) {
        const reasonCode = error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
          ? error.message
          : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
        this.removeReply(sequence);
        this.revoke(active.socket, reasonCode);
        reject(new Error(reasonCode));
      }
    });
  }

  public requestPreauthorizedTargetAcquisition(targetRef?: string): void {
    this.assertLive();
    const active = this.active;
    if (!active) throw new Error("BROWSER_LIVENESS_EXPIRED");
    const sequence = active.nextServerSequence;
    const frame = this.encryptedFrame(
      active,
      "TARGET_ACQUIRE",
      sequence,
      new Date(Date.now() + COMMAND_DEADLINE_MS).toISOString(),
      targetRef ? { targetRef } : {},
    );
    this.active = { ...active, nextServerSequence: sequence + 1 };
    try {
      active.socket.send(encodeBrowserAuthorityFrame(frame));
    } catch {
      this.revoke(active.socket, "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
  }

  private acceptHello(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    if (this.active || this.pending || this.pairingSecret === null || frame.epoch !== 0 || frame.sequence !== 0) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const body = frame.body;
    const extensionId = stringField(body, "extensionId");
    const extensionVersion = stringField(body, "extensionVersion");
    const releaseBuildId = typeof body.releaseBuildId === "string" ? body.releaseBuildId : "";
    if (!/^build-[a-f0-9-]{36}$/u.test(releaseBuildId)) {
      throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    }
    const clientEcdhPublicKey = stringField(body, "clientEcdhPublicKey");
    const clientSigningPublicJwk = authorityRecord(body.clientSigningPublicJwk);
    if (!clientSigningPublicJwk) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const state = createBrowserAuthorityHandshake(this.pairingSecret, {
      extensionId,
      extensionVersion,
      releaseBuildId,
      clientEcdhPublicKey,
      clientSigningPublicJwk: clientSigningPublicJwk as Readonly<Record<string, string>>,
      deadline: frame.deadline,
    });
    this.pending = { socket, state, frameCount: 1 };
    this.options.onPairingStarted();
    socket.send(encodeBrowserAuthorityFrame({
      protocolVersion: BROWSER_PROTOCOL_REVISION,
      kind: "PAIR_CHALLENGE",
      epoch: 0,
      sequence: 0,
      deadline: frame.deadline,
      body: state.challenge,
    }));
  }

  private acceptProof(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    const pending = this.pending;
    if (!pending || pending.socket !== socket || pending.frameCount >= MAX_PREAUTH_FRAMES || frame.epoch !== 0 || frame.sequence !== 1) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const verified = verifyBrowserAuthorityChallenge(pending.state, {
      clientSignature: stringField(frame.body, "clientSignature"),
      clientPairingMac: stringField(frame.body, "clientPairingMac"),
    });
    const ready = this.options.onAuthenticated({
      extensionId: verified.extensionId,
      extensionVersion: verified.extensionVersion,
      releaseBuildId: verified.releaseBuildId,
      sessionHash: verified.sessionHash,
      commandPermitKey: verified.directionalKeys.commandPermit.toString("base64"),
    });
    this.pairingSecret = null;
    this.pending = null;
    this.active = {
      socket,
      keys: verified.directionalKeys,
      lastClientSequence: 1,
      nextServerSequence: 1,
      lastHeartbeatAt: Date.now(),
      replies: new Map(),
    };
    socket.send(encodeBrowserAuthorityFrame({
      protocolVersion: BROWSER_PROTOCOL_REVISION,
      kind: "AUTHENTICATED",
      epoch: AUTH_EPOCH,
      sequence: 0,
      deadline: new Date(Date.now() + COMMAND_DEADLINE_MS).toISOString(),
      body: { sessionHash: verified.sessionHash, serverFinalSignature: verified.serverFinalSignature },
    }));
    const readyFrame = this.encryptedFrame(this.active, "READY", 1, new Date(Date.now() + COMMAND_DEADLINE_MS).toISOString(), ready);
    this.active = { ...this.active, nextServerSequence: 2 };
    socket.send(encodeBrowserAuthorityFrame(readyFrame));
  }

  private receiveAuthenticated(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {
    const active = this.active;
    if (!active || active.socket !== socket || frame.epoch !== AUTH_EPOCH || frame.sequence <= active.lastClientSequence || frame.kind === "PAIR_CHALLENGE" || frame.kind === "AUTHENTICATED") {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const plaintext = decryptBrowserAuthorityFrame({
      key: active.keys.clientToServer,
      direction: "client-to-server",
      epoch: frame.epoch,
      sequence: frame.sequence,
      aad: aadForFrame(frame),
      encrypted: encryptedFrameBody(frame),
    });
    const body = parseCanonicalPlaintext(plaintext);
    this.active = { ...active, lastClientSequence: frame.sequence, lastHeartbeatAt: Date.now() };
    if (this.acceptAuthenticatedControl(socket, frame, body)) return;
    this.acceptReply(body);
  }

  private acceptAuthenticatedControl(
    socket: BrowserAuthoritySocket,
    frame: BrowserAuthorityFrame,
    body: Record<string, unknown>,
  ): boolean {
    if (frame.kind === "HEARTBEAT") {
      if (Object.keys(body).length !== 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      this.options.onHeartbeat();
      return true;
    }
    if (frame.kind === "TARGET_CLAIM") {
      const claim = parseBrowserAuthorityTargetClaim(body);
      this.options.onTargetClaim(claim);
      this.sendTargetClaimAcknowledgement(socket, claim);
      return true;
    }
    if (frame.kind === "TARGET_REVOKE") {
      this.options.onTargetRevoke(stringField(body, "targetRef"));
      return true;
    }
    if (frame.kind === "DIAGNOSTIC") {
      const diagnostic = parseBrowserAuthorityDiagnostic(body);
      this.options.onDiagnostic(diagnostic.reasonCode, diagnostic.refs);
      return true;
    }
    if (frame.kind === "REVOKE") {
      const diagnostic = parseBrowserAuthorityDiagnostic(body);
      this.clearActive(diagnostic.reasonCode, diagnostic.refs);
      try { socket.close(1008); } catch { this.options.onDiagnostic("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { failedOperation: "socket-close" }); }
      return true;
    }
    if (frame.kind !== "REPLY") throw new Error("BROWSER_CAPABILITY_REJECTED");
    return false;
  }

  private acceptReply(body: Record<string, unknown>): void {
    const active = this.active;
    const requestSequence = integerField(body, "requestSequence");
    const permitSequence = integerField(body, "permitSequence");
    const replyChannelToken = stringField(body, "replyChannelToken");
    const reply = active?.replies.get(requestSequence);
    if (!active || !reply
      || permitSequence !== reply.permitSequence
      || !compareReplyToken(replyChannelToken, reply.replyChannelToken)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const replyKeys = Object.keys(body);
    if (typeof body.errorCode === "string") {
      if (replyKeys.length !== 4 || Object.hasOwn(body, "result")
        || !/^BROWSER_[A-Z0-9_]+$/u.test(body.errorCode)) {
        throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      }
      this.removeReply(requestSequence);
      reply.reject(new BrowserCommandTerminalReplyError(
        body.errorCode,
        replyChannelToken,
        requestSequence,
        permitSequence,
      ));
      return;
    }
    if (replyKeys.length !== 4 || !Object.hasOwn(body, "result")) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.removeReply(requestSequence);
    reply.resolve({
      replyChannelToken,
      transportSequence: requestSequence,
      permitSequence,
      result: body.result,
    });
  }

  private encryptedFrame(
    active: ActiveSocket,
    kind: Extract<BrowserAuthorityFrame["kind"], "COMMAND" | "READY" | "TARGET_ACQUIRE" | "TARGET_CLAIM" | "REVOKE">,
    sequence: number,
    deadline: string,
    body: Record<string, unknown>,
  ): BrowserAuthorityFrame {
    const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: AUTH_EPOCH, sequence, deadline };
    return {
      ...header,
      body: {
        encrypted: encryptBrowserAuthorityFrame({
          key: active.keys.serverToClient,
          direction: "server-to-client",
          epoch: AUTH_EPOCH,
          sequence,
          aad: aadForFrame(header),
          plaintext: canonicalBrowserAuthorityPlaintext(body),
        }),
      },
    };
  }

  private sendTargetClaimAcknowledgement(
    socket: BrowserAuthoritySocket,
    claim: BrowserAuthorityTargetClaim,
  ): void {
    const active = this.active;
    if (!active || active.socket !== socket) throw new Error("BROWSER_LIVENESS_EXPIRED");
    const sequence = active.nextServerSequence;
    const frame = this.encryptedFrame(
      active,
      "TARGET_CLAIM",
      sequence,
      new Date(Date.now() + COMMAND_DEADLINE_MS).toISOString(),
      { targetRef: claim.targetRef, documentRef: claim.documentRef },
    );
    this.active = { ...active, nextServerSequence: sequence + 1 };
    socket.send(encodeBrowserAuthorityFrame(frame));
  }

  private removeReply(sequence: number): void {
    const active = this.active;
    const reply = active?.replies.get(sequence);
    if (!active || !reply) return;
    clearTimeout(reply.timeout);
    const replies = new Map(active.replies);
    replies.delete(sequence);
    this.active = { ...active, replies };
  }

  private clearActive(reasonCode: string, refs?: Readonly<Record<string, string>>): void {
    const active = this.active;
    this.active = null;
    if (active) {
      for (const reply of active.replies.values()) {
        clearTimeout(reply.timeout);
        reply.reject(new Error(reasonCode));
      }
    }
    this.pairingSecret = this.createPairingSecret();
    this.options.onRevoked(reasonCode, refs);
  }

  private revoke(socket: BrowserAuthoritySocket, reasonCode: string): void {
    if (this.pending?.socket === socket) this.pending = null;
    if (this.active?.socket === socket) this.clearActive(reasonCode);
    else this.options.onRevoked(reasonCode);
    try { socket.close(1008); } catch { this.options.onDiagnostic("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", { failedOperation: "socket-close" }); }
  }

  private createPairingSecret(): string {
    return randomBytes(32).toString("hex");
  }
}

const stringField = (body: Readonly<Record<string, unknown>>, name: string): string => {
  const value = body[name];
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

const integerField = (body: Readonly<Record<string, unknown>>, name: string): number => {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

const nonNegativeIntegerField = (body: Readonly<Record<string, unknown>>, name: string): number => {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value;
};

export const parseBrowserAuthorityTargetClaim = (body: Readonly<Record<string, unknown>>): BrowserAuthorityTargetClaim => {
  const targetRef = stringField(body, "targetRef");
  const documentRef = stringField(body, "documentRef");
  const navigationEpoch = nonNegativeIntegerField(body, "navigationEpoch");
  const claimOrigin = stringField(body, "claimOrigin");
  if (Object.keys(body).length !== 4
    || Object.keys(body).some((key) => !["targetRef", "documentRef", "navigationEpoch", "claimOrigin"].includes(key))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { targetRef, documentRef, navigationEpoch, claimOrigin: requireGptWebClaimOrigin(claimOrigin) };
};
