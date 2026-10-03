import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { webcrypto } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { absentPreflightEnvelope, originalFixtureFact, permit as actorPermit } from "./local-browser-terminal-fixture.js";
import { identity, terminalFact, exactHash } from "./local-browser-mutation-store-support.js";
import { browserExactCallIdentityHash } from "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { canonicalBrowserAuthorityPlaintext, encryptedFrameBody, parseCanonicalPlaintext } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { decryptBrowserAuthorityFrame, encryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { BrowserAuthorityWebSocket, type BrowserAuthoritySocket } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import { BrowserCommandActor, BrowserCommandTerminalReplyError, type BrowserGovernedCommand } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { BROWSER_PROTOCOL_REVISION, type BrowserCapabilityId } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { base64Url, cryptoBytes, decrypt as extensionDecrypt, deriveKeys, encrypt as extensionEncrypt,
  fromBase64Url, hmac, publicSigningJwk, signaturePayload } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const hash = `sha256:${"0".repeat(64)}` as const, invocationKey = Buffer.alloc(32, 17);
const payloads = [ { command: { kind: "fill", approvedText: "private prompt alpha" } },
  { result: { outerHtml: "<article>private answer beta</article>", semanticText: "private answer beta" } },
  { command: { kind: "file-input", approvedFiles: [{ grantRef: "grant-private", contentHash: hash, maxBytes: 1024 }],
    resolvedFilePaths: ["/private/tmp/private-upload-gamma.pdf"] } },
  { command: { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/private-delta" } },
  { result: { bytesBase64: "cHJpdmF0ZS1tZWRpYS1lcHNpbG9u" } } ];
const secrets = ["private prompt alpha", "private answer beta", "private-upload-gamma.pdf", "private-delta", "cHJpdmF0ZS1tZWRpYS1lcHNpbG9u"];
for (let sequence = 1; sequence <= 64; sequence += 1) {
  const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: sequence % 2 ? "COMMAND" as const : "REPLY" as const,
    epoch: 7, sequence, deadline: new Date(Date.now() + 10_000).toISOString() };
  const payload = payloads[(sequence - 1) % payloads.length]!, direction = header.kind === "REPLY" ? "client-to-server" as const : "server-to-client" as const;
  const aad = canonicalizeBrowserAuthorityValue(header), encrypted = encryptBrowserAuthorityFrame({ key: invocationKey, direction,
    epoch: 7, sequence, aad, plaintext: canonicalBrowserAuthorityPlaintext(payload) });
  const encoded = encodeBrowserAuthorityFrame({ ...header, body: { encrypted } }), frame = decodeBrowserAuthorityFrame(encoded);
  assert.deepEqual(decodeBrowserAuthorityFrame(encodeBrowserAuthorityFrame(frame)), frame);
  assert.deepEqual(Object.keys(frame.body), ["encrypted"]);
  for (const secret of secrets) assert.equal(encoded.includes(secret), false);
  const input = { key: invocationKey, direction, epoch: 7, sequence, aad, encrypted: encryptedFrameBody(frame) };
  assert.deepEqual(parseCanonicalPlaintext(decryptBrowserAuthorityFrame(input)), payload);
  const corrupted = Buffer.from(encrypted.ciphertext, "base64url"); corrupted[0] = corrupted[0]! ^ 1;
  assert.throws(() => decryptBrowserAuthorityFrame({ ...input, encrypted: { ...encrypted, ciphertext: corrupted.toString("base64url") } }));
  assert.throws(() => decryptBrowserAuthorityFrame({ ...input, direction: direction === "client-to-server" ? "server-to-client" : "client-to-server" }));
}

const subtle = webcrypto.subtle as SubtleCrypto, pairingSecret = "7".repeat(64);
const signing = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const ecdh = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const deadline = new Date(Date.now() + 20_000).toISOString();
const hello = { extensionId: "emkmbecadncngofidjgocmifhbonifgm", extensionVersion: "1.0.0",
  releaseBuildId: "build-00000000-0000-4000-8000-000000000007", deadline,
  clientSigningPublicJwk: publicSigningJwk(await subtle.exportKey("jwk", signing.publicKey)),
  clientEcdhPublicKey: base64Url(new Uint8Array(await subtle.exportKey("raw", ecdh.publicKey))) };
const frames: string[] = []; let requireWal = false, dispatched = false, closeCode: number | null = null, permitKey = "";
let store: BrowserMutationStore | null = null;
const socket: BrowserAuthoritySocket = { send: frame => { if (requireWal && decodeBrowserAuthorityFrame(frame).kind === "COMMAND") assert.equal(dispatched, true);
  frames.push(frame); }, close: code => { closeCode = code ?? null; } };
const channel = new BrowserAuthorityWebSocket({ pairingSecret, onPairingStarted: () => undefined, onHeartbeat: () => undefined,
  onAuthenticated: input => { permitKey = input.commandPermitKey; return { authorityRef: "authority-wire-proof", authorityEpoch: 1,
    certificateHash: hash, channelSessionHash: hash, commandPermitKey: permitKey }; },
  onMutationReceipt: (fact, acknowledge) => { store?.settleTerminalReceipt(fact); acknowledge(); }, onTargetClaim: () => undefined,
  onTargetRevoke: () => undefined, onDiagnostic: () => undefined, onRevoked: () => undefined });
channel.receive(socket, encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO", epoch: 0, sequence: 0, deadline, body: hello }));
const challenge = decodeBrowserAuthorityFrame(frames[0]!).body;
const challengeCore = { serverSigningPublicJwk: challenge.serverSigningPublicJwk as Readonly<Record<string, string>>,
  serverEcdhPublicKey: String(challenge.serverEcdhPublicKey), challenge: String(challenge.challenge) };
const transcript = canonicalizeBrowserAuthorityValue({ hello, challenge: challengeCore });
const signature = base64Url(new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signing.privateKey, cryptoBytes(signaturePayload("client", transcript)))));
channel.receive(socket, encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_PROOF", epoch: 0, sequence: 1,
  deadline, body: { clientSignature: signature, clientPairingMac: await hmac(pairingSecret, "client", transcript) } }));
