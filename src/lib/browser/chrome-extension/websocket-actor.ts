import { decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import { browserMutationTerminalFactShapeValid, type BrowserMutationTerminalFact } from "../exact-target/browser-observation-receipt.js";
import { executeExtensionCommandReply, readExtensionCommandPayload } from "./extension-command-runtime.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { readExtensionChromeApi, type ExtensionChromeApi } from "./extension-runtime-types.js";
import { ExtensionTargetAuthority } from "./extension-target-authority.js";
import { ExtensionHeartbeat } from "./extension-heartbeat.js";
import { PairingCompletionGate } from "./pairing-completion-gate.js";
import { PairingAutoBootstrap } from "./pairing-auto-bootstrap.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS, BROWSER_PROTOCOL_REVISION } from "../protocol/generated/browser-protocol.generated.js";
import {
  asRecord,
  base64Url,
  browserCommandErrorCode as errorCode,
  decrypt,
  encrypt,
  hexSecret,
  hashBrowserExtensionText,
  pairingErrorCode,
  publicSigningJwk,
} from "./websocket-actor-crypto.js";
import { extensionFrameDiagnostic, extensionRuntimeDiagnostic } from "./websocket-actor-diagnostics.js";
import { acceptTargetClaimAcknowledgement, TargetClaimAwaiter } from "./websocket-target-claim-awaiter.js";
import { targetOperationFrom } from "./websocket-target-operation.js";
import { answerPairChallenge, readServerReadyPermit, verifyServerAuthenticated,
  type AuthenticatedSession, type PendingPairing } from "./websocket-pairing-proof.js";
declare const __GRASSEYE_RELEASE_BUILD_ID__: string;
const SOCKET_URL = "ws://127.0.0.1:4173/browser-authority/v1";
const AUTH_EPOCH = 1;
type SocketState = "IDLE" | "CONNECTING" | "PAIRING" | "CONNECTED" | "CLOSED";
const canAttemptAutomaticPairing = (state: SocketState): boolean =>
  state !== "CONNECTING" && state !== "PAIRING" && state !== "CONNECTED";
/** The extension actor is the sole socket owner; every authentication discontinuity requires a fresh automatic pairing. */
export class ExtensionWebSocketActor {
  private readonly connection = { socket: null as WebSocket | null, state: "IDLE" as SocketState, commandReady: false, lastServerSequence: 0, session: null as AuthenticatedSession | null, pairingSecret: null as string | null, pending: null as PendingPairing | null };
  private readonly pairingCompletion = new PairingCompletionGate();
  private readonly targetClaims = new TargetClaimAwaiter();
  private readonly targetAuthority: ExtensionTargetAuthority;
  private readonly heartbeat: ExtensionHeartbeat;
  private readonly autoBootstrap: PairingAutoBootstrap;
  private readonly commandDelivery = {
    pendingCommandHandlers: new Set<Promise<void>>(), pendingTargetHandlers: new Set<Promise<void>>(),
    commandAdmissionSuspended: false,
    mutationSlot: null as { jobId: string; commandId: string; receiptBindingHash: `sha256:${string}`; fact: BrowserMutationTerminalFact | null } | null,
    sendTail: Promise.resolve([] as PromiseSettledResult<void>[]), receiveTail: Promise.resolve() as Promise<void>,
    lastMutationDeliveryKey: null as CryptoKey | null, disconnectedDrain: null as Promise<void> | null,
  };
  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.targetAuthority = new ExtensionTargetAuthority(
      chromeApi,
      (kind, body) => this.sendTargetFrame(kind, body),
      (input) => this.reportTargetFailure(input),
      async () => {
        this.commandDelivery.commandAdmissionSuspended = true;
        const disconnectedDrain = this.commandDelivery.disconnectedDrain;
        await Promise.allSettled([
          ...this.commandDelivery.pendingCommandHandlers, ...this.commandDelivery.pendingTargetHandlers,
        ]);
        if (disconnectedDrain !== null) await disconnectedDrain;
      },
    );
    this.heartbeat = new ExtensionHeartbeat(
      chromeApi,
      (socket) => this.sendEncrypted(socket, "HEARTBEAT", {}),
      (error) => this.reportRuntimeFailure(error, "liveness-pulse"),
    );
    this.autoBootstrap = new PairingAutoBootstrap(chromeApi, {
      canAttemptAutomaticPairing: () => canAttemptAutomaticPairing(this.connection.state),
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
          authenticated: this.connection.state === "CONNECTED" && this.connection.commandReady,
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
    this.connection.pairingSecret = pairingSecret;
    this.connectForPairing();
  }
  public pair(pairingSecret: string): Promise<void> {
    if (this.pairingCompletion.isActive() || this.connection.state === "CONNECTING" || this.connection.state === "PAIRING") {
      throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    }
    if (this.connection.state === "CONNECTED" && this.connection.commandReady) {
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
    this.connection.pairingSecret = null;
    this.connection.pending = null;
    this.connection.session = null;
    this.connection.commandReady = false;
    clearExtensionPermitAuthority();
    this.close(closeReason);
  }
  private connectForPairing(): void {
    if (this.connection.state === "CONNECTING" || this.connection.state === "PAIRING" || this.connection.state === "CONNECTED" || this.connection.pairingSecret === null) return;
    this.connection.state = "CONNECTING";
    const socket = new WebSocket(SOCKET_URL);
    this.connection.socket = socket;
    socket.addEventListener("open", () => { void this.beginPairing(socket); });
    socket.addEventListener("close", () => { void this.onSocketClosed(socket); });
    socket.addEventListener("error", () => {
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      this.close("BROWSER_EXTENSION_SOCKET_ERROR");
    });
    socket.addEventListener("message", (event) => {
      this.commandDelivery.receiveTail = this.commandDelivery.receiveTail.then(() => this.onMessage(socket, event.data));
    });
  }
  private async beginPairing(socket: WebSocket): Promise<void> {
    try {
      const pairingSecret = this.connection.pairingSecret;
      if (socket !== this.connection.socket || pairingSecret === null) return;
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
      if (socket !== this.connection.socket || this.connection.pairingSecret !== pairingSecret) return;
      this.connection.pending = { hello, signing, ecdh, pairingSecret };
      this.connection.state = "PAIRING";
      socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO", epoch: 0, sequence: 0, deadline: hello.deadline, body: hello }));
    } catch (error) {
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail(pairingErrorCode(error));
      this.clearPairing("BROWSER_PAIRING_START_FAILED");
    }
  }
  private async onMessage(socket: WebSocket, data: unknown): Promise<void> {
    if (socket !== this.connection.socket) return;
    if (typeof data !== "string") return this.close("BROWSER_NON_TEXT_FRAME");
    let frame: BrowserAuthorityFrame | null = null;
    try {
      frame = decodeBrowserAuthorityFrame(data);
      if (["PAIR_CHALLENGE", "AUTHENTICATED", "READY"].includes(frame.kind)) {
        await this.acceptPairingFrame(socket, frame);
        return;
      }
      await this.acceptAuthenticatedFrame(socket, frame);
    } catch (error) {
      if (socket !== this.connection.socket) return;
      let reasonCode = pairingErrorCode(error);
      const diagnostic = extensionFrameDiagnostic(error, frame, data);
      if (this.connection.state === "CONNECTED" && this.connection.session) {
        try { await this.sendEncrypted(socket, "REVOKE", diagnostic); }
        catch (sendError) { reasonCode = errorCode(sendError); }
      }
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail(reasonCode);
      this.clearPairing(reasonCode);
    }
  }
  private async acceptAuthenticatedFrame(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    if (frame.kind === "TARGET_ACQUIRE") { await this.acceptTargetAcquire(socket, frame); return; }
    if (frame.kind === "TARGET_CLAIM") {
      await acceptTargetClaimAcknowledgement({
        serverToClientKey: this.connection.session?.serverToClientKey ?? null,
        isCurrent: key => socket === this.connection.socket && this.connection.session?.serverToClientKey === key,
        consumeSequence: accepted => this.acceptServerSequence(accepted),
        claims: this.targetClaims,
        frame,
        expectedEpoch: AUTH_EPOCH,
      });
      return;
    }
    if (frame.kind === "MUTATION_RECEIPT") { await this.acceptMutationAck(socket, frame); return; }
    if (frame.kind === "REVOKE") {
      const session = this.connection.session;
      if (!session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      await decrypt(session.serverToClientKey, "server-to-client", frame);
      if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
      this.acceptServerSequence(frame); this.clearPairing("BROWSER_SERVER_REVOKE");
    }
    else if (frame.kind === "COMMAND") await this.acceptCommand(socket, frame);
    else this.close("BROWSER_UNEXPECTED_FRAME_KIND");
  }
  private async acceptPairingFrame(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    if (frame.kind === "PAIR_CHALLENGE") {
      if (this.connection.state !== "PAIRING" || this.connection.session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      const pending = this.connection.pending;
      const answer = await answerPairChallenge(pending, frame);
      if (socket !== this.connection.socket || this.connection.pending !== pending) return;
      this.connection.session = answer.session;
      this.connection.lastServerSequence = 0;
      socket.send(answer.proofFrame);
      return;
    }
    if (frame.kind === "AUTHENTICATED") {
      if (this.connection.state !== "PAIRING") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      const session = this.connection.session;
      await verifyServerAuthenticated(session, frame, AUTH_EPOCH);
      if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session?.serverToClientKey) return;
      this.connection.pending = null;
      this.connection.pairingSecret = null;
      this.connection.state = "CONNECTED";
      this.connection.commandReady = false;
      this.heartbeat.startHeartbeat(socket);
      return;
    }
    if (frame.kind === "READY") {
      if (this.connection.state !== "CONNECTED" || this.connection.commandReady) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      const session = this.connection.session;
      const authority = await readServerReadyPermit(session, frame, AUTH_EPOCH);
      if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session?.serverToClientKey) return;
      this.acceptServerSequence(frame);
      setExtensionPermitAuthority(authority);
      this.connection.commandReady = true;
      this.pairingCompletion.complete();
      await this.flushMutationReceipt();
      return;
    }
  }
  private acceptServerSequence(frame: BrowserAuthorityFrame): void {
    if (this.connection.state !== "CONNECTED" || frame.epoch !== AUTH_EPOCH
      || Date.parse(frame.deadline) <= Date.now() || frame.sequence <= this.connection.lastServerSequence)
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    this.connection.lastServerSequence = frame.sequence;
  }
  private async acceptMutationAck(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.connection.session;
    if (!session || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const ack = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    this.acceptServerSequence(frame);
    if (Object.keys(ack).sort().join("|") !== "commandId|receiptBindingHash|receiptHash|type" || ack.type !== "ack"
      || typeof ack.commandId !== "string" || ack.commandId.length === 0
      || !/^sha256:[a-f0-9]{64}$/u.test(String(ack.receiptBindingHash)) || !/^sha256:[a-f0-9]{64}$/u.test(String(ack.receiptHash))) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const fact = this.commandDelivery.mutationSlot?.fact;
    if (!fact || ack.commandId !== fact.commandId) return;
    if (ack.receiptBindingHash !== fact.receiptBindingHash || ack.receiptHash !== fact.receiptHash) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
    this.commandDelivery.mutationSlot = null;
    this.commandDelivery.lastMutationDeliveryKey = null;
    return;
  }
  private async acceptTargetAcquire(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.connection.session;
    if (!session || socket !== this.connection.socket || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const request = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    this.acceptServerSequence(frame);
    const operation = targetOperationFrom(request);
    if (operation.action === "release") {
      this.commandDelivery.commandAdmissionSuspended = true;
      const handler = this.targetAuthority.releaseJobBoundChatGptTarget(operation.jobRefHash, operation.releaseAuthority, async () => {
        const slot = this.commandDelivery.mutationSlot;
        if (operation.releaseAuthority !== "website-admin-deletion" || !slot
          || await hashBrowserExtensionText(slot.jobId) !== operation.jobRefHash) return;
        if (this.commandDelivery.mutationSlot !== slot) return;
        this.commandDelivery.mutationSlot = null;
        this.commandDelivery.lastMutationDeliveryKey = null;
      });
      this.commandDelivery.pendingTargetHandlers.add(handler);
      void handler.then(() => {
        this.commandDelivery.pendingTargetHandlers.delete(handler);
        if (socket === this.connection.socket && this.commandDelivery.pendingTargetHandlers.size === 0) {
          this.commandDelivery.commandAdmissionSuspended = false;
          return this.flushMutationReceipt();
        }
      }).catch(error => {
        this.commandDelivery.pendingTargetHandlers.delete(handler);
        this.reportRuntimeFailure(error, "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash });
      });
      return;
    }
    if (this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.mutationSlot !== null) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
    const handler = this.targetAuthority.acquireJobBoundChatGptTarget(
      operation.targetMode, operation.jobRefHash, operation.parentConversationUrl, () => {
        if (this.commandDelivery.commandAdmissionSuspended) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
        if (socket !== this.connection.socket || !this.connection.commandReady || this.connection.session?.serverToClientKey !== session.serverToClientKey)
          throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
        if (Date.now() >= Date.parse(frame.deadline)) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
      },
    );
    this.commandDelivery.pendingTargetHandlers.add(handler);
    void handler.then(() => {
      this.commandDelivery.pendingTargetHandlers.delete(handler);
      if (socket === this.connection.socket && this.commandDelivery.pendingTargetHandlers.size === 0)
        this.commandDelivery.commandAdmissionSuspended = false;
    }, error => {
      this.commandDelivery.pendingTargetHandlers.delete(handler);
      this.reportRuntimeFailure(error, "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash });
    });
  }
  private async acceptCommand(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    if (this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.mutationSlot !== null) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
    const session = this.connection.session;
    if (!session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const payload = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    this.acceptServerSequence(frame);
    const handler = this.executeCommand(socket, frame, payload);
    this.commandDelivery.pendingCommandHandlers.add(handler);
    void handler.then(() => this.commandDelivery.pendingCommandHandlers.delete(handler), error => {
      this.commandDelivery.pendingCommandHandlers.delete(handler);
      if (socket === this.connection.socket) this.close(errorCode(error));
    });
  }
  private async executeCommand(socket: WebSocket, frame: BrowserAuthorityFrame, payload: Record<string, unknown>): Promise<void> {
    const session = this.connection.session;
    if (!session || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const { permit, receiptBindingHash, deadline } = readExtensionCommandPayload(payload, frame.deadline);
    if (this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.mutationSlot !== null) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
    if (receiptBindingHash !== null) this.commandDelivery.mutationSlot = { jobId: permit.jobId, commandId: permit.commandId, receiptBindingHash, fact: null };
    const assertCommandActive = (): void => {
      if (this.commandDelivery.commandAdmissionSuspended) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
      if (socket !== this.connection.socket || !this.connection.commandReady || this.connection.session?.serverToClientKey !== session.serverToClientKey)
        throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      if (Date.now() >= deadline) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
    };
    const reply = await executeExtensionCommandReply({ payload, permit, receiptBindingHash,
      targetAuthority: this.targetAuthority, assertCommandActive, deadline, requestSequence: frame.sequence });
    if (receiptBindingHash !== null) {
      if (!browserMutationTerminalFactShapeValid(reply.body.mutationReceipt) || this.commandDelivery.mutationSlot?.commandId !== permit.commandId)
        throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
      this.commandDelivery.mutationSlot.fact = reply.body.mutationReceipt;
    }
    if (socket !== this.connection.socket || !this.connection.commandReady || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    if (receiptBindingHash !== null) this.commandDelivery.lastMutationDeliveryKey = session.clientToServerKey;
    await this.sendEncrypted(socket, "REPLY", reply.body);
    if (reply.diagnostic) await this.sendEncrypted(socket, "DIAGNOSTIC", reply.diagnostic);
  }
  private async flushMutationReceipt(): Promise<void> {
    const fact = this.commandDelivery.mutationSlot?.fact;
    if (!fact || !this.connection.commandReady || this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.pendingCommandHandlers.size > 0) return;
    const deliveryKey = this.connection.session?.clientToServerKey;
    if (!deliveryKey || this.commandDelivery.lastMutationDeliveryKey === deliveryKey) return;
    this.commandDelivery.lastMutationDeliveryKey = deliveryKey;
    const socket = this.connection.socket;
    try { await this.sendEncrypted(socket, "MUTATION_RECEIPT", fact); }
    catch (error) {
      if (socket === this.connection.socket && this.connection.session?.clientToServerKey === deliveryKey) this.close(errorCode(error));
      throw error;
    }
  }
  private async sendTargetFrame(kind: "TARGET_CLAIM" | "TARGET_REVOKE", body: Record<string, unknown>): Promise<void> {
    if (!this.connection.socket || !this.connection.session || this.connection.state !== "CONNECTED" || !this.connection.commandReady) {
      if (kind === "TARGET_REVOKE") return;
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    if (kind === "TARGET_REVOKE") return this.sendEncrypted(this.connection.socket, kind, body);
    const targetRef = typeof body.targetRef === "string" ? body.targetRef : null;
    const documentRef = typeof body.documentRef === "string" ? body.documentRef : null;
    const jobRefHash = typeof body.jobRefHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(body.jobRefHash)
      ? body.jobRefHash as `sha256:${string}` : null;
    if (!targetRef || !documentRef || !jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
    return this.targetClaims.begin({
      targetRef,
      documentRef,
      jobRefHash,
      send: () => this.sendEncrypted(this.connection.socket, kind, body),
    });
  }
  private sendEncrypted(socket: WebSocket | null, kind: "HEARTBEAT" | "REPLY" | "TARGET_CLAIM" | "TARGET_REVOKE" | "DIAGNOSTIC" | "REVOKE" | "MUTATION_RECEIPT", body: Record<string, unknown>): Promise<void> {
    const session = this.connection.session;
    const send = this.commandDelivery.sendTail.then(async () => {
      if (!socket || socket !== this.connection.socket || socket.readyState !== WebSocket.OPEN || !session || this.connection.state !== "CONNECTED"
        || this.connection.session?.clientToServerKey !== session.clientToServerKey) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      const sequence = this.connection.session.nextClientSequence;
      this.connection.session = { ...this.connection.session, nextClientSequence: sequence + 1 };
      const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: AUTH_EPOCH, sequence, deadline: new Date(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS).toISOString() };
      const encrypted = await encrypt(session.clientToServerKey, "client-to-server", header, body);
      if (socket !== this.connection.socket || this.connection.session?.clientToServerKey !== session.clientToServerKey) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      socket.send(encodeBrowserAuthorityFrame({ ...header, body: { encrypted } }));
    });
    this.commandDelivery.sendTail = Promise.allSettled([send]);
    return send;
  }
  private drainDisconnectedHandlers(): Promise<void> {
    if (this.commandDelivery.disconnectedDrain !== null) return this.commandDelivery.disconnectedDrain;
    this.commandDelivery.commandAdmissionSuspended = true;
    const drain = (async () => {
      await Promise.allSettled([...this.commandDelivery.pendingCommandHandlers, ...this.commandDelivery.pendingTargetHandlers]);
      await this.targetAuthority.releaseActiveTarget(false);
      if (this.commandDelivery.pendingTargetHandlers.size === 0) this.commandDelivery.commandAdmissionSuspended = false;
      await this.flushMutationReceipt();
    })();
    this.commandDelivery.disconnectedDrain = drain;
    void drain.then(() => { this.commandDelivery.disconnectedDrain = null; }, () => { this.commandDelivery.disconnectedDrain = null; });
    return drain;
  }
  private async onSocketClosed(socket: WebSocket): Promise<void> {
    if (socket !== this.connection.socket) return;
    this.commandDelivery.commandAdmissionSuspended = true;
    this.connection.socket = null;
    this.connection.state = "CLOSED";
    this.connection.pairingSecret = null;
    this.connection.pending = null;
    this.connection.session = null;
    this.connection.commandReady = false;
    this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    this.targetClaims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    try { await this.drainDisconnectedHandlers(); }
    catch (error) { this.autoBootstrap.recordFailure(error); }
  }
  private close(reasonCode: string): void {
    const socket = this.connection.socket;
    this.connection.socket = null;
    this.connection.state = "CLOSED";
    this.connection.pairingSecret = null;
    this.connection.pending = null;
    this.connection.session = null;
    this.connection.commandReady = false;
    this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    this.targetClaims.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    clearExtensionPermitAuthority();
    this.heartbeat.stop();
    if (socket) void this.drainDisconnectedHandlers().catch((error) => {
      this.autoBootstrap.recordFailure(error);
    });
    socket?.close(4000, reasonCode);
  }
  private reportRuntimeFailure(error: unknown, runtimeEventType: "unhandledrejection" | "worker-error" | "liveness-pulse" | "job-bound-target-acquisition",
    failedFrameSequence = this.connection.session?.nextClientSequence ?? 0,
    refs: Readonly<{ jobRefHash?: string; targetRef?: string }> = {}): void {
    const body = extensionRuntimeDiagnostic(error, runtimeEventType, failedFrameSequence, refs);
    const socket = this.connection.socket, session = this.connection.session;
    void (async () => {
      if (this.connection.state !== "CONNECTED" || !this.connection.session) return;
      try { await this.sendEncrypted(socket, "DIAGNOSTIC", body); }
      catch (sendError) { if (socket === this.connection.socket && session?.clientToServerKey === this.connection.session?.clientToServerKey) this.close(errorCode(sendError)); }
    })();
  }
  private reportTargetFailure(input: Readonly<{
    targetRef: string;
    runtimeEventType: "debugger-detach" | "tab-remove";
    reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT"
      | "BROWSER_TARGET_CLEANUP_FAILED";
    nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER";
  }>): Promise<void> {
    const body = {
      reasonCode: input.reasonCode,
      failedFrameKind: "EXTENSION_RUNTIME",
      failedFrameSequence: this.connection.session?.nextClientSequence ?? 0,
      diagnosticSource: "extension-runtime",
      runtimeEventType: input.runtimeEventType,
      targetRef: input.targetRef,
      ...(input.nativeCauseCode ? { nativeCauseCode: input.nativeCauseCode } : {}),
      encodedByteLength: 0,
    };
    if (this.connection.state !== "CONNECTED" || !this.connection.session) return Promise.resolve();
    const socket = this.connection.socket, session = this.connection.session;
    return this.sendEncrypted(socket, "DIAGNOSTIC", body)
      .catch((sendError) => { if (socket === this.connection.socket && session.clientToServerKey === this.connection.session?.clientToServerKey) this.close(errorCode(sendError)); });
  }
}

const chrome = readExtensionChromeApi();
if (chrome) {
  const actor = new ExtensionWebSocketActor(chrome);
  actor.start();
}
