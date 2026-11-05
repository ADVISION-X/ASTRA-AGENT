import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame, type BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import { ASTRA_BROWSER_SOCKET_URL } from "../profile/browser-application-identity.js";
import { browserMutationTerminalFactShapeValid } from "../exact-target/browser-observation-receipt.js";
import { executeExtensionCommandReply, readExtensionCommandPayload } from "./extension-command-runtime.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { readExtensionChromeApi, type ExtensionChromeApi } from "./extension-runtime-types.js";
import { ExtensionTargetAuthority, type TargetClaimSendContext } from "./extension-target-authority.js";
import { ExtensionHeartbeat } from "./extension-heartbeat.js";
import { PairingCompletionGate } from "./pairing-completion-gate.js";
import { PairingAutoBootstrap } from "./pairing-auto-bootstrap.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS, BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS, BROWSER_PROTOCOL_REVISION } from "../protocol/generated/browser-protocol.generated.js";
import { asRecord, base64Url, browserCommandErrorCode as errorCode, decrypt, encrypt, hexSecret,
  hashBrowserExtensionText, pairingErrorCode, publicSigningJwk } from "./websocket-actor-crypto.js";
import { extensionFrameDiagnostic, extensionRuntimeDiagnostic } from "./websocket-actor-diagnostics.js";
import { acceptTargetClaimAcknowledgement, TargetClaimAwaiter } from "./websocket-target-claim-awaiter.js";
import { targetOperationFrom, cancelPendingTargetAcquisition, type PendingTargetHandler } from "./websocket-target-operation.js";
import { answerPairChallenge, readServerReadyPermit, verifyServerAuthenticated,
  type AuthenticatedSession, type PendingPairing } from "./websocket-pairing-proof.js";

declare const __GRASSEYE_RELEASE_BUILD_ID__: string;
const SOCKET_URL = ASTRA_BROWSER_SOCKET_URL, AUTH_EPOCH = 1;
type SocketState = "IDLE" | "CONNECTING" | "PAIRING" | "CONNECTED" | "CLOSED";
const canAttemptAutomaticPairing = (state: SocketState): boolean => !["CONNECTING", "PAIRING", "CONNECTED"].includes(state);

