import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { admitExtensionCommand } from "./command-registry.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { readExtensionChromeApi, type ExtensionChromeApi } from "./extension-runtime-types.js";
import { ExtensionTargetAuthority } from "./extension-target-authority.js";
import { ExtensionHeartbeat } from "./extension-heartbeat.js";
import { PairingCompletionGate } from "./pairing-completion-gate.js";
import { PairingAutoBootstrap } from "./pairing-auto-bootstrap.js";
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
import {
  extensionCommandDiagnostic,
  type ExtensionCommandStage,
} from "./websocket-command-diagnostic.js";
import { extensionFrameDiagnostic, extensionRuntimeDiagnostic } from "./websocket-actor-diagnostics.js";
import { acceptTargetClaimAcknowledgement, TargetClaimAwaiter } from "./websocket-target-claim-awaiter.js";

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
const commandFrom = (value: unknown): BrowserGovernedCommand => {
  const command = asRecord(value);
  if (!command || typeof command.kind !== "string") throw new Error("BROWSER_CAPABILITY_REJECTED");
  if (![
    "dom-intent", "observe", "screenshot", "file-input", "authenticated-media", "wait", "park-target",
  ].includes(command.kind)) throw new Error("BROWSER_CAPABILITY_REJECTED");
  return command as BrowserGovernedCommand;
};

const canAttemptAutomaticPairing = (state: SocketState): boolean =>
  state !== "CONNECTING" && state !== "PAIRING" && state !== "CONNECTED";

