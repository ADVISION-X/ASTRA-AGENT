import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { admitExtensionCommand } from "./command-registry.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { readExtensionChromeApi, type ExtensionChromeApi } from "./extension-runtime-types.js";
import { ExtensionTargetAuthority } from "./extension-target-authority.js";
import { ExtensionHeartbeat } from "./extension-heartbeat.js";
import { PairingCompletionGate } from "./pairing-completion-gate.js";
import {
  BROWSER_COMMAND_DEFAULT_DEADLINE_MS,
  BROWSER_PROTOCOL_REVISION,
} from "../protocol/generated/browser-protocol.generated.js";
import {
  asRecord,
  base64Url,
  browserCommandErrorCode as errorCode,
  cryptoBytes,
  decrypt,
  deriveKeys,
  encodeText,
  encrypt,
  equal,
  fromBase64Url,
  hexSecret,
  hmac,
  pairingErrorCode,
  publicSigningJwk,
  signaturePayload,
  type JsonWebKeyRecord,
} from "./websocket-actor-crypto.js";

declare const __GRASSEYE_RELEASE_BUILD_ID__: string;

const SOCKET_URL = "ws://127.0.0.1:4173/browser-authority/v1";
const AUTH_EPOCH = 1;

type SocketState = "IDLE" | "CONNECTING" | "PAIRING" | "CONNECTED" | "CLOSED";
type PendingPairing = Readonly<{
  hello: Readonly<{ extensionId: string; extensionVersion: string; releaseBuildId: string; clientSigningPublicJwk: JsonWebKeyRecord; clientEcdhPublicKey: string; deadline: string }>;
  signing: CryptoKeyPair;
  ecdh: CryptoKeyPair;
  pairingSecret: string;
}>;
type AuthenticatedSession = Readonly<{
  clientToServerKey: CryptoKey;
  serverToClientKey: CryptoKey;
  serverSigningPublicKey: CryptoKey;
  transcript: string;
  nextClientSequence: number;
}>;
type TargetClaimCompletion = Readonly<{
  targetRef: string;
  documentRef: string;
  resolve(): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
}>;

class TargetClaimAwaiter {
  private completion: TargetClaimCompletion | null = null;

  public begin(input: {
    targetRef: string;
    documentRef: string;
    send(): Promise<void>;
  }): Promise<void> {
    if (this.completion) throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    return new Promise<void>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
      }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
      this.completion = { ...input, resolve, reject, timeout };
      void input.send().catch((error: unknown) => this.fail(errorCode(error)));
    });
  }

  public accept(body: Record<string, unknown>): void {
    const completion = this.completion;
    if (!completion || body.targetRef !== completion.targetRef || body.documentRef !== completion.documentRef) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.completion = null;
    globalThis.clearTimeout(completion.timeout);
    completion.resolve();
  }

  public fail(reasonCode: string): void {
    const completion = this.completion;
    if (!completion) return;
    this.completion = null;
    globalThis.clearTimeout(completion.timeout);
    completion.reject(new Error(reasonCode));
  }
}

const commandFrom = (value: unknown): BrowserGovernedCommand => {
  const command = asRecord(value);
  if (!command || typeof command.kind !== "string") throw new Error("BROWSER_CAPABILITY_REJECTED");
  if (![
    "navigate", "dom-intent", "observe", "screenshot", "file-input", "wait", "close-target",
  ].includes(command.kind)) throw new Error("BROWSER_CAPABILITY_REJECTED");
  return command as BrowserGovernedCommand;
};

const extensionFrameDiagnostic = (error: unknown, frame: BrowserAuthorityFrame | null, data: unknown): Record<string, unknown> => ({
  reasonCode: pairingErrorCode(error),
  failedFrameKind: frame?.kind ?? "UNDECODED",
  failedFrameSequence: frame?.sequence ?? 0,
  diagnosticSource: "extension-frame",
  runtimeEventType: "message-handler",
  errorName: error instanceof Error ? error.name : "UnknownError",
  encodedByteLength: typeof data === "string" ? encodeText(data).byteLength : 0,
});