const assertMutationAckShape = (response: Record<string, unknown>): boolean => {
  const disposed = response.type === "disposed";
  const expected = disposed ? "commandId|reasonCode|receiptBindingHash|rejectedFactHash|type" : "commandId|receiptBindingHash|receiptHash|type";
  if (Object.keys(response).sort().join("|") !== expected || !["ack", "disposed"].includes(String(response.type))
    || typeof response.commandId !== "string" || !response.commandId
    || typeof response.receiptBindingHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(response.receiptBindingHash)
    || disposed && !["BROWSER_RECONCILIATION_RECEIPT_INVALID", "BROWSER_COMMAND_RECEIPT_MISSING", "BROWSER_MUTATION_STATE_CONFLICT"].includes(String(response.reasonCode))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return disposed;
};

const assertMutationSlotHash = async (response: Record<string, unknown>, slot: Readonly<{ fact: unknown }>,
  disposed: boolean): Promise<void> => {
  if (disposed) {
    const hash = slot.fact === null ? null : await hashBrowserExtensionText(canonicalizeBrowserAuthorityValue(slot.fact));
    if (response.rejectedFactHash !== hash) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
  } else if (!browserMutationTerminalFactShapeValid(slot.fact) || response.receiptHash !== slot.fact.receiptHash) {
    throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
  }
};

/** Delivery retains the fixed original fact until ACK, independently of the live Target. */
export class ExtensionWebSocketActor {
  private readonly connection = { socket: null as WebSocket | null, state: "IDLE" as SocketState,
    commandReady: false, lastServerSequence: 0, session: null as AuthenticatedSession | null,
    pairingSecret: null as string | null, pending: null as PendingPairing | null };
  private readonly pairingCompletion = new PairingCompletionGate();
  private readonly targetClaims = new TargetClaimAwaiter();
  private readonly targetAuthority: ExtensionTargetAuthority;
  private readonly heartbeat: ExtensionHeartbeat;
  private readonly autoBootstrap: PairingAutoBootstrap;
  private readonly commandDelivery = {
    pendingCommandHandlers: new Set<Promise<void>>(), pendingTargetHandlers: new Map<number, PendingTargetHandler>(), commandAdmissionSuspended: false,
    mutationSlot: null as { jobId: string; commandId: string; receiptBindingHash: `sha256:${string}`; fact: unknown } | null,
    sendTail: Promise.resolve([] as PromiseSettledResult<void>[]), receiveTail: Promise.resolve() as Promise<void>,
    disconnectedDrain: null as Promise<void> | null,
  };
  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.targetAuthority = new ExtensionTargetAuthority(chromeApi, (kind, body, context) => this.sendTargetFrame(kind, body, context),
      input => this.reportTargetFailure(input), async () => {
        this.commandDelivery.commandAdmissionSuspended = true;
        const drain = this.commandDelivery.disconnectedDrain;
        await Promise.allSettled([...this.commandDelivery.pendingCommandHandlers,
          ...Array.from(this.commandDelivery.pendingTargetHandlers.values(), record => record.promise)]);
        if (drain !== null) await drain;
      });
    this.heartbeat = new ExtensionHeartbeat(chromeApi, async socket => {
      await this.sendEncrypted(socket, "HEARTBEAT", {}); await this.flushMutationReceipt();
    },
      error => this.reportRuntimeFailure(error, "liveness-pulse"));
    this.autoBootstrap = new PairingAutoBootstrap(chromeApi, {
      canAttemptAutomaticPairing: () => canAttemptAutomaticPairing(this.connection.state), pair: secret => this.pair(secret),
    }, __GRASSEYE_RELEASE_BUILD_ID__);
  }
  public start(): void {
    globalThis.addEventListener("unhandledrejection", event => { event.preventDefault(); this.reportRuntimeFailure(event.reason, "unhandledrejection"); });
    globalThis.addEventListener("error", event => { event.preventDefault(); this.reportRuntimeFailure(event.error, "worker-error"); });
    this.chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
      if (sender.id !== this.chromeApi.runtime.id) return false;
      const request = asRecord(message);
      if (request?.kind === "GRASSEYE_AUTOMATIC_PAIRING_SECRET" && typeof request.pairingSecret === "string") {
        void this.pair(request.pairingSecret).then(() => respond({ ok: true }), (error: unknown) => respond({ ok: false, errorCode: errorCode(error) })); return true;
      }
      if (request?.kind === "GRASSEYE_BROWSER_STATUS") respond({ ok: true,
        authenticated: this.connection.state === "CONNECTED" && this.connection.commandReady,
        automaticPairingErrorCode: this.autoBootstrap.currentFailureCode() });
      return false;
    });
    this.targetAuthority.start(); this.autoBootstrap.start();
  }
  public setOneTimePairingSecret(secret: string): void { hexSecret(secret); this.connection.pairingSecret = secret; this.connectForPairing(); }
  public pair(secret: string): Promise<void> {
    if (this.pairingCompletion.isActive() || ["CONNECTING", "PAIRING"].includes(this.connection.state)) throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    if (this.connection.state === "CONNECTED" && this.connection.commandReady) return Promise.resolve();
    hexSecret(secret);
    const completion = this.pairingCompletion.begin(BROWSER_COMMAND_DEFAULT_DEADLINE_MS, () => {
      this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE"); this.clearPairing("BROWSER_PAIRING_TIMEOUT");
    });
    this.setOneTimePairingSecret(secret); return completion;
  }
  public clearPairing(reason = "BROWSER_PAIRING_CLEARED"): void { this.close(reason); }
  private connectForPairing(): void {
    if (!canAttemptAutomaticPairing(this.connection.state) || this.connection.pairingSecret === null) return;
    const socket = new WebSocket(SOCKET_URL); this.connection.state = "CONNECTING"; this.connection.socket = socket;
    socket.addEventListener("open", () => { void this.beginPairing(socket); });
    socket.addEventListener("close", () => { void this.onSocketClosed(socket); });
    socket.addEventListener("error", () => {
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); this.close("BROWSER_EXTENSION_SOCKET_ERROR");
    });
    socket.addEventListener("message", event => { this.commandDelivery.receiveTail = this.commandDelivery.receiveTail.then(() => this.onMessage(socket, event.data)); });
  }
  private async beginPairing(socket: WebSocket): Promise<void> {
    try {
      const secret = this.connection.pairingSecret;
      if (socket !== this.connection.socket || secret === null) return;
      const signing = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const ecdh = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const hello = { extensionId: this.chromeApi.runtime.id, extensionVersion: this.chromeApi.runtime.getManifest().version,
        releaseBuildId: __GRASSEYE_RELEASE_BUILD_ID__,
        clientSigningPublicJwk: publicSigningJwk(await globalThis.crypto.subtle.exportKey("jwk", signing.publicKey)),
        clientEcdhPublicKey: base64Url(new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", ecdh.publicKey))),
        deadline: new Date(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS).toISOString() };
      if (socket !== this.connection.socket || this.connection.pairingSecret !== secret) return;
      this.connection.pending = { hello, signing, ecdh, pairingSecret: secret }; this.connection.state = "PAIRING";
      socket.send(encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO",
        epoch: 0, sequence: 0, deadline: hello.deadline, body: hello }));
    } catch (error) {
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail(pairingErrorCode(error)); this.clearPairing("BROWSER_PAIRING_START_FAILED");
    }
  }
  private async onMessage(socket: WebSocket, data: unknown): Promise<void> {
    if (socket !== this.connection.socket) return;
    if (typeof data !== "string") return this.close("BROWSER_NON_TEXT_FRAME");
    let frame: BrowserAuthorityFrame | null = null;
    try {
      frame = decodeBrowserAuthorityFrame(data);
      if (["PAIR_CHALLENGE", "AUTHENTICATED", "READY"].includes(frame.kind)) await this.acceptPairingFrame(socket, frame);
      else await this.acceptAuthenticatedFrame(socket, frame);
    } catch (error) {
      if (socket !== this.connection.socket) return;
      let code = pairingErrorCode(error);
      if (this.connection.state === "CONNECTED" && this.connection.session) {
        try { await this.sendEncrypted(socket, "REVOKE", extensionFrameDiagnostic(error, frame, data)); }
        catch (sendError) { code = errorCode(sendError); }
      }
      if (socket !== this.connection.socket) return;
      this.pairingCompletion.fail(code); this.clearPairing(code);
    }
  }
  private async acceptPairingFrame(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.connection.session;
    if (frame.kind === "PAIR_CHALLENGE") {
      if (this.connection.state !== "PAIRING" || session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      const pending = this.connection.pending, answer = await answerPairChallenge(pending, frame);
      if (socket !== this.connection.socket || this.connection.pending !== pending) return;
      this.connection.session = answer.session; this.connection.lastServerSequence = 0; socket.send(answer.proofFrame); return;
    }
    if (frame.kind === "AUTHENTICATED") {
      if (this.connection.state !== "PAIRING") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      await verifyServerAuthenticated(session, frame, AUTH_EPOCH);
      if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session?.serverToClientKey) return;
      this.connection.pending = null; this.connection.pairingSecret = null;
      this.connection.state = "CONNECTED"; this.connection.commandReady = false; this.heartbeat.startHeartbeat(socket); return;
    }
    if (this.connection.state !== "CONNECTED" || this.connection.commandReady) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const authority = await readServerReadyPermit(session, frame, AUTH_EPOCH);
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session?.serverToClientKey) return;
    this.acceptServerSequence(frame); setExtensionPermitAuthority(authority); this.connection.commandReady = true;
    this.pairingCompletion.complete(); await this.flushMutationReceipt();
  }
  private async acceptAuthenticatedFrame(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    switch (frame.kind) {
      case "TARGET_ACQUIRE": await this.acceptTargetAcquire(socket, frame); return;
      case "TARGET_CLAIM": await acceptTargetClaimAcknowledgement({
        serverToClientKey: this.connection.session?.serverToClientKey ?? null,
        isCurrent: key => socket === this.connection.socket && this.connection.session?.serverToClientKey === key,
        consumeSequence: accepted => this.acceptServerSequence(accepted), claims: this.targetClaims, frame, expectedEpoch: AUTH_EPOCH }); return;
      case "MUTATION_RECEIPT": await this.acceptMutationAck(socket, frame); return;
      case "COMMAND": await this.acceptCommand(socket, frame); return;
      case "REVOKE": {
        const session = this.connection.session;
        if (!session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
        await decrypt(session.serverToClientKey, "server-to-client", frame);
        if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
        this.acceptServerSequence(frame); this.clearPairing("BROWSER_SERVER_REVOKE"); return;
      }
      default: this.close("BROWSER_UNEXPECTED_FRAME_KIND");
    }
  }
  private acceptServerSequence(frame: BrowserAuthorityFrame): void {
    if (this.connection.state !== "CONNECTED" || frame.epoch !== AUTH_EPOCH || Date.parse(frame.deadline) <= Date.now()
      || frame.sequence <= this.connection.lastServerSequence) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    this.connection.lastServerSequence = frame.sequence;
  }
  private async acceptMutationAck(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.connection.session;
    if (!session || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const currentSession = (): boolean => socket === this.connection.socket
      && this.connection.session?.serverToClientKey === session.serverToClientKey;
    const response = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (!currentSession()) return;
    this.acceptServerSequence(frame);
    const disposed = assertMutationAckShape(response);
    const slot = this.commandDelivery.mutationSlot;
    if (!slot || response.commandId !== slot.commandId) return;
    if (response.receiptBindingHash !== slot.receiptBindingHash) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
    await assertMutationSlotHash(response, slot, disposed);
    if (!currentSession() || this.commandDelivery.mutationSlot !== slot) return;
    if (disposed && (this.commandDelivery.pendingCommandHandlers.size > 0
      || this.commandDelivery.pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain !== null)) return;
    this.commandDelivery.mutationSlot = null;
  }

  private async acceptTargetAcquire(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    const session = this.connection.session;
    if (!session || socket !== this.connection.socket || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const currentSession = (): boolean => socket === this.connection.socket
      && this.connection.session?.serverToClientKey === session.serverToClientKey
      && this.connection.session?.clientToServerKey === session.clientToServerKey;
    const request = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (!currentSession()) return;
    this.acceptServerSequence(frame);
    const operation = targetOperationFrom(request), deadline = Date.parse(frame.deadline);
    const maximum = operation.action === "acquire" ? BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS;
    if (deadline > Date.now() + maximum) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
    if (operation.action === "cancel-acquisition") {
      cancelPendingTargetAcquisition(this.commandDelivery.pendingTargetHandlers, operation, session); return;
    }
    if (this.commandDelivery.pendingTargetHandlers.size > 0 || this.commandDelivery.disconnectedDrain !== null) {
      this.reportRuntimeFailure(new Error("BROWSER_BACKPRESSURE"), "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash }); return;
    }
    if (operation.action === "acquire" && (this.commandDelivery.commandAdmissionSuspended
      || this.commandDelivery.mutationSlot !== null || this.commandDelivery.pendingCommandHandlers.size > 0)) {
      this.reportRuntimeFailure(new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED"), "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash }); return;
    }
    const state = { action: operation.action, jobRefHash: operation.jobRefHash,
      serverToClientKey: session.serverToClientKey, clientToServerKey: session.clientToServerKey, cancelled: false };
    const handler = (async (): Promise<void> => {
      if (operation.action === "release") {
        this.commandDelivery.commandAdmissionSuspended = true;
        const result = await this.targetAuthority.releaseJobBoundChatGptTarget(operation.jobRefHash, operation.releaseAuthority, async () => {
          const slot = this.commandDelivery.mutationSlot;
          if (operation.releaseAuthority !== "website-admin-deletion" || !slot || await hashBrowserExtensionText(slot.jobId) !== operation.jobRefHash) return;
          if (this.commandDelivery.mutationSlot === slot) this.commandDelivery.mutationSlot = null;
        });
        if (currentSession()) await this.sendEncrypted(socket, "TARGET_REVOKE", { ...result, requestSequence: frame.sequence });
        return;
      }
      await this.targetAuthority.acquireJobBoundChatGptTarget(operation.targetMode, operation.jobRefHash, operation.parentConversationUrl, () => {
        if (state.cancelled) throw new Error("BROWSER_WAIT_ABORTED");
        if (this.commandDelivery.commandAdmissionSuspended) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
        if (!currentSession() || !this.connection.commandReady) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
        if (Date.now() >= deadline) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
      }, deadline);
    })();
    this.commandDelivery.pendingTargetHandlers.set(frame.sequence, Object.assign(state, { promise: handler }));
    const retire = async (failed: boolean, error?: unknown): Promise<void> => {
      this.commandDelivery.pendingTargetHandlers.delete(frame.sequence);
      if (!currentSession()) return;
      if (this.connection.commandReady && this.commandDelivery.pendingTargetHandlers.size === 0
        && this.commandDelivery.pendingCommandHandlers.size === 0 && this.commandDelivery.disconnectedDrain === null) {
        this.commandDelivery.commandAdmissionSuspended = false;
      }
      if (failed) this.reportRuntimeFailure(error, "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash });
      await this.flushMutationReceipt();
    };
    void handler.then(() => retire(false), error => retire(true, error)).catch(error => {
      if (currentSession()) this.reportRuntimeFailure(error, "job-bound-target-acquisition", frame.sequence, { jobRefHash: operation.jobRefHash });
    });
  }

  private async acceptCommand(socket: WebSocket, frame: BrowserAuthorityFrame): Promise<void> {
    if (this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.mutationSlot !== null || this.commandDelivery.pendingCommandHandlers.size > 0) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
    const session = this.connection.session;
    if (!session) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const payload = await decrypt(session.serverToClientKey, "server-to-client", frame);
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    this.acceptServerSequence(frame);
    const handler = this.executeCommand(socket, frame, payload); this.commandDelivery.pendingCommandHandlers.add(handler);
    void handler.then(() => { this.commandDelivery.pendingCommandHandlers.delete(handler); return this.flushMutationReceipt(); }, error => {
      this.commandDelivery.pendingCommandHandlers.delete(handler); if (socket === this.connection.socket) this.close(errorCode(error));
    });
  }
  private async executeCommand(socket: WebSocket, frame: BrowserAuthorityFrame, payload: Record<string, unknown>): Promise<void> {
    const session = this.connection.session;
    if (!session || !this.connection.commandReady || frame.epoch !== AUTH_EPOCH) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const { permit, deadline, receiptBindingHash } = readExtensionCommandPayload(payload, frame.deadline);
    if (this.commandDelivery.commandAdmissionSuspended || this.commandDelivery.mutationSlot !== null) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
    if (receiptBindingHash !== null) this.commandDelivery.mutationSlot = { jobId: permit.jobId, commandId: permit.commandId, receiptBindingHash, fact: null };
    const assertCommandActive = (): void => {
      if (this.commandDelivery.commandAdmissionSuspended) throw new Error("BROWSER_COMMAND_ADMISSION_SUSPENDED");
      if (socket !== this.connection.socket || !this.connection.commandReady || this.connection.session?.serverToClientKey !== session.serverToClientKey) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      if (Date.now() >= deadline) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
    };
    const reply = await executeExtensionCommandReply({ payload, permit, receiptBindingHash, targetAuthority: this.targetAuthority,
      assertCommandActive, deadline, requestSequence: frame.sequence });
    if (receiptBindingHash !== null) {
      const fact = reply.body.mutationReceipt, slot = this.commandDelivery.mutationSlot;
      if (slot?.commandId !== permit.commandId || slot.receiptBindingHash !== receiptBindingHash) throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      slot.fact = fact;
    }
    if (socket !== this.connection.socket || this.connection.session?.serverToClientKey !== session.serverToClientKey) return;
    const intentKind = asRecord(asRecord(payload.command)?.intent)?.kind;
    try {
      if (reply.diagnostic) await this.sendEncrypted(socket, "DIAGNOSTIC", reply.diagnostic);
    } finally {
      try {
        await this.targetAuthority.retireInvalidCommandTarget(reply.body, permit, typeof intentKind === "string" ? intentKind : null);
      } finally {
        await this.sendEncrypted(socket, "REPLY", reply.body);
      }
    }
  }
  private async flushMutationReceipt(): Promise<void> {
    const slot = this.commandDelivery.mutationSlot;
    if (!slot || !this.connection.commandReady || this.commandDelivery.commandAdmissionSuspended
      || this.commandDelivery.pendingCommandHandlers.size > 0 || this.commandDelivery.pendingTargetHandlers.size > 0) return;
    const socket = this.connection.socket, key = this.connection.session?.clientToServerKey;
    if (!key) return;
    const rejectedFactHash = slot.fact === null ? null : await hashBrowserExtensionText(canonicalizeBrowserAuthorityValue(slot.fact));
    if (this.commandDelivery.mutationSlot !== slot || this.connection.session?.clientToServerKey !== key) return;
    try { await this.sendEncrypted(socket, "MUTATION_RECEIPT", { type: "dispose", commandId: slot.commandId,
      receiptBindingHash: slot.receiptBindingHash, rejectedFact: slot.fact, rejectedFactHash }); }
    catch (error) {
      if (socket === this.connection.socket && this.connection.session?.clientToServerKey === key) this.close(errorCode(error)); throw error;
    }
  }

  private async sendTargetFrame(kind: "TARGET_CLAIM" | "TARGET_REVOKE", body: Record<string, unknown>, context?: TargetClaimSendContext): Promise<void> {
    if (!this.connection.socket || !this.connection.session || this.connection.state !== "CONNECTED" || !this.connection.commandReady) {
      if (kind === "TARGET_REVOKE") return;
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    if (kind === "TARGET_REVOKE") return this.sendEncrypted(this.connection.socket, kind, body);
    const targetRef = typeof body.targetRef === "string" ? body.targetRef : null;
    const documentRef = typeof body.documentRef === "string" ? body.documentRef : null;
    const jobRefHash = typeof body.jobRefHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(body.jobRefHash) ? body.jobRefHash as `sha256:${string}` : null;
    if (!targetRef || !documentRef || !jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
    return this.targetClaims.begin({ targetRef, documentRef, jobRefHash,
      send: assertPending => this.sendEncrypted(this.connection.socket, kind, body, context ? {
        deadlineAt: context.deadlineAt,
        assertCurrent: () => { assertPending(); context.assertCurrent(); },
      } : undefined) });
  }

  private sendEncrypted(socket: WebSocket | null,
    kind: "HEARTBEAT" | "REPLY" | "TARGET_CLAIM" | "TARGET_REVOKE" | "DIAGNOSTIC" | "REVOKE" | "MUTATION_RECEIPT",
    body: Record<string, unknown>, context?: TargetClaimSendContext): Promise<void> {
    const session = this.connection.session;
    const send = this.commandDelivery.sendTail.then(async () => {
      if (!socket || socket !== this.connection.socket || socket.readyState !== WebSocket.OPEN || !session || this.connection.state !== "CONNECTED"
        || this.connection.session?.clientToServerKey !== session.clientToServerKey) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      context?.assertCurrent();
      const deadlineAt = Math.min(Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS, context?.deadlineAt ?? Infinity);
      if (context && Date.now() >= context.deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
      const sequence = this.connection.session.nextClientSequence;
      this.connection.session = { ...this.connection.session, nextClientSequence: sequence + 1 };
      const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind, epoch: AUTH_EPOCH, sequence,
        deadline: new Date(deadlineAt).toISOString() };
      const encrypted = await encrypt(session.clientToServerKey, "client-to-server", header, body);
      if (socket !== this.connection.socket || this.connection.session?.clientToServerKey !== session.clientToServerKey) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      context?.assertCurrent();
      if (context && Date.now() >= context.deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
      socket.send(encodeBrowserAuthorityFrame({ ...header, body: { encrypted } }));
    });
    this.commandDelivery.sendTail = Promise.allSettled([send]); return send;
  }

  private drainDisconnectedHandlers(): Promise<void> {
    if (this.commandDelivery.disconnectedDrain !== null) return this.commandDelivery.disconnectedDrain;
    this.commandDelivery.commandAdmissionSuspended = true;
    const drain = (async () => {
      await Promise.allSettled([...this.commandDelivery.pendingCommandHandlers,
        ...Array.from(this.commandDelivery.pendingTargetHandlers.values(), record => record.promise)]);
      await this.targetAuthority.releaseActiveTarget(false);
      if (this.commandDelivery.pendingTargetHandlers.size === 0) this.commandDelivery.commandAdmissionSuspended = false;
      await this.flushMutationReceipt();
    })();
    this.commandDelivery.disconnectedDrain = drain;
    void drain.then(() => { this.commandDelivery.disconnectedDrain = null; }, () => { this.commandDelivery.disconnectedDrain = null; }); return drain;
  }
  private async onSocketClosed(socket: WebSocket): Promise<void> {
    if (socket !== this.connection.socket) return;
    this.commandDelivery.commandAdmissionSuspended = true;
    this.connection.socket = null; this.connection.state = "CLOSED"; this.connection.pairingSecret = null;
    this.connection.pending = null; this.connection.session = null; this.connection.commandReady = false;
    this.pairingCompletion.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"); this.targetClaims.fail("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    clearExtensionPermitAuthority(); this.heartbeat.stop();
    try { await this.drainDisconnectedHandlers(); } catch (error) { this.autoBootstrap.recordFailure(error); }
  }
  private close(code: string): void {
    const socket = this.connection.socket;
    this.connection.socket = null; this.connection.state = "CLOSED"; this.connection.pairingSecret = null;
    this.connection.pending = null; this.connection.session = null; this.connection.commandReady = false;
    this.pairingCompletion.fail("BROWSER_AUTHENTICATION_INCOMPLETE"); this.targetClaims.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
    clearExtensionPermitAuthority(); this.heartbeat.stop();
    if (socket) void this.drainDisconnectedHandlers().catch(error => { this.autoBootstrap.recordFailure(error); });
    socket?.close(4000, code);
  }
  private reportRuntimeFailure(error: unknown, eventType: "unhandledrejection" | "worker-error" | "liveness-pulse" | "job-bound-target-acquisition",
    sequence = this.connection.session?.nextClientSequence ?? 0, refs: Readonly<{ jobRefHash?: string; targetRef?: string }> = {}): void {
    const body = extensionRuntimeDiagnostic(error, eventType, sequence, refs), socket = this.connection.socket, session = this.connection.session;
    void (async () => {
      if (this.connection.state !== "CONNECTED" || !this.connection.session) return;
      try { await this.sendEncrypted(socket, "DIAGNOSTIC", body); }
      catch (sendError) { if (socket === this.connection.socket && session?.clientToServerKey === this.connection.session?.clientToServerKey) this.close(errorCode(sendError)); }
    })();
  }
  private reportTargetFailure(input: Readonly<{ targetRef: string; runtimeEventType: "debugger-detach" | "tab-remove";
    reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT" | "BROWSER_TARGET_CLEANUP_FAILED";
    nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER" }>): Promise<void> {
    if (this.connection.state !== "CONNECTED" || !this.connection.session) return Promise.resolve();
    const body = { reasonCode: input.reasonCode, failedFrameKind: "EXTENSION_RUNTIME", failedFrameSequence: this.connection.session.nextClientSequence,
      diagnosticSource: "extension-runtime", runtimeEventType: input.runtimeEventType, targetRef: input.targetRef,
      ...(input.nativeCauseCode ? { nativeCauseCode: input.nativeCauseCode } : {}), encodedByteLength: 0 };
    const socket = this.connection.socket, session = this.connection.session;
    return this.sendEncrypted(socket, "DIAGNOSTIC", body).catch(error => {
      if (socket === this.connection.socket && session.clientToServerKey === this.connection.session?.clientToServerKey) this.close(errorCode(error));
    });
  }
}
const chrome = readExtensionChromeApi();
if (chrome) new ExtensionWebSocketActor(chrome).start();
