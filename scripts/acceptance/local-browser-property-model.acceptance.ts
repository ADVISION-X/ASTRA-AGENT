import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { webcrypto } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalizeBrowserAuthorityValue, decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { canonicalBrowserAuthorityPlaintext, encryptedFrameBody, parseCanonicalPlaintext } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import { decryptBrowserAuthorityFrame, encryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { BrowserAuthorityWebSocket, type BrowserAuthoritySocket } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import {
  BrowserCommandActor,
  BrowserCommandTerminalReplyError,
  type BrowserGovernedCommand,
} from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { BROWSER_PROTOCOL_REVISION, type BrowserCapabilityId } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { base64Url, cryptoBytes, decrypt as extensionDecrypt, deriveKeys, encrypt as extensionEncrypt,
  fromBase64Url, hmac, publicSigningJwk, signaturePayload } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

for (let sequence = 0; sequence < 64; sequence += 1) {
  const frame = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "HEARTBEAT" as const, epoch: 1, sequence, deadline: new Date(Date.now() + 10_000).toISOString(), body: {} };
  assert.deepEqual(decodeBrowserAuthorityFrame(encodeBrowserAuthorityFrame(frame)), frame);
}

const invocationPayloads = [
  { permit: { authorityEpoch: 7, exactCallIdentityHash: "sha256:fill" }, command: { kind: "dom-intent", intent: { kind: "fill", approvedText: "private prompt alpha" } } },
  { requestSequence: 2, permitSequence: 2, replyChannelToken: "reply:dom", result: { outerHtml: "<article>private answer beta</article>", semanticText: "private answer beta" } },
  { permit: { authorityEpoch: 7, exactCallIdentityHash: "sha256:file" }, command: { kind: "file-input",
    approvedFiles: [{ grantRef: "grant-private", contentHash: `sha256:${"a".repeat(64)}`, maxBytes: 1_024 }],
    resolvedFilePaths: ["/private/tmp/private-upload-gamma.pdf"] } },
  { permit: { authorityEpoch: 7, exactCallIdentityHash: "sha256:select" }, command: { kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/private-delta" } } },
  { requestSequence: 5, permitSequence: 5, replyChannelToken: "reply:media", result: { bytesBase64: "cHJpdmF0ZS1tZWRpYS1lcHNpbG9u" } },
] as const;
const rawPayloadFragments = [
  "private prompt alpha", "private answer beta", "private-upload-gamma.pdf",
  "private-delta", "cHJpdmF0ZS1tZWRpYS1lcHNpbG9u",
] as const;
const invocationKey = Buffer.alloc(32, 17);
for (const [index, payload] of invocationPayloads.entries()) {
  const header = {
    protocolVersion: BROWSER_PROTOCOL_REVISION,
    kind: index === 1 || index === 4 ? "REPLY" as const : "COMMAND" as const,
    epoch: 7,
    sequence: index + 1,
    deadline: new Date(Date.now() + 10_000).toISOString(),
  };
  const direction = header.kind === "REPLY" ? "client-to-server" as const : "server-to-client" as const;
  const aad = canonicalizeBrowserAuthorityValue(header);
  const plaintext = canonicalBrowserAuthorityPlaintext(payload);
  const encrypted = encryptBrowserAuthorityFrame({
    key: invocationKey,
    direction,
    epoch: header.epoch,
    sequence: header.sequence,
    aad,
    plaintext,
  });
  const encoded = encodeBrowserAuthorityFrame({ ...header, body: { encrypted } });
  assert.deepEqual(Object.keys(decodeBrowserAuthorityFrame(encoded).body), ["encrypted"]);
  for (const fragment of rawPayloadFragments) assert.equal(encoded.includes(fragment), false,
    "closed invocation payload plaintext must never appear in the wire frame");
  const decrypted = decryptBrowserAuthorityFrame({
    key: invocationKey,
    direction,
    epoch: header.epoch,
    sequence: header.sequence,
    aad,
    encrypted: encryptedFrameBody(decodeBrowserAuthorityFrame(encoded)),
  });
  assert.deepEqual(parseCanonicalPlaintext(decrypted), payload,
    "the encrypted Browser frame must preserve the complete typed payload without truncation");
  const corruptedCiphertext = Buffer.from(encrypted.ciphertext, "base64url");
  corruptedCiphertext[0] = corruptedCiphertext[0]! ^ 1;
  assert.throws(() => decryptBrowserAuthorityFrame({
    key: invocationKey,
    direction,
    epoch: header.epoch,
    sequence: header.sequence,
    aad,
    encrypted: { ...encrypted, ciphertext: corruptedCiphertext.toString("base64url") },
  }), /authenticate data|BROWSER_AUTH_TRANSCRIPT_INVALID/iu,
  "modified invocation payload bytes must fail authenticated decryption");
}

const subtle = webcrypto.subtle as SubtleCrypto;
const pairingSecret = "7".repeat(64);
const signing = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const ecdh = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const deadline = new Date(Date.now() + 20_000).toISOString();
const hello = {
  extensionId: "emkmbecadncngofidjgocmifhbonifgm",
  extensionVersion: "1.0.0",
  releaseBuildId: "build-00000000-0000-4000-8000-000000000007",
  clientSigningPublicJwk: publicSigningJwk(await subtle.exportKey("jwk", signing.publicKey)),
  clientEcdhPublicKey: base64Url(new Uint8Array(await subtle.exportKey("raw", ecdh.publicKey))),
  deadline,
};
const sentFrames: string[] = [];
let closeCode: number | null = null;
let requireWalBeforeCommand = false;
let walDispatched = false;
const socket: BrowserAuthoritySocket = {
  send: (frame) => {
    if (decodeBrowserAuthorityFrame(frame).kind === "COMMAND" && requireWalBeforeCommand) {
      assert.equal(walDispatched, true, "the production socket must observe DISPATCHED before sending a mutation");
    }
    sentFrames.push(frame);
  },
  close: (code) => { closeCode = code ?? null; },
};
const hash = `sha256:${"0".repeat(64)}` as const;
let commandPermitKey = "";
const authority = new BrowserAuthorityWebSocket({
  pairingSecret,
  onPairingStarted: () => undefined,
  onHeartbeat: () => undefined,
  onAuthenticated: (input) => {
    commandPermitKey = input.commandPermitKey;
    return { authorityRef: "authority-wire-proof", authorityEpoch: 1,
      certificateHash: hash, channelSessionHash: hash, commandPermitKey: input.commandPermitKey };
  },
  onTargetClaim: () => undefined,
  onTargetRevoke: () => undefined,
  onDiagnostic: () => undefined,
  onRevoked: () => undefined,
});
authority.receive(socket, encodeBrowserAuthorityFrame({
  protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO", epoch: 0, sequence: 0,
  deadline, body: hello,
}));
const challengeFrame = decodeBrowserAuthorityFrame(sentFrames[0]!);
const challenge = challengeFrame.body as Readonly<Record<string, string>>;
const signingJwk = challenge.serverSigningPublicJwk;
if (!signingJwk || typeof signingJwk !== "object" || Array.isArray(signingJwk)
  || !Object.values(signingJwk).every((value) => typeof value === "string")) {
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
}
const challengeCore = {
  serverSigningPublicJwk: signingJwk as Readonly<Record<string, string>>,
  serverEcdhPublicKey: challenge.serverEcdhPublicKey!,
  challenge: challenge.challenge!,
};
const transcript = canonicalizeBrowserAuthorityValue({ hello, challenge: challengeCore });
const clientSignature = base64Url(new Uint8Array(await subtle.sign(
  { name: "ECDSA", hash: "SHA-256" }, signing.privateKey,
  cryptoBytes(signaturePayload("client", transcript)),
)));
authority.receive(socket, encodeBrowserAuthorityFrame({
  protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_PROOF", epoch: 0, sequence: 1,
  deadline, body: { clientSignature, clientPairingMac: await hmac(pairingSecret, "client", transcript) },
}));
assert.equal(closeCode, null);
assert.equal(sentFrames.length, 3, "the production socket must emit challenge, authenticated, and encrypted ready frames");
const serverEcdhKey = await subtle.importKey("raw", cryptoBytes(fromBase64Url(challengeCore.serverEcdhPublicKey)),
  { name: "ECDH", namedCurve: "P-256" }, false, []);
const sharedSecret = new Uint8Array(await subtle.deriveBits(
  { name: "ECDH", public: serverEcdhKey }, ecdh.privateKey, 256,
));
const directionalKeys = await deriveKeys(sharedSecret, pairingSecret, transcript);
const readyBody = await extensionDecrypt(directionalKeys.serverToClientKey, "server-to-client",
  decodeBrowserAuthorityFrame(sentFrames[2]!));
assert.equal(readyBody.commandPermitKey, commandPermitKey);

const permitAuthority = Object.freeze({
  authorityRef: "authority-wire-proof", authorityEpoch: 1, certificateHash: hash,
  channelSessionHash: hash, executionBindingHash: hash, writerFenceHash: hash,
  candidateHash: hash, contractManifestHash: hash,
  jobId: "job-wire-proof", resultRevision: 0, attemptId: "attempt-wire-proof", deviceId: "device-wire-proof",
  leaseVersion: 1, localOrderId: "order-wire-proof", targetLeaseRef: "lease-wire-proof",
});

const permitFor = (
  sequence: number,
  capabilityId: BrowserCapabilityId,
  mutationClass: BrowserCommandPermit["mutationClass"],
): BrowserCommandPermit => ({
  ...permitAuthority,
  permitRef: `permit-${sequence}`,
  targetRef: "target-wire-proof", documentRef: "document-wire-proof", productStepId: "wire-proof",
  callId: `wire-call-${sequence}`, childCapabilityId: `wire-child-${sequence}`, inputHash: hash,
  replayPolicy: mutationClass === "mutation" ? "target-local-per-generation" : "observation-only",
  actionOrdinal: sequence, capabilityId, commandId: `command-${sequence}`, sequence, mutationClass,
  workspaceRef: "workspace-wire-proof", commandTtlMs: 20_000,
  replyChannelToken: `reply-wire-proof-${sequence}`, commandFrameMac: hash,
});

const wireCases: readonly Readonly<{
  capabilityId: BrowserCapabilityId;
  mutationClass: BrowserCommandPermit["mutationClass"];
  command: BrowserGovernedCommand;
  result: Readonly<Record<string, unknown>>;
  rawFragments: readonly string[];
}>[] = [
  { capabilityId: "browser.dom.fill.v1", mutationClass: "mutation",
    command: { kind: "dom-intent", intent: { kind: "fill", selector: "#prompt-textarea",
      approvedText: "private prompt alpha", clearBeforeType: true } }, result: { retained: true },
    rawFragments: ["private prompt alpha"] },
  { capabilityId: "browser.dom.inspect.v1", mutationClass: "observation",
    command: { kind: "dom-intent", intent: { kind: "inspect", selector: "article",
      fields: ["outerHtml", "semanticText"] } },
    result: { outerHtml: "<article>private answer beta</article>", semanticText: "private answer beta" },
    rawFragments: ["private answer beta"] },
  { capabilityId: "browser.file-input.v1", mutationClass: "mutation",
    command: { kind: "file-input", selector: "#upload-files",
      activation: { selector: "div.__menu-item[tabindex='0'] span",
        scope: { selector: "#thread-bottom div.popover[aria-busy='false']" },
        expectedTextEquals: "从电脑上传" },
      approvedFiles: [{ grantRef: "grant-private", contentHash: `sha256:${"a".repeat(64)}`, maxBytes: 1_024 }],
      resolvedFilePaths: ["/private/tmp/private-upload-gamma.pdf"] }, result: { attached: true },
    rawFragments: ["private-upload-gamma.pdf"] },
  { capabilityId: "browser.dom.click.v1", mutationClass: "lifecycle",
    command: { kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/private-delta" } },
    result: { documentRef: "document:selected", targetRef: "target:selected", navigationEpoch: 2 },
    rawFragments: ["private-delta"] },
  { capabilityId: "browser.authenticated-media.v1", mutationClass: "observation",
    command: { kind: "authenticated-media",
      canonicalConversationUrl: invocationPayloads[3].command.intent.canonicalConversationUrl,
      userTurnId: "conversation-turn-5",
      semanticMediaId: "gpt-generated-image-main" },
    result: { bytesBase64: "cHJpdmF0ZS1tZWRpYS1lcHNpbG9u" },
    rawFragments: ["cHJpdmF0ZS1tZWRpYS1lcHNpbG9u"] },
];
let clientSequence = 2;
for (const [index, wireCase] of wireCases.entries()) {
  const permit = permitFor(index + 1, wireCase.capabilityId, wireCase.mutationClass);
  const sentBefore: number = sentFrames.length;
  requireWalBeforeCommand = wireCase.mutationClass === "mutation";
  walDispatched = false;
  const replyPromise = authority.send(
    permit,
    wireCase.command,
    requireWalBeforeCommand ? () => { walDispatched = true; } : undefined,
  );
  requireWalBeforeCommand = false;
  const commandFrameEncoded: string = sentFrames[sentBefore]!;
  for (const fragment of wireCase.rawFragments) assert.equal(commandFrameEncoded.includes(fragment), false);
  const commandFrame = decodeBrowserAuthorityFrame(commandFrameEncoded);
  assert.deepEqual(await extensionDecrypt(directionalKeys.serverToClientKey, "server-to-client", commandFrame),
    { permit, command: wireCase.command });
  await assert.rejects(extensionDecrypt(directionalKeys.serverToClientKey, "client-to-server", commandFrame),
    /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  const replyHeader = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "REPLY" as const,
    epoch: 1, sequence: clientSequence++, deadline: new Date(Date.now() + 20_000).toISOString() };
  const replyBody = { requestSequence: commandFrame.sequence, permitSequence: permit.sequence,
    replyChannelToken: permit.replyChannelToken, result: wireCase.result };
  const replyEncoded = encodeBrowserAuthorityFrame({ ...replyHeader, body: {
    encrypted: await extensionEncrypt(directionalKeys.clientToServerKey, "client-to-server", replyHeader, replyBody),
  } });
  for (const fragment of wireCase.rawFragments) assert.equal(replyEncoded.includes(fragment), false);
  authority.receive(socket, replyEncoded);
  assert.deepEqual((await replyPromise).result, wireCase.result);
}

const gracePermit = { ...permitFor(20, "browser.dom.click.v1", "mutation"), commandTtlMs: 50 };
const graceCommand = { kind: "dom-intent" as const, intent: {
  kind: "click" as const, selector: "button", expectedMatches: 1,
  postClickMatch: { selector: "done", expectedMatches: 1 },
} };
const graceSentBefore = sentFrames.length;
let graceDispatches = 0;
const graceReplyPromise = authority.send(gracePermit, graceCommand, () => { graceDispatches += 1; });
const graceCommandFrame = decodeBrowserAuthorityFrame(sentFrames[graceSentBefore]!);
await new Promise<void>((resolve) => setTimeout(resolve, 100));
assert.ok(Date.parse(graceCommandFrame.deadline) < Date.now(),
  "the command authorization deadline must remain unchanged during terminal reply grace");
const graceReplyHeader = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "REPLY" as const,
  epoch: 1, sequence: clientSequence++, deadline: new Date(Date.now() + 20_000).toISOString() };
authority.receive(socket, encodeBrowserAuthorityFrame({ ...graceReplyHeader, body: {
  encrypted: await extensionEncrypt(directionalKeys.clientToServerKey, "client-to-server",
    graceReplyHeader, { requestSequence: graceCommandFrame.sequence, permitSequence: gracePermit.sequence,
      replyChannelToken: gracePermit.replyChannelToken, result: { postconditionVerified: true } }),
} }));
assert.deepEqual((await graceReplyPromise).result, { postconditionVerified: true });
assert.equal(graceDispatches, 1);
assert.equal(sentFrames.length, graceSentBefore + 1,
  "terminal reply grace must not issue a second permit or resend the mutation");

const chainRoot = await mkdtemp(join(tmpdir(), "browser-reply-chain-"));
const chainStore = new BrowserMutationStore(chainRoot);
try {
  const chainActor = new BrowserCommandActor(
    new BrowserCommandAdmissionBudget(),
    authority,
    chainStore,
    { assertCurrentAuthority: () => undefined },
    createRuntimeLogger({
      producer: "browser-reply-chain-acceptance",
      owner: "browser-session",
      component: "browser-command",
      terminalEnabled: false,
      fileSink: { directoryPath: join(chainRoot, "runtime-logs") },
    }),
  );
  const terminalErrorPermit = permitFor(30, "browser.dom.click.v1", "mutation");
  const terminalErrorSentBefore = sentFrames.length;
  const terminalErrorPromise = chainActor.execute(terminalErrorPermit, graceCommand);
  const terminalErrorCommandFrame = decodeBrowserAuthorityFrame(sentFrames[terminalErrorSentBefore]!);
  const terminalErrorHeader = {
    protocolVersion: BROWSER_PROTOCOL_REVISION,
    kind: "REPLY" as const,
    epoch: 1,
    sequence: clientSequence++,
    deadline: new Date(Date.now() + 20_000).toISOString(),
  };
  authority.receive(socket, encodeBrowserAuthorityFrame({ ...terminalErrorHeader, body: {
    encrypted: await extensionEncrypt(
      directionalKeys.clientToServerKey,
      "client-to-server",
      terminalErrorHeader,
      {
        requestSequence: terminalErrorCommandFrame.sequence,
        permitSequence: terminalErrorPermit.sequence,
        replyChannelToken: terminalErrorPermit.replyChannelToken,
        errorCode: "BROWSER_DOM_CANDIDATE_MISSING",
      },
    ),
  } }));
  await assert.rejects(terminalErrorPromise, /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(chainStore.readCommand(terminalErrorPermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(chainStore.readMutationOutcome(terminalErrorPermit.commandId), "dispatched");
  assert.equal(sentFrames.length, terminalErrorSentBefore + 1,
    "an explicit authenticated error reply must terminalize without a second dispatch");

  for (const [caseName, terminalErrorFor] of [
    ["wrong-reply-token", (permit: BrowserCommandPermit) => new BrowserCommandTerminalReplyError(
      "BROWSER_DOM_CANDIDATE_MISSING",
      `${permit.replyChannelToken}:forged`,
      permit.sequence,
      permit.sequence,
    )],
    ["wrong-permit-sequence", (permit: BrowserCommandPermit) => new BrowserCommandTerminalReplyError(
      "BROWSER_DOM_CANDIDATE_MISSING",
      permit.replyChannelToken,
      permit.sequence,
      permit.sequence + 1,
    )],
  ] as const) {
    const forgedPermit = permitFor(
      caseName === "wrong-reply-token" ? 31 : 32,
      "browser.dom.click.v1",
      "mutation",
    );
    let forgedDispatches = 0;
    const forgedActor = new BrowserCommandActor(
      new BrowserCommandAdmissionBudget(),
      {
        send: async (permit, _command, onDispatched) => {
          onDispatched?.();
          forgedDispatches += 1;
          throw terminalErrorFor(permit);
        },
      },
      chainStore,
      { assertCurrentAuthority: () => undefined },
      createRuntimeLogger({
        producer: `browser-reply-chain-${caseName}`,
        owner: "browser-session",
        component: "browser-command",
        terminalEnabled: false,
        fileSink: { directoryPath: join(chainRoot, `runtime-logs-${caseName}`) },
      }),
    );
    await assert.rejects(forgedActor.execute(forgedPermit, graceCommand), /BROWSER_COMMAND_RECEIPT_MISSING/u);
    assert.equal(chainStore.readCommand(forgedPermit.commandId)?.state ?? null, "DISPATCHED");
    assert.equal(chainStore.readMutationOutcome(forgedPermit.commandId), "dispatched");
    assert.equal(forgedDispatches, 1,
      `${caseName} must not counterfeit terminal settlement or authorize a second dispatch`);
  }

  const missingReplyPermit = {
    ...permitFor(33, "browser.dom.click.v1", "mutation"),
    commandTtlMs: 4_001,
  };
  const missingReplySentBefore = sentFrames.length;
  await assert.rejects(chainActor.execute(missingReplyPermit, graceCommand), /BROWSER_COMMAND_RECEIPT_MISSING/u);
  assert.equal(chainStore.readCommand(missingReplyPermit.commandId)?.state ?? null, "DISPATCHED");
  assert.equal(chainStore.readMutationOutcome(missingReplyPermit.commandId), "dispatched");
  assert.equal(sentFrames.length, missingReplySentBefore + 1,
    "a genuinely missing terminal reply must preserve one DISPATCHED WAL row without resend");
} finally {
  chainStore.close();
  await rm(chainRoot, { recursive: true, force: true });
}
console.log("LOCAL_BROWSER_PROPERTY_MODEL_ACCEPTANCE_PASS");
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-004-V48", evidenceMode: "exam.property", clauses: ["forbidden:0","forbidden:1","forbidden:9","summary"], locator: "acceptance:browser-terminal:frame-property-model", observedValue: "64 authenticated frame sequences round-trip exactly; encrypted invocation payloads remain complete and one-shot mutation replies never replay" });
