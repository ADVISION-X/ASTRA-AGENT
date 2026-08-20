import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";

import type { BrowserCommandPort, BrowserCommandReply, BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "./command-permit.js";
import { decodeBrowserControlFrame, encodeBrowserControlFrame } from "./browser-native-framing.js";
import type { BrowserAuthenticationProof } from "../infrastructure/browser-authority-issuer.js";

export type BrowserExtensionAuthorityContext = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: `sha256:${string}`;
  activationTupleHash: `sha256:${string}`;
  executionBindingHash: `sha256:${string}`;
  commandPermitKey: string;
}>;

type ControllerHelloFrame = Readonly<{
  kind: "extension-hello";
  controllerToken: string;
  sourceChannelToken: string;
  proof: BrowserAuthenticationProof;
}>;

type ExtensionReplyFrame = Readonly<{
  kind: "extension-reply";
  sourceChannelToken: string;
  replyChannelToken: string;
  sequence: number;
  result?: unknown;
  errorCode?: string;
}>;

export type BrowserOperatorTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  title: string;
}>;

type OperatorTargetClaimFrame = Readonly<{
  kind: "operator-target-claimed";
  sourceChannelToken: string;
  claim: BrowserOperatorTargetClaim;
}>;

type ControllerReadyFrame = Readonly<{
  kind: "controller-ready";
  sourceChannelToken: string;
  authority: BrowserExtensionAuthorityContext;
}>;

type IncomingFrame = ControllerHelloFrame | ExtensionReplyFrame | OperatorTargetClaimFrame;

type PendingReply = Readonly<{
  sourceChannelToken: string;
  resolve(reply: BrowserCommandReply): void;
  reject(error: Error): void;
}>;

export type BrowserControllerHostCommandPortOptions = Readonly<{
  socketPath: string;
  controllerToken: string;
  authenticate(proof: BrowserAuthenticationProof, sourceChannelToken: string): Promise<void>;
  authorityContext(): BrowserExtensionAuthorityContext;
  onOperatorTargetClaim?(claim: BrowserOperatorTargetClaim): void;
  onDisconnect(reasonCode: string): void;
}>;

/**
 * The only Controller-side Native Host endpoint.  It is deliberately not a
 * Browser public API: business owners only receive a broker lease, while the
 * supervisor owns this server for its whole lifetime.
 */
export class BrowserControllerHostCommandPort implements BrowserCommandPort {
  private server: Server | null = null;
  private socket: Socket | null = null;
  private sourceChannelToken: string | null = null;
  private authenticated = false;
  private disconnectNotified = false;
  private pending = new Map<string, PendingReply>();
  private receiveBuffer = Buffer.alloc(0);

  public constructor(private readonly options: BrowserControllerHostCommandPortOptions) {}

