import { GRASSEYE_BROWSER_EXTENSION_ID, GRASSEYE_BROWSER_EXTENSION_VERSION, GRASSEYE_BROWSER_PROTOCOL_VERSION, GRASSEYE_BROWSER_RELEASE_IDENTITY, GRASSEYE_NATIVE_HOST_NAME, isBrowserWireMessage, } from "./protocol.js";
import { executeCommand } from "./service-worker-command-execution.js";
import { createExtensionEphemeralSession, decryptExtensionFrame, encryptExtensionFrame, signExtensionTranscript, verifyControllerProof, } from "./service-worker-session-crypto.js";
let runCommandHandler = null;
let disconnectHandler = null;
let activeActor = null;
let nextPortEpoch = 0;
let reconnectAlarmScheduled = false;
let immediateReconnectAt = 0;
const authTranscript = (input) => [
    "auth-v2",
    GRASSEYE_BROWSER_PROTOCOL_VERSION,
    GRASSEYE_BROWSER_RELEASE_IDENTITY,
    input.controllerSessionId,
    input.connectionGeneration,
    input.nativePortEpoch,
    input.challengeId,
    input.nonce,
    input.controllerPublicKey,
    input.extensionInstanceId,
    input.extensionPublicKey,
].join(":");
const grantTranscript = (binding, challengeId) => [
    "grant-v2",
    binding.authorityId,
    binding.authorityCertificateHash,
    binding.connectionGeneration,
    binding.nativePortEpoch,
    challengeId,
].join(":");
const grantAckTranscript = (binding, challengeId) => [
    "grant-ack-v2",
    binding.authorityId,
    binding.authorityCertificateHash,
    binding.connectionGeneration,
    binding.nativePortEpoch,
    challengeId,
].join(":");
const heartbeatTranscript = (binding, monotonicMs) => [
    "heartbeat-v2",
    binding.authorityId,
    binding.connectionGeneration,
    binding.nativePortEpoch,
    monotonicMs,
].join(":");
class NativePortActor {
    port;
    nativePortEpoch;
    extensionInstanceId = crypto.randomUUID();
    handshake = null;
    authority = null;
    closed = false;
    challengeConsumed = false;
    lastAcceptedSequence = 0;
    heartbeatTimer = null;
    commandReceipts = new Map();
    constructor(port, nativePortEpoch) {
        this.port = port;
        this.nativePortEpoch = nativePortEpoch;
    }
    start() {
        this.port.onMessage.addListener((message) => {
            void this.handleMessage(message).catch(() => this.failClosed());
        });
        this.port.onDisconnect.addListener(() => this.handleDisconnect());
        this.port.postMessage({
            protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
            releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
            type: "extension_hello",
            extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
            extensionVersion: GRASSEYE_BROWSER_EXTENSION_VERSION,
            extensionInstanceId: this.extensionInstanceId,
            nativePortEpoch: this.nativePortEpoch,
        });
    }
    async handleMessage(message) {
        if (this.closed || activeActor !== this || !isBrowserWireMessage(message))
            return;
        if (message.type === "controller_challenge") {
            await this.handleChallenge(message);
            return;
        }
        if (message.type === "authority_grant") {
            await this.handleAuthorityGrant(message);
            return;
        }
        if (message.type === "command_frame") {
            await this.handleCommandFrame(message);
        }
    }
    async handleChallenge(message) {
        if (this.challengeConsumed || this.authority || this.handshake) {
            throw new Error("BROWSER_DUPLICATE_CHALLENGE");
        }
        if (message.nativePortEpoch !== this.nativePortEpoch) {
            throw new Error("BROWSER_PORT_EPOCH_MISMATCH");
        }
        this.challengeConsumed = true;
        const session = await createExtensionEphemeralSession({
            controllerPublicKeyBase64: message.controllerPublicKey,
            nonceBase64: message.nonce,
        });
        const handshake = Object.freeze({
            challengeId: message.challengeId,
            nonce: message.nonce,
            controllerSessionId: message.controllerSessionId,
            connectionGeneration: message.connectionGeneration,
            nativePortEpoch: message.nativePortEpoch,
            controllerPublicKey: message.controllerPublicKey,
            session,
        });
        this.handshake = handshake;
        const transcript = authTranscript({
            ...handshake,
            extensionInstanceId: this.extensionInstanceId,
            extensionPublicKey: session.publicKeyBase64,
        });
        const transcriptProof = await signExtensionTranscript(session.hmacKey, transcript);
        if (this.closed || activeActor !== this)
            return;
        this.port.postMessage({
            protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
            releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
            type: "extension_authenticated",
            extensionInstanceId: this.extensionInstanceId,
            nativePortEpoch: this.nativePortEpoch,
            challengeId: handshake.challengeId,
            nonce: handshake.nonce,
            extensionPublicKey: session.publicKeyBase64,
            transcriptProof,
        });
    }
    async handleAuthorityGrant(message) {
        const handshake = this.handshake;
        if (!handshake || this.authority)
            throw new Error("BROWSER_AUTHORITY_GRANT_WITHOUT_HANDSHAKE");
        if (message.challengeId !== handshake.challengeId
            || message.connectionGeneration !== handshake.connectionGeneration
            || message.nativePortEpoch !== this.nativePortEpoch) {
            throw new Error("BROWSER_AUTHORITY_GRANT_GENERATION_MISMATCH");
        }
        const binding = Object.freeze({
            authorityId: message.authorityId,
            authorityCertificateHash: message.authorityCertificateHash,
            connectionGeneration: message.connectionGeneration,
            nativePortEpoch: message.nativePortEpoch,
        });
        const valid = await verifyControllerProof(handshake.session.hmacKey, grantTranscript(binding, handshake.challengeId), message.grantProof);
        if (!valid)
            throw new Error("BROWSER_AUTHORITY_GRANT_PROOF_INVALID");
        const ackProof = await signExtensionTranscript(handshake.session.hmacKey, grantAckTranscript(binding, handshake.challengeId));
        if (this.closed || activeActor !== this)
            return;
        this.port.postMessage({
            protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
            releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
            type: "authority_grant_ack",
            authorityId: binding.authorityId,
            authorityCertificateHash: binding.authorityCertificateHash,
            connectionGeneration: binding.connectionGeneration,
            nativePortEpoch: binding.nativePortEpoch,
            challengeId: handshake.challengeId,
            ackProof,
        });
        this.authority = binding;
        this.lastAcceptedSequence = 0;
        this.startHeartbeat();
    }
    async handleCommandFrame(message) {
        const authority = this.authority;
        const handshake = this.handshake;
        if (!authority || !handshake || !runCommandHandler)
            throw new Error("BROWSER_AUTHORITY_ABSENT");
        const permit = message.permit;
        if (permit.authorityId !== authority.authorityId
            || permit.authorityCertificateHash !== authority.authorityCertificateHash
            || permit.connectionGeneration !== authority.connectionGeneration
            || permit.nativePortEpoch !== authority.nativePortEpoch) {
            throw new Error("BROWSER_COMMAND_AUTHORITY_MISMATCH");
        }
        if (permit.deadlineAt <= Date.now())
            throw new Error("BROWSER_COMMAND_DEADLINE_EXPIRED");
        if (permit.sequence !== this.lastAcceptedSequence + 1) {
            throw new Error("BROWSER_COMMAND_SEQUENCE_INVALID");
        }
        const payload = await decryptExtensionFrame(handshake.session.frameKey, {
            authorityId: authority.authorityId,
            connectionGeneration: authority.connectionGeneration,
            nativePortEpoch: authority.nativePortEpoch,
            sequence: permit.sequence,
        }, message);
        if (payload.commandId !== permit.commandId)
            throw new Error("BROWSER_COMMAND_ID_MISMATCH");
        if (this.commandReceipts.has(payload.commandId))
            throw new Error("BROWSER_COMMAND_ID_REPLAY");
        this.lastAcceptedSequence = permit.sequence;
        const completion = executeCommand({ payload, deadlineAt: permit.deadlineAt }, async (command, expectedLoaderId) => runCommandHandler(command, expectedLoaderId));
        this.commandReceipts.set(payload.commandId, completion);
        const response = await completion;
        if (this.closed || activeActor !== this || this.authority?.authorityId !== authority.authorityId)
            return;
        await this.sendResponse(permit, response);
        this.trimReceipts();
    }
    async sendResponse(permit, response) {
        const authority = this.authority;
        const handshake = this.handshake;
        if (!authority || !handshake)
            return;
        const encrypted = await encryptExtensionFrame(handshake.session.frameKey, {
            authorityId: authority.authorityId,
            connectionGeneration: authority.connectionGeneration,
            nativePortEpoch: authority.nativePortEpoch,
            sequence: permit.sequence,
        }, response);
        if (this.closed || activeActor !== this)
            return;
        this.port.postMessage({
            protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
            releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
            type: "response_frame",
            permitHash: permit.permitHash,
            authorityId: authority.authorityId,
            connectionGeneration: authority.connectionGeneration,
            nativePortEpoch: authority.nativePortEpoch,
            sequence: permit.sequence,
            ...encrypted,
        });
    }
    startHeartbeat() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            void this.sendHeartbeat().catch(() => this.failClosed());
        }, 1_000);
        void this.sendHeartbeat().catch(() => this.failClosed());
    }
    async sendHeartbeat() {
        const authority = this.authority;
        const handshake = this.handshake;
        if (!authority || !handshake || this.closed || activeActor !== this)
            return;
        const monotonicMs = Math.floor(performance.now());
        const proof = await signExtensionTranscript(handshake.session.hmacKey, heartbeatTranscript(authority, monotonicMs));
        if (this.closed || activeActor !== this)
            return;
        this.port.postMessage({
            protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
            releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
            type: "heartbeat",
            authorityId: authority.authorityId,
            connectionGeneration: authority.connectionGeneration,
            nativePortEpoch: authority.nativePortEpoch,
            monotonicMs,
            proof,
        });
    }
    trimReceipts() {
        if (this.commandReceipts.size <= 512)
            return;
        const first = this.commandReceipts.keys().next();
        if (!first.done)
            this.commandReceipts.delete(first.value);
    }
    handleDisconnect() {
        const disconnectReason = chrome.runtime.lastError?.message;
        if (activeActor !== this)
            return;
        activeActor = null;
        this.closeLocalState();
        disconnectHandler?.(disconnectReason);
        scheduleReconnect();
    }
    failClosed() {
        if (this.closed)
            return;
        if (activeActor === this)
            activeActor = null;
        this.closeLocalState();
        try {
            this.port.disconnect();
        }
        catch { /* already disconnected */ }
        disconnectHandler?.();
        scheduleReconnect();
    }
    closeLocalState() {
        this.closed = true;
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.authority = null;
        this.handshake = null;
        this.commandReceipts.clear();
    }
}
const scheduleReconnect = () => {
    const now = Date.now();
    if (runCommandHandler && !activeActor && now >= immediateReconnectAt) {
        immediateReconnectAt = now + 1_000;
        connectNativeTransport();
    }
    if (runCommandHandler && !activeActor && !reconnectAlarmScheduled) {
        reconnectAlarmScheduled = true;
        chrome.alarms.create("grasseye-native-reconnect", { delayInMinutes: 0.5 });
    }
};
export const connectNativeTransport = () => {
    if (activeActor || !runCommandHandler)
        return;
    if (chrome.runtime.id !== GRASSEYE_BROWSER_EXTENSION_ID) {
        throw new Error("BROWSER_EXTENSION_ID_MISMATCH");
    }
    const port = chrome.runtime.connectNative(GRASSEYE_NATIVE_HOST_NAME);
    const actor = new NativePortActor(port, ++nextPortEpoch);
    activeActor = actor;
    actor.start();
};
export const configureNativeTransport = (input) => {
    runCommandHandler = input.runCommand;
    disconnectHandler = input.onDisconnect;
};
export const handleNativeReconnectAlarm = () => {
    reconnectAlarmScheduled = false;
    connectNativeTransport();
};