const extensionRuntimeDiagnostic = (
  error: unknown,
  runtimeEventType: "unhandledrejection" | "worker-error" | "liveness-pulse",
  failedFrameSequence: number,
): Record<string, unknown> => ({
  reasonCode: errorCode(error),
  failedFrameKind: "EXTENSION_RUNTIME",
  failedFrameSequence,
  diagnosticSource: "extension-runtime",
  runtimeEventType,
  errorName: error instanceof Error && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(error.name) ? error.name : "UnknownError",
  encodedByteLength: 0,
});

/** The extension actor is the sole socket owner; every authentication discontinuity requires a new operator pairing. */
export class ExtensionWebSocketActor {
  private socket: WebSocket | null = null;
  private state: SocketState = "IDLE";
  private pairingSecret: string | null = null;
  private pending: PendingPairing | null = null;
  private session: AuthenticatedSession | null = null;
  private commandReady = false;
  private readonly pairingCompletion = new PairingCompletionGate();
  private readonly targetClaims = new TargetClaimAwaiter();
  private readonly targetAuthority: ExtensionTargetAuthority;
  private readonly heartbeat: ExtensionHeartbeat;

  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.targetAuthority = new ExtensionTargetAuthority(
      chromeApi,
      (kind, body) => this.sendTargetFrame(kind, body),
      (input) => this.reportDebuggerDetach(input),
    );
    this.heartbeat = new ExtensionHeartbeat(
      chromeApi,
      (socket) => this.sendEncrypted(socket, "HEARTBEAT", {}),
      (error) => this.reportRuntimeFailure(error, "liveness-pulse"),
    );
  }

  public start(): void {
    globalThis.addEventListener("unhandledrejection", (event) => {
      event.preventDefault();
      this.reportRuntimeFailure(event.reason, "unhandledrejection");
    });
    globalThis.addEventListener("error", (event) => {
      event.preventDefault();
      this.reportRuntimeFailure(event.error, "worker-error");
    });
    this.chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== this.chromeApi.runtime.id) return false;
      const request = asRecord(message);
      if (request?.kind === "GRASSEYE_PAIRING_SECRET" && typeof request.pairingSecret === "string") {
        void this.pair(request.pairingSecret).then(
          () => sendResponse({ ok: true }),
          (error: unknown) => sendResponse({ ok: false, errorCode: errorCode(error) }),
        );
        return true;
      }
      if (request?.kind === "GRASSEYE_BROWSER_STATUS") {
        sendResponse({ ok: true, authenticated: this.state === "CONNECTED" && this.commandReady });
        return false;
      }
      if (request?.kind === "GRASSEYE_CLAIM_ACTIVE_TARGET") {
        if (!this.commandReady || this.state !== "CONNECTED") {
          sendResponse({ ok: false, errorCode: "BROWSER_LIVENESS_EXPIRED" });
          return false;
        }
        void this.targetAuthority.claimActiveTarget().then(
          () => sendResponse({ ok: true }),
          (error: unknown) => sendResponse({ ok: false, errorCode: errorCode(error) }),
        );
        return true;
      }
      return false;
    });
    this.targetAuthority.start();
  }

  public setOneTimePairingSecret(pairingSecret: string): void {
    hexSecret(pairingSecret);
    this.pairingSecret = pairingSecret;
    this.connectForPairing();
  }

  public pair(pairingSecret: string): Promise<void> {
    if (this.pairingCompletion.isActive() || this.state === "CONNECTING" || this.state === "PAIRING") {
      throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    }
    if (this.state === "CONNECTED" && this.commandReady) {
      return Promise.resolve();
    }
    hexSecret(pairingSecret);
    const completion = this.pairingCompletion.begin(BROWSER_COMMAND_DEFAULT_DEADLINE_MS, () => {
      this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
      this.clearPairing("BROWSER_PAIRING_TIMEOUT");
    });
    this.setOneTimePairingSecret(pairingSecret);
    return completion;
  }

  public clearPairing(closeReason = "BROWSER_PAIRING_CLEARED"): void {
    this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    this.pairingSecret = null;
    this.pending = null;
    this.session = null;
    this.commandReady = false;
    clearExtensionPermitAuthority();
    void this.targetAuthority.releaseActiveTarget();
    this.close(closeReason);
  }

  private connectForPairing(): void {
    if (this.state === "CONNECTING" || this.state === "PAIRING" || this.state === "CONNECTED" || this.pairingSecret === null) return;
    this.state = "CONNECTING";
    const socket = new WebSocket(SOCKET_URL);
    this.socket = socket;
    socket.addEventListener("open", () => { void this.beginPairing(socket); });
    socket.addEventListener("close", () => { void this.onSocketClosed(socket); });
    socket.addEventListener("error", () => {
      this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      this.close("BROWSER_EXTENSION_SOCKET_ERROR");
    });
    socket.addEventListener("message", (event) => { void this.onMessage(socket, event.data); });
  }

  private async beginPairing(socket: WebSocket): Promise<void> {
    try {
      const pairingSecret = this.pairingSecret;
      if (socket !== this.socket || pairingSecret === null) return;
      const signing = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const ecdh = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const hello = {
        extensionId: this.chromeApi.runtime.id,
        extensionVersion: this.chromeApi.runtime.getManifest().version,
        releaseBuildId: __GRASSEYE_RELEASE_BUILD_ID__,
        clientSigningPublicJwk: publicSigningJwk(await globalThis.crypto.subtle.exportKey("jwk", signing.publicKey)),
        clientEcdhPublicKey: base64Url(new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", ecdh.publicKey))),
        deadline: new Date(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS).toISOString(),
      };
      this.pending = { hello, signing, ecdh, pairingSecret };
      this.state = "PAIRING";
      socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO", epoch: 0, sequence: 0, deadline: hello.deadline, body: hello }));
    } catch (error) {
      this.pairingCompletion.fail(pairingErrorCode(error));
      this.clearPairing("BROWSER_PAIRING_START_FAILED");
    }
  }

  private async onMessage(socket: WebSocket, data: unknown): Promise<void> {
    if (socket !== this.socket || typeof data !== "string") return this.close("BROWSER_NON_TEXT_FRAME");
    let frame: BrowserAuthorityFrame | null = null;
    try {
      frame = decodeBrowserAuthorityFrame(data);
      if (frame.kind === "PAIR_CHALLENGE") { await this.answerChallenge(socket, frame); return; }
      if (frame.kind === "AUTHENTICATED") { await this.acceptAuthenticated(socket, frame); return; }
      if (frame.kind === "READY") { await this.acceptReady(socket, frame); return; }
      if (frame.kind === "TARGET_CLAIM") {
        await acceptTargetClaimAcknowledgement({
          session: this.session,
          claims: this.targetClaims,
          frame,
        });
        return;
      }
      if (frame.kind === "REVOKE") return this.clearPairing("BROWSER_SERVER_REVOKE");
      if (frame.kind === "COMMAND") { await this.executeCommand(socket, frame); return; }
      this.close("BROWSER_UNEXPECTED_FRAME_KIND");
    } catch (error) {
      const reasonCode = pairingErrorCode(error);
      const diagnostic = extensionFrameDiagnostic(error, frame, data);
      if (this.state === "CONNECTED" && this.session) {
        try { await this.sendEncrypted(socket, "REVOKE", diagnostic); } catch { /* the authenticated channel is already failing */ }
      }
      this.pairingCompletion.fail(reasonCode);
      this.clearPairing(reasonCode);
    }
  }

  private async answerChallenge(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const pending = this.pending;
    if (!pending || frame.epoch !== 0 || frame.sequence !== 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const serverSigningPublicJwk = asRecord(frame.body.serverSigningPublicJwk);
    const serverEcdhPublicKey = typeof frame.body.serverEcdhPublicKey === "string" ? frame.body.serverEcdhPublicKey : null;
    const challenge = typeof frame.body.challenge === "string" ? frame.body.challenge : null;
    const serverSignature = typeof frame.body.serverSignature === "string" ? frame.body.serverSignature : null;
    const serverPairingMac = typeof frame.body.serverPairingMac === "string" ? frame.body.serverPairingMac : null;
    if (!serverSigningPublicJwk || !serverEcdhPublicKey || !challenge || !serverSignature || !serverPairingMac) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const transcript = canonicalizeBrowserAuthorityValue({ hello: pending.hello, challenge: { serverSigningPublicJwk, serverEcdhPublicKey, challenge } });
    const serverKey = await globalThis.crypto.subtle.importKey("jwk", serverSigningPublicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const expectedMac = fromBase64Url(await hmac(pending.pairingSecret, "server", transcript));
    const actualMac = fromBase64Url(serverPairingMac);
    const verified = await globalThis.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, serverKey, cryptoBytes(fromBase64Url(serverSignature)), cryptoBytes(signaturePayload("server", transcript)));
    if (!verified || !equal(expectedMac, actualMac)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const clientSignature = base64Url(new Uint8Array(await globalThis.crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pending.signing.privateKey, cryptoBytes(signaturePayload("client", transcript)))));
    const clientPairingMac = await hmac(pending.pairingSecret, "client", transcript);
    const serverEcdh = await globalThis.crypto.subtle.importKey("raw", cryptoBytes(fromBase64Url(serverEcdhPublicKey)), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const sharedSecret = new Uint8Array(await globalThis.crypto.subtle.deriveBits({ name: "ECDH", public: serverEcdh }, pending.ecdh.privateKey, 256));
    const keys = await deriveKeys(sharedSecret, pending.pairingSecret, transcript);
    this.session = { ...keys, serverSigningPublicKey: serverKey, transcript, nextClientSequence: 2 };
    socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_PROOF", epoch: 0, sequence: 1, deadline: pending.hello.deadline, body: { clientSignature, clientPairingMac } }));
  }

  private async acceptAuthenticated(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.session;
    if (!session || frame.epoch !== AUTH_EPOCH || frame.sequence !== 0 || typeof frame.body.serverFinalSignature !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const verified = await globalThis.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, session.serverSigningPublicKey, cryptoBytes(fromBase64Url(frame.body.serverFinalSignature)), cryptoBytes(encodeText(`authenticated:${session.transcript}`)));
    if (!verified) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    this.pending = null;
    this.pairingSecret = null;
    this.state = "CONNECTED";
    this.commandReady = false;
    this.heartbeat.startHeartbeat(socket);
  }

  private async acceptReady(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.session;
    if (!session || socket !== this.socket || frame.epoch !== AUTH_EPOCH || frame.sequence !== 1) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const ready = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (typeof ready.authorityRef !== "string"
      || typeof ready.authorityEpoch !== "number"
      || typeof ready.certificateHash !== "string"
      || typeof ready.channelSessionHash !== "string"
      || typeof ready.commandPermitKey !== "string") {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    setExtensionPermitAuthority({
      authorityRef: ready.authorityRef,
      authorityEpoch: ready.authorityEpoch,
      certificateHash: ready.certificateHash as `sha256:${string}`,
      channelSessionHash: ready.channelSessionHash as `sha256:${string}`,
      commandPermitKey: ready.commandPermitKey,
    });
    this.commandReady = true;
    this.pairingCompletion.complete();
  }

  private async executeCommand(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.session;
    if (!session || !this.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const payload = await decrypt(session.serverToClientKey, "server-to-client", frame);
    const permit = asRecord(payload.permit) as BrowserCommandPermit | null;
    const requestSequence = frame.sequence;
    const permitSequence = permit && typeof permit.sequence === "number" ? permit.sequence : 0;
    const replyChannelToken = permit && typeof permit.replyChannelToken === "string" ? permit.replyChannelToken : "invalid";
    try {
      if (!permit) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
      const command = commandFrom(payload.command);
      await admitExtensionCommand({ command, permit });
      const target = this.targetAuthority.resolve(permit.targetRef, permit.documentRef);
      const result = await this.targetAuthority.executeRegisteredCommand(command, target);
      await this.sendEncrypted(socket, "REPLY", { requestSequence, permitSequence, replyChannelToken, result });
    } catch (error) {
      await this.sendEncrypted(socket, "REPLY", { requestSequence, permitSequence, replyChannelToken, errorCode: errorCode(error) });
    }
  }

  private async sendTargetFrame(kind: "TARGET_CLAIM" | "TARGET_REVOKE", body: Record<string, unknown>): Promise<void> {
    if (kind === "TARGET_REVOKE") return this.sendEncrypted(this.socket, kind, body);
    const targetRef = typeof body.targetRef === "string" ? body.targetRef : null;
    const documentRef = typeof body.documentRef === "string" ? body.documentRef : null;
    if (!targetRef || !documentRef) throw new Error("BROWSER_TARGET_INVALID");
    return this.targetClaims.begin({
      targetRef,
      documentRef,
      send: () => this.sendEncrypted(this.socket, kind, body),
    });
  }

  private async sendEncrypted(socket: WebSocket | null, kind: "HEARTBEAT" | "REPLY" | "TARGET_CLAIM" | "TARGET_REVOKE" | "DIAGNOSTIC" | "REVOKE", body: Record<string, unknown>): Promise<void> {
    const session = this.session;
    if (!socket || socket !== this.socket || socket.readyState !== WebSocket.OPEN || !session || this.state !== "CONNECTED") return;
    const sequence = session.nextClientSequence;
    this.session = { ...session, nextClientSequence: sequence + 1 };
    const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: AUTH_EPOCH, sequence, deadline: new Date(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS).toISOString() };
    const encrypted = await encrypt(session.clientToServerKey, "client-to-server", header, body);
    if (socket !== this.socket || this.session?.clientToServerKey !== session.clientToServerKey) return;
    socket.send(encodeBrowserAuthorityFrame({ ...header, body: { encrypted } }));
  }

  private async onSocketClosed(socket: WebSocket): Promise<void> {
    if (socket !== this.socket) return;
    this.socket = null;
    this.state = "CLOSED";
    this.pending = null;
    this.session = null;
    this.commandReady = false;
    this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    this.targetClaims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    try { await this.targetAuthority.releaseActiveTarget(false); } catch { /* channel is already absent; local target state is already cleared */ }
  }

  private close(reasonCode: string): void {
    const socket = this.socket;
    this.socket = null;
    this.state = "CLOSED";
    this.session = null;
    this.commandReady = false;
    this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    this.targetClaims.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    socket?.close(4000, reasonCode);
  }

  private reportRuntimeFailure(error: unknown, runtimeEventType: "unhandledrejection" | "worker-error" | "liveness-pulse"): void {
    const body = extensionRuntimeDiagnostic(error, runtimeEventType, this.session?.nextClientSequence ?? 0);
    void (async () => {
      if (this.state !== "CONNECTED" || !this.session) return;
      try { await this.sendEncrypted(this.socket, "DIAGNOSTIC", body); } catch { /* a diagnostic must never create another unhandled failure */ }
    })();
  }

  private reportDebuggerDetach(input: Readonly<{ targetRef: string; reason: string }>): void {
    const body = {
      reasonCode: "BROWSER_TARGET_INVALID",
      failedFrameKind: "EXTENSION_RUNTIME",
      failedFrameSequence: this.session?.nextClientSequence ?? 0,
      diagnosticSource: "extension-runtime",
      runtimeEventType: "debugger-detach",
      errorName: /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(input.reason) ? input.reason : "UnknownDetachReason",
      targetRef: input.targetRef,
      encodedByteLength: 0,
    };
    void (async () => {
      if (this.state !== "CONNECTED" || !this.session) return;
      try { await this.sendEncrypted(this.socket, "DIAGNOSTIC", body); } catch { /* diagnostic failure cannot create another failure */ }
    })();
  }

}

const acceptTargetClaimAcknowledgement = async (input: {
  session: AuthenticatedSession | null;
  claims: TargetClaimAwaiter;
  frame: BrowserAuthorityFrame;
}): Promise<void> => {
  if (!input.session || input.frame.epoch !== AUTH_EPOCH) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const body = await decrypt(input.session.serverToClientKey, "server-to-client", input.frame);
  input.claims.accept(body);
};

const chrome = readExtensionChromeApi();
if (chrome) {
  const actor = new ExtensionWebSocketActor(chrome);
  actor.start();
}