/** The extension actor is the sole socket owner; every authentication discontinuity requires a fresh automatic pairing. */
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
  private readonly autoBootstrap: PairingAutoBootstrap;

  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.targetAuthority = new ExtensionTargetAuthority(
      chromeApi,
      (kind, body) => this.sendTargetFrame(kind, body),
      (input) => this.reportTargetFailure(input),
    );
    this.heartbeat = new ExtensionHeartbeat(
      chromeApi,
      (socket) => this.sendEncrypted(socket, "HEARTBEAT", {}),
      (error) => this.reportRuntimeFailure(error, "liveness-pulse"),
    );
    this.autoBootstrap = new PairingAutoBootstrap(chromeApi, {
      canAttemptAutomaticPairing: () => canAttemptAutomaticPairing(this.state),
      pair: (pairingSecret) => this.pair(pairingSecret),
    }, __GRASSEYE_RELEASE_BUILD_ID__);
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
      if (request?.kind === "GRASSEYE_AUTOMATIC_PAIRING_SECRET" && typeof request.pairingSecret === "string") {
        void this.pair(request.pairingSecret).then(
          () => sendResponse({ ok: true }),
          (error: unknown) => sendResponse({ ok: false, errorCode: errorCode(error) }),
        );
        return true;
      }
      if (request?.kind === "GRASSEYE_BROWSER_STATUS") {
        sendResponse({
          ok: true,
          authenticated: this.state === "CONNECTED" && this.commandReady,
          automaticPairingErrorCode: this.autoBootstrap.currentFailureCode(),
        });
        return false;
      }
      return false;
    });
    this.targetAuthority.start();
    this.autoBootstrap.start();
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
      if (frame.kind === "TARGET_ACQUIRE") { await this.acceptTargetAcquire(socket, frame); return; }
      if (frame.kind === "TARGET_CLAIM") {
        await acceptTargetClaimAcknowledgement({
          serverToClientKey: this.session?.serverToClientKey ?? null,
          claims: this.targetClaims,
          frame,
          expectedEpoch: AUTH_EPOCH,
        });
        return;
      }
      if (frame.kind === "REVOKE") return this.clearPairing("BROWSER_SERVER_REVOKE");
      if (frame.kind === "COMMAND") { await this.executeCommand(socket, frame); return; }
      this.close("BROWSER_UNEXPECTED_FRAME_KIND");
    } catch (error) {
      let reasonCode = pairingErrorCode(error);
      const diagnostic = extensionFrameDiagnostic(error, frame, data);
      if (this.state === "CONNECTED" && this.session) {
        try { await this.sendEncrypted(socket, "REVOKE", diagnostic); }
        catch (sendError) { reasonCode = errorCode(sendError); }
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

  private async acceptTargetAcquire(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.session;
    if (!session || socket !== this.socket || !this.commandReady || frame.epoch !== AUTH_EPOCH) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const request = await decrypt(session.serverToClientKey, "server-to-client", frame);
    const action = request.action;
    const jobRefHash = typeof request.jobRefHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(request.jobRefHash)
      ? request.jobRefHash as `sha256:${string}`
      : (() => { throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID"); })();
    if (action === "release") {
      if (Object.keys(request).length !== 2
        || Object.keys(request).some((key) => !["action", "jobRefHash"].includes(key))) {
        throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      }
      try { await this.targetAuthority.releaseJobBoundChatGptTarget(jobRefHash); }
      catch (error) { this.reportRuntimeFailure(error, "job-bound-target-acquisition"); }
      return;
    }
    if (action !== "acquire") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const targetMode = request.targetMode === "fresh" || request.targetMode === "bound-observation"
      || request.targetMode === "confirmed-readback"
      ? request.targetMode
      : (() => { throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID"); })();
    if (Object.keys(request).length !== 3
      || Object.keys(request).some((key) => !["action", "targetMode", "jobRefHash"].includes(key))) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    try {
      await this.targetAuthority.acquireJobBoundChatGptTarget(targetMode, jobRefHash);
    } catch (error) {
      this.reportRuntimeFailure(error, "job-bound-target-acquisition");
    }
  }

  private async executeCommand(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.session;
    if (!session || !this.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const payload = await decrypt(session.serverToClientKey, "server-to-client", frame);
    const permit = asRecord(payload.permit) as BrowserCommandPermit | null;
    const requestSequence = frame.sequence;
    const permitSequence = permit && typeof permit.sequence === "number" ? permit.sequence : 0;
    const replyChannelToken = permit && typeof permit.replyChannelToken === "string" ? permit.replyChannelToken : "invalid";
    let commandStage: ExtensionCommandStage = "payload";
    let command: BrowserGovernedCommand | null = null;
    try {
      if (!permit) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
      commandStage = "command-shape";
      command = commandFrom(payload.command);
      commandStage = "command-admission";
      const registeredCommand = await admitExtensionCommand({ command, permit });
      commandStage = "target-resolution";
      const target = this.targetAuthority.resolve(permit.targetRef, permit.documentRef);
      commandStage = "registered-command";
      const result = await this.targetAuthority.executeRegisteredCommand(
        command,
        target,
        registeredCommand.mutationClass,
      );
      await this.sendEncrypted(socket, "REPLY", { requestSequence, permitSequence, replyChannelToken, result });
    } catch (error) {
      let commandError = error;
      try {
        await this.targetAuthority.retireInvalidCommandTarget(
          error,
          command?.kind === "dom-intent" ? command.intent.kind : null,
        );
      } catch (cleanupError) {
        commandError = new Error(errorCode(error), { cause: cleanupError });
      }
      const commandErrorCode = errorCode(commandError);
      await this.sendEncrypted(socket, "DIAGNOSTIC", extensionCommandDiagnostic({
        error: commandError,
        failedFrameSequence: requestSequence,
        commandStage,
        commandKind: command?.kind ?? null,
        commandIntentKind: command?.kind === "dom-intent" ? command.intent.kind : null,
        capabilityId: permit && typeof permit.capabilityId === "string" ? permit.capabilityId : null,
      }));
      await this.sendEncrypted(socket, "REPLY", { requestSequence, permitSequence, replyChannelToken, errorCode: commandErrorCode });
    }
  }

  private async sendTargetFrame(kind: "TARGET_CLAIM" | "TARGET_REVOKE", body: Record<string, unknown>): Promise<void> {
    if (!this.socket || !this.session || this.state !== "CONNECTED" || !this.commandReady) {
      if (kind === "TARGET_REVOKE") return;
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    if (kind === "TARGET_REVOKE") return this.sendEncrypted(this.socket, kind, body);
    const targetRef = typeof body.targetRef === "string" ? body.targetRef : null;
    const documentRef = typeof body.documentRef === "string" ? body.documentRef : null;
    const jobRefHash = typeof body.jobRefHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(body.jobRefHash)
      ? body.jobRefHash as `sha256:${string}` : null;
    if (!targetRef || !documentRef || !jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
    return this.targetClaims.begin({
      targetRef,
      documentRef,
      jobRefHash,
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
    this.pairingSecret = null;
    this.pending = null;
    this.session = null;
    this.commandReady = false;
    this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    this.targetClaims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    try { await this.targetAuthority.releaseActiveTarget(false); }
    catch (error) { this.autoBootstrap.recordFailure(error); }
  }

  private close(reasonCode: string): void {
    const socket = this.socket;
    this.socket = null;
    this.state = "CLOSED";
    this.pairingSecret = null;
    this.pending = null;
    this.session = null;
    this.commandReady = false;
    this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    this.targetClaims.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    void this.targetAuthority.releaseActiveTarget(false).catch((error) => {
      this.autoBootstrap.recordFailure(error);
    });
    socket?.close(4000, reasonCode);
  }

  private reportRuntimeFailure(error: unknown, runtimeEventType: "unhandledrejection" | "worker-error" | "liveness-pulse" | "job-bound-target-acquisition"): void {
    const body = extensionRuntimeDiagnostic(error, runtimeEventType, this.session?.nextClientSequence ?? 0);
    void (async () => {
      if (this.state !== "CONNECTED" || !this.session) return;
      try { await this.sendEncrypted(this.socket, "DIAGNOSTIC", body); }
      catch (sendError) { this.close(errorCode(sendError)); }
    })();
  }

  private reportTargetFailure(input: Readonly<{
    targetRef: string;
    runtimeEventType: "debugger-detach" | "tab-remove";
    reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT";
    nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER";
  }>): Promise<void> {
    const body = {
      reasonCode: input.reasonCode,
      failedFrameKind: "EXTENSION_RUNTIME",
      failedFrameSequence: this.session?.nextClientSequence ?? 0,
      diagnosticSource: "extension-runtime",
      runtimeEventType: input.runtimeEventType,
      targetRef: input.targetRef,
      ...(input.nativeCauseCode ? { nativeCauseCode: input.nativeCauseCode } : {}),
      encodedByteLength: 0,
    };
    if (this.state !== "CONNECTED" || !this.session) return Promise.resolve();
    return this.sendEncrypted(this.socket, "DIAGNOSTIC", body)
      .catch((sendError) => { this.close(errorCode(sendError)); });
  }

}

const chrome = readExtensionChromeApi();
if (chrome) {
  const actor = new ExtensionWebSocketActor(chrome);
  actor.start();
}