  public async start(): Promise<void> {
    if (this.server) return;
    await mkdir(dirname(this.options.socketPath), { recursive: true, mode: 0o700 });
    const server = createServer((socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.options.socketPath, () => {
        server.off("error", reject);
        resolve();
      });
    });
    this.server = server;
  }

  public async send(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<BrowserCommandReply> {
    const socket = this.socket;
    const sourceChannelToken = this.sourceChannelToken;
    if (!socket || !this.authenticated || !sourceChannelToken || socket.destroyed) {
      throw new Error("BROWSER_HOST_UNAVAILABLE");
    }
    const key = replyKey(permit.replyChannelToken, permit.sequence);
    if (this.pending.has(key)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    return new Promise<BrowserCommandReply>((resolve, reject) => {
      this.pending.set(key, { sourceChannelToken, resolve, reject });
      this.write({ kind: "controller-command", sourceChannelToken, permit, command }).catch((error: unknown) => {
        this.pending.delete(key);
        reject(asBrowserError(error));
      });
    });
  }

  public async close(reasonCode: string): Promise<void> {
    this.invalidate(reasonCode);
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await unlink(this.options.socketPath).catch(() => undefined);
  }

  private accept(socket: Socket): void {
    if (this.socket) {
      socket.destroy();
      return;
    }
    this.disconnectNotified = false;
    this.socket = socket;
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.once("error", () => this.invalidate("BROWSER_HOST_UNAVAILABLE"));
    socket.once("close", () => this.invalidate("BROWSER_HOST_UNAVAILABLE"));
  }

  private onData(chunk: Buffer): void {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);
    while (this.receiveBuffer.byteLength >= 4) {
      const size = this.receiveBuffer.readUInt32LE(0);
      if (size > 262_144) {
        this.invalidate("BROWSER_BACKPRESSURE");
        return;
      }
      if (this.receiveBuffer.byteLength < size + 4) return;
      const frame = this.receiveBuffer.subarray(4, size + 4);
      this.receiveBuffer = this.receiveBuffer.subarray(size + 4);
      this.handleIncoming(decodeBrowserControlFrame(frame)).catch(() => this.invalidate("BROWSER_AUTH_TRANSCRIPT_INVALID"));
    }
  }

  private async handleIncoming(value: unknown): Promise<void> {
    const frame = parseIncomingFrame(value);
    if (frame.kind === "extension-hello") {
      if (this.authenticated || !matchesToken(frame.controllerToken, this.options.controllerToken) || !isOpaqueToken(frame.sourceChannelToken)) {
        throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      }
      await this.options.authenticate(frame.proof, frame.sourceChannelToken);
      this.authenticated = true;
      this.sourceChannelToken = frame.sourceChannelToken;
      const ready: ControllerReadyFrame = {
        kind: "controller-ready",
        sourceChannelToken: frame.sourceChannelToken,
        authority: this.options.authorityContext(),
      };
      await this.write(ready);
      return;
    }
    if (!this.authenticated || frame.sourceChannelToken !== this.sourceChannelToken) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    if (frame.kind === "operator-target-claimed") {
      this.options.onOperatorTargetClaim?.(frame.claim);
      return;
    }
    const key = replyKey(frame.replyChannelToken, frame.sequence);
    const pending = this.pending.get(key);
    if (!pending || pending.sourceChannelToken !== frame.sourceChannelToken) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.pending.delete(key);
    if (frame.errorCode) {
      pending.reject(new Error(frame.errorCode));
      return;
    }
    pending.resolve({ replyChannelToken: frame.replyChannelToken, sequence: frame.sequence, result: frame.result });
  }

  private async write(value: unknown): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.destroyed) throw new Error("BROWSER_HOST_UNAVAILABLE");
    const payload = encodeBrowserControlFrame(value);
    const frame = Buffer.allocUnsafe(payload.byteLength + 4);
    frame.writeUInt32LE(payload.byteLength, 0);
    Buffer.from(payload).copy(frame, 4);
    await new Promise<void>((resolve, reject) => socket.write(frame, (error?: Error | null) => error ? reject(error) : resolve()));
  }

  private invalidate(reasonCode: string): void {
    const socket = this.socket;
    this.socket = null;
    this.sourceChannelToken = null;
    this.authenticated = false;
    this.receiveBuffer = Buffer.alloc(0);
    socket?.destroy();
    for (const [, pending] of this.pending) pending.reject(new Error(reasonCode));
    this.pending.clear();
    if (!this.disconnectNotified) {
      this.disconnectNotified = true;
      this.options.onDisconnect(reasonCode);
    }
  }
}

export const createControllerToken = (): string => randomUUID();

export const hashControllerToken = (token: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(token).digest("hex")}`;

const replyKey = (token: string, sequence: number): string => `${token}:${sequence}`;
const isOpaqueToken = (value: string): boolean => value.length >= 16 && value.length <= 256;
const matchesToken = (candidate: string, expected: string): boolean => {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
};
const asBrowserError = (error: unknown): Error => error instanceof Error ? error : new Error("BROWSER_HOST_UNAVAILABLE");

const parseIncomingFrame = (value: unknown): IncomingFrame => {
  if (!isRecord(value) || typeof value.kind !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  if (value.kind === "extension-hello" && typeof value.controllerToken === "string" && typeof value.sourceChannelToken === "string" && isRecord(value.proof)) {
    return value as unknown as ControllerHelloFrame;
  }
  if (
    value.kind === "extension-reply"
    && typeof value.sourceChannelToken === "string"
    && typeof value.replyChannelToken === "string"
    && typeof value.sequence === "number"
    && (value.errorCode === undefined || typeof value.errorCode === "string")
  ) {
    return value as unknown as ExtensionReplyFrame;
  }
  if (
    value.kind === "operator-target-claimed"
    && typeof value.sourceChannelToken === "string"
    && isRecord(value.claim)
    && typeof value.claim.targetRef === "string"
    && typeof value.claim.documentRef === "string"
    && typeof value.claim.navigationEpoch === "number"
    && typeof value.claim.url === "string"
    && typeof value.claim.title === "string"
  ) {
    return value as OperatorTargetClaimFrame;
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