assert.equal(closeCode, null); assert.equal(frames.length, 3);
const serverKey = await subtle.importKey("raw", cryptoBytes(fromBase64Url(challengeCore.serverEcdhPublicKey)), { name: "ECDH", namedCurve: "P-256" }, false, []);
const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: serverKey }, ecdh.privateKey, 256));
const keys = await deriveKeys(shared, pairingSecret, transcript);
assert.equal((await extensionDecrypt(keys.serverToClientKey, "server-to-client", decodeBrowserAuthorityFrame(frames[2]!))).commandPermitKey, permitKey);
const permitFor = (sequence: number, capabilityId: BrowserCapabilityId, mutationClass: "mutation" | "observation" | "lifecycle") => ({
  ...actorPermit(`wire-${sequence}`), authorityRef: "authority-wire-proof", certificateHash: hash, channelSessionHash: hash,
  sequence, actionOrdinal: sequence, capabilityId, mutationClass, commandTtlMs: 20_000,
  replayPolicy: mutationClass === "mutation" ? "target-local-per-generation" as const : "observation-only" as const });
const wireCases: readonly { capabilityId: BrowserCapabilityId; mutationClass: "mutation" | "observation" | "lifecycle";
  command: BrowserGovernedCommand; result: Record<string, unknown>; secret: string }[] = [
  { capabilityId: "browser.dom.fill.v1", mutationClass: "mutation", command: { kind: "dom-intent", intent: { kind: "fill",
    selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']", approvedText: secrets[0]!, clearBeforeType: true } },
    result: { filled: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1, postconditionVerified: true, retainedValueVerified: true }, secret: secrets[0]! },
  { capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", command: { kind: "dom-intent", intent: { kind: "inspect", selector: "article", fields: ["outerHtml", "semanticText"] } },
    result: { outerHtml: "<article>private answer beta</article>", semanticText: secrets[1]! }, secret: secrets[1]! },
  { capabilityId: "browser.file-input.v1", mutationClass: "mutation", command: { kind: "file-input", selector: "form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']",
    activation: { selector: "[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child",
      scope: { selector: "[data-composer-overlay-floating-ui='true']" }, expectedText: "上传" },
    approvedFiles: [{ grantRef: "grant-private", contentHash: hash, maxBytes: 1024 }], resolvedFilePaths: ["/private/tmp/private-upload-gamma.pdf"] },
    result: { candidateCount: 1, identityRevalidated: true, mutationCount: 1, postconditionVerified: true }, secret: secrets[2]! },
  { capabilityId: "browser.dom.click.v1", mutationClass: "lifecycle", command: { kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/private-delta" } },
    result: { documentRef: "document:selected", targetRef: "target:selected", navigationEpoch: 2 }, secret: secrets[3]! },
  { capabilityId: "browser.authenticated-media.v1", mutationClass: "observation", command: { kind: "authenticated-media", canonicalConversationUrl: "https://chatgpt.com/c/private-delta",
    userTurnId: "00000000-0000-4000-8000-000000000005", semanticMediaId: "gpt-generated-image-main" }, result: { bytesBase64: secrets[4]! }, secret: secrets[4]! },
];
let clientSequence = 2;
const deliver = async (request: ReturnType<typeof decodeBrowserAuthorityFrame>, body: Record<string, unknown>): Promise<void> => {
  const header = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "REPLY" as const, epoch: 1,
    sequence: clientSequence++, deadline: new Date(Date.now() + 20_000).toISOString() };
  const encoded = encodeBrowserAuthorityFrame({ ...header, body: { encrypted: await extensionEncrypt(keys.clientToServerKey, "client-to-server", header,
    { requestSequence: request.sequence, ...body }) } });
  for (const secret of secrets) assert.equal(encoded.includes(secret), false); channel.receive(socket, encoded);
};
for (const [index, item] of wireCases.entries()) {
  const permit = permitFor(index + 1, item.capabilityId, item.mutationClass);
  const result = item.mutationClass === "mutation" ? absentPreflightEnvelope(permit, item.result) : item.result;
  const fact = item.mutationClass === "mutation" ? originalFixtureFact(permit, item.command, result, { ...identity(permit.commandId, permit.attemptId),
    actionId: permit.capabilityId, exactCallIdentityHash: browserExactCallIdentityHash(permit), childCapabilityId: permit.childCapabilityId }) : null;
  const offset: number = frames.length; requireWal = item.mutationClass === "mutation"; dispatched = false;
  const pending = channel.send(permit, item.command, requireWal ? () => { dispatched = true; } : undefined, fact?.receiptBindingHash ?? null); requireWal = false;
  const request = decodeBrowserAuthorityFrame(frames[offset]!); assert.equal(frames[offset]!.includes(item.secret), false);
  assert.deepEqual(await extensionDecrypt(keys.serverToClientKey, "server-to-client", request), { permit, command: item.command, receiptBindingHash: fact?.receiptBindingHash ?? null });
  await assert.rejects(extensionDecrypt(keys.serverToClientKey, "client-to-server", request), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  await deliver(request, { permitSequence: permit.sequence, replyChannelToken: permit.replyChannelToken, result, mutationReceipt: fact });
  assert.deepEqual((await pending).result, result);
}
const click: BrowserGovernedCommand = { kind: "dom-intent", intent: { kind: "click", selector: "button", expectedMatches: 1, postClickMatch: { selector: "done", expectedMatches: 1 } } };
const grace = { ...permitFor(20, "browser.dom.click.v1", "mutation"), commandTtlMs: 50 }, graceOffset = frames.length;
const graceResult = absentPreflightEnvelope(grace, { clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
  postconditionVerified: true, postconditionRawCount: 1, postconditionEligibleCount: 1, postconditionRejections: [] });
const graceFact = originalFixtureFact(grace, click, graceResult, { ...identity(grace.commandId, grace.attemptId), actionId: grace.capabilityId });
let graceDispatches = 0;
const gracePending = channel.send(grace, click, () => { graceDispatches += 1; }, graceFact.receiptBindingHash), graceFrame = decodeBrowserAuthorityFrame(frames[graceOffset]!);
await new Promise<void>(resolve => setTimeout(resolve, 100)); assert.ok(Date.parse(graceFrame.deadline) < Date.now());
await deliver(graceFrame, { permitSequence: grace.sequence, replyChannelToken: grace.replyChannelToken, result: graceResult, mutationReceipt: graceFact });
assert.deepEqual((await gracePending).result, graceResult); assert.equal(graceDispatches, 1); assert.equal(frames.length, graceOffset + 2);
const root = await mkdtemp(join(tmpdir(), "browser-property-rebuild-"));
try {
  store = new BrowserMutationStore(root); store.verifyRuntimeTaskProvenance(null);
  const logger = createRuntimeLogger({ producer: "browser-property", owner: "browser-session", component: "browser-command",
    terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } });
  const actor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), channel, store, { assertCurrentAuthority: () => undefined }, logger);
  const permit = permitFor(30, "browser.dom.click.v1", "mutation"), offset = frames.length, pending = actor.execute(permit, click);
  const request = decodeBrowserAuthorityFrame(frames[offset]!);
  assert.equal(store.readCommand(permit.commandId)?.state, "DISPATCHED");
  const errorCode = "BROWSER_DOM_CANDIDATE_MISSING", fact = terminalFact(store.readCommand(permit.commandId)!.identity,
    { terminal: "rejected", mutationOutcome: "dispatched", failureCode: errorCode, resultHash: exactHash(canonicalizeBrowserAuthorityValue({ errorCode })) });
  await deliver(request, { permitSequence: permit.sequence, replyChannelToken: permit.replyChannelToken, errorCode, mutationReceipt: fact });
  await assert.rejects(pending, /BROWSER_DOM_CANDIDATE_MISSING/u); assert.equal(store.readCommand(permit.commandId)?.state, "REJECTED");
  assert.equal(store.readMutationOutcome(permit.commandId), "dispatched"); assert.equal(frames.length, offset + 2);
  for (const [index, forged] of ["token", "sequence"].entries()) {
    const isolated = new BrowserMutationStore(join(root, forged)); isolated.verifyRuntimeTaskProvenance(null); let dispatches = 0;
    const candidate = permitFor(31 + index, "browser.dom.click.v1", "mutation"), forgedActor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), {
      send: async (current, _command, dispatch) => { dispatch?.(); dispatches += 1; throw new BrowserCommandTerminalReplyError(errorCode,
        forged === "token" ? `${current.replyChannelToken}:forged` : current.replyChannelToken, current.sequence,
        forged === "sequence" ? current.sequence + 1 : current.sequence); } }, isolated, { assertCurrentAuthority: () => undefined }, logger);
    await assert.rejects(forgedActor.execute(candidate, click), /BROWSER_COMMAND_RECEIPT_MISSING/u);
    assert.equal(isolated.readCommand(candidate.commandId)?.state, "DISPATCHED"); assert.equal(dispatches, 1); isolated.close();
  }
  const missing = { ...permitFor(33, "browser.dom.click.v1", "mutation"), commandTtlMs: 4_001 }, missingOffset = frames.length;
  await assert.rejects(actor.execute(missing, click), /BROWSER_COMMAND_RECEIPT_MISSING/u);
  assert.equal(store.readCommand(missing.commandId)?.state, "DISPATCHED"); assert.equal(frames.length, missingOffset + 1);
  store.close(); store = null;
  let closes = 0; const timeoutSocket: BrowserAuthoritySocket = { send: () => undefined, close: () => { closes += 1; throw new Error("CLOSE_FAILED"); } };
  const timeoutChannel = new BrowserAuthorityWebSocket({ pairingSecret, onPairingStarted: () => undefined, onHeartbeat: () => undefined,
    onAuthenticated: () => { throw new Error("UNUSED"); }, onMutationReceipt: () => { throw new Error("UNUSED"); },
    onTargetClaim: () => undefined, onTargetRevoke: () => undefined, onDiagnostic: () => undefined, onRevoked: () => { throw new Error("LOG_FAILED"); } });
  Reflect.set(timeoutChannel, "active", { socket: timeoutSocket, keys: { clientToServer: Buffer.alloc(32, 1), serverToClient: Buffer.alloc(32, 1) },
    lastClientSequence: 1, nextServerSequence: 2, lastHeartbeatAt: Date.now(), replies: new Map() });
  await assert.rejects(timeoutChannel.send({ ...permitFor(99, "browser.dom.inspect.v1", "observation"), commandTtlMs: 1 }, wireCases[1]!.command),
    (error: unknown) => error instanceof Error && error.message === "BROWSER_COMMAND_RECEIPT_MISSING" && error.cause instanceof Error);
  assert.equal(closes, 1); assert.equal(Reflect.get(timeoutChannel, "active"), null);
} finally { store?.close(); await rm(root, { recursive: true, force: true }); }
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-004-V56", evidenceMode: "exam.property", clauses: ["forbidden:0"],
  locator: "acceptance:browser-terminal:frame-property-model", observedValue: "64 encrypted full-payload sequences, direction and ciphertext rejection, original WAL error receipts and single unknown dispatch exercised" });
console.log("native Browser encrypted property model exercised");
