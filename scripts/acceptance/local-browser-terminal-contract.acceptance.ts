import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { BrowserAuthorityWebSocket, parseBrowserAuthorityTargetClaim } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import { canonicalizeBrowserAuthorityValue, type BrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { decryptBrowserAuthorityFrame, encryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { cryptoBytes, decrypt, encrypt } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { BrowserArtifactRegistry } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";
import { decodeClientWebSocketFrames, encodeServerWebSocketTextFrame } from "../../src/app/workbench-browser-websocket-upgrade.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";

for (const path of ["src/lib/browser/chrome-extension/external-port-actor.ts", "src/lib/browser/transport/workbench-extension-channel.ts", "src/lib/browser/release/cws-extension-release-identity.ts", "src/lib/browser/release/browser-release-security-policy.schema.json"]) {
  assert.equal(existsSync(resolve(path)), false, `retired transport must be physically absent: ${path}`);
}
let revoked = "";
const wire: string[] = [];
const socket = { send: (frame: string) => wire.push(frame), close: () => undefined };
const channel = new BrowserAuthorityWebSocket({
  pairingSecret: "a".repeat(64),
  onPairingStarted: () => undefined,
  onHeartbeat: () => undefined,
  onAuthenticated: () => { throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE"); },
  onTargetClaim: () => undefined,
  onTargetRevoke: () => undefined,
  onDiagnostic: () => undefined,
  onRevoked: (reason) => { revoked = reason; },
});
assert.equal(channel.readOperatorPairingSecret(), "a".repeat(64), "The Workbench must reveal the current deterministic one-time test secret before authentication.");
channel.receive(socket, JSON.stringify({ protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "PAIR_HELLO", epoch: 0, sequence: 0, deadline: new Date(Date.now() + 10_000).toISOString(), body: { extensionId: "emkmbecadncngofidjgocmifhbonifgm", extensionVersion: "1.0.0", pairingSecret: "b".repeat(64) } }));
assert.equal(revoked, "BROWSER_AUTH_FRAME_INVALID");
assert.equal(wire.length, 0, "an invalid pre-auth frame must not emit a reply frame");
const [workspace, permit, journal, commandActor, targetLeaseManager, extensionSocket, extensionHeartbeat, authoritySocket, supervisor, webSocketUpgrade, frameCodec, protocolSchema, generatedProtocol] = await Promise.all([
  readFile("src/lib/browser/exact-target/browser-session-workspace.ts", "utf8"),
  readFile("src/lib/browser/transport/command-permit.ts", "utf8"),
  readFile("src/lib/browser/exact-target/browser-mutation-intent-journal.ts", "utf8"),
  readFile("src/lib/browser/exact-target/browser-command-actor.ts", "utf8"),
  readFile("src/lib/browser/exact-target/browser-target-lease-manager.ts", "utf8"),
  readFile("src/lib/browser/chrome-extension/websocket-actor.ts", "utf8"),
  readFile("src/lib/browser/chrome-extension/extension-heartbeat.ts", "utf8"),
  readFile("src/lib/browser/transport/browser-authority-websocket.ts", "utf8"),
  readFile("src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts", "utf8"),
  readFile("src/app/workbench-browser-websocket-upgrade.ts", "utf8"),
  readFile("src/lib/browser/transport/browser-authority-frame-codec.ts", "utf8"),
  readFile("src/lib/browser/protocol/browser-protocol.schema.json", "utf8"),
  readFile("src/lib/browser/protocol/generated/browser-protocol.generated.ts", "utf8"),
]);
const [targetAuthority, browserBlueprint] = await Promise.all([
  readFile("src/lib/browser/chrome-extension/extension-target-authority.ts", "utf8"),
  readFile("docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md", "utf8"),
]);
assert.match(browserBlueprint, /Workspace 和认证 certificate 不设置墙上时间到期/u,
  "the Browser blueprint must retain the connection-bound no-wall-clock-expiry contract");
assert.doesNotMatch(browserBlueprint, /8h non-renewable TTL|8 小时|8小时/u,
  "the Browser blueprint must reject the retired eight-hour Workspace contract");
assert.match(workspace, /SessionWorkspaceBindingV6/u);
assert.match(workspace, /connectionGeneration/u);
assert.match(workspace, /belongsTo/u);
assert.doesNotMatch(workspace, /expiresAt|eightHoursMs/u, "a claimed Workspace must not expire because wall-clock time passed");
assert.match(permit, /commandTtlMs/u);
assert.doesNotMatch(permit, /deadlineAt/u);
assert.match(journal, /PREPARED/u);
assert.match(journal, /"UNKNOWN"/u);
assert.match(commandActor, /transport reply requires owning-plugin outcome resolution/u);
assert.doesNotMatch(commandActor, /recordMutation\(this\.journal, journalEntry, "CONFIRMED"\)/u);
assert.match(
  commandActor,
  /error instanceof Error && \/\^BROWSER_\[A-Z_\]\+\$\/u\.test\(error\.message\)/u,
  "non-mutation browser failures must preserve their governed causal code in runtime logs",
);
assert.match(
  targetLeaseManager,
  /command\.kind === "navigate" \|\| command\.kind === "close-target"\) return "lifecycle"/u,
  "navigation and target close must use the extension registry lifecycle permit class",
);
assert.match(extensionSocket, /return Promise\.resolve\(\);/u, "repeating pair after authentication must be an idempotent no-op");
assert.match(extensionSocket, /releaseBuildId: __GRASSEYE_RELEASE_BUILD_ID__/u, "the service worker must bind its actually loaded build identity into pairing");
assert.match(extensionSocket, /failedFrameKind: frame\?\.kind \?\? "UNDECODED"/u, "the extension must report the failed authenticated frame kind");
assert.match(extensionSocket, /failedFrameSequence: frame\?\.sequence \?\? 0/u, "the extension must report the failed authenticated frame sequence");
assert.match(extensionSocket, /unhandledrejection/u, "the extension worker must capture unhandled promise failures for the Workbench terminal");
assert.match(extensionSocket, /worker-error/u, "the extension worker must capture global runtime failures for the Workbench terminal");
assert.match(extensionSocket, /diagnosticSource: "extension-runtime"/u, "global extension failures must use the authenticated diagnostic path");
assert.match(extensionSocket, /sendEncrypted\(this\.socket, "DIAGNOSTIC", body\)/u, "ordinary extension failures must be logged without revoking Browser Authority");
assert.doesNotMatch(extensionSocket, /sendEncrypted\(this\.socket, "DIAGNOSTIC", body\)[\s\S]{0,500}this\.clearPairing\(\)/u, "ordinary extension diagnostics must not clear a successful pairing");
assert.match(extensionHeartbeat, /void this\.sendLivenessPulse\(socket\)/u, "authentication must immediately reset the MV3 worker idle timer before the first interval");
assert.match(extensionHeartbeat, /await this\.chromeApi\.runtime\.getPlatformInfo\(\)/u, "the 20-second liveness pulse must invoke one Chrome extension API before the encrypted heartbeat");
assert.match(extensionHeartbeat, /await this\.send\(socket\)/u, "the heartbeat owner must send only through its injected authenticated channel");
assert.match(extensionSocket, /\(socket\) => this\.sendEncrypted\(socket, "HEARTBEAT", \{\}\)/u, "the liveness pulse must retain the sole authenticated WebSocket heartbeat");
assert.match(extensionSocket, /socket\?\.close\(4000, reasonCode\)/u, "every programmatic extension close must expose its reason to the Workbench terminal");
assert.doesNotMatch(extensionSocket, /socket\?\.close\(\)/u, "the extension must not retain an anonymous programmatic close path");
assert.match(extensionSocket, /await this\.targetAuthority\.releaseActiveTarget\(false\)/u, "a closed authenticated socket must physically release the stale debugger target before the next operator pairing");
assert.doesNotMatch(extensionSocket, /MAX_RECONNECT_ATTEMPTS|reconnectAttempts|grasseye-browser-authority-wake/u, "one-time pairing must not leave a fake reconnect or alarm path that cannot authenticate");
assert.match(extensionSocket, /runtimeEventType: "debugger-detach"/u, "unexpected debugger detach must reach the structured Workbench terminal while the authenticated socket is available");
assert.match(authoritySocket, /if \(frame\.kind === "DIAGNOSTIC"\)/u, "the Workbench must accept a non-fatal encrypted extension diagnostic frame");
assert.match(authoritySocket, /BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID/u, "a cached pre-build-identity worker must fail with an exact release identity reason");
assert.match(authoritySocket, /failedFrameSequence: String\(nonNegativeIntegerField\(body, "failedFrameSequence"\)\)/u, "the Workbench diagnostic refs must retain the failed frame sequence");
assert.match(authoritySocket, /refs\.encodedByteLength = String/u, "the Workbench diagnostic refs must retain the failed encoded byte length without raw payload");
assert.match(authoritySocket, /refs\.targetRef = body\.targetRef\.slice/u, "the Workbench diagnostic refs must identify the detached governed target without exposing page data");
assert.match(extensionSocket, /\{ requestSequence, permitSequence, replyChannelToken, result \}/u, "an extension reply must echo transport and permit sequences as separate identities");
assert.match(extensionSocket, /\{ requestSequence, permitSequence, replyChannelToken, errorCode:/u, "an extension failure reply must preserve both sequence domains");
assert.match(authoritySocket, /permitSequence !== reply\.permitSequence/u, "the Workbench must validate the permit sequence independently from transport request correlation");
assert.match(commandActor, /reply\.permitSequence !== permit\.sequence/u, "the command actor must compare only the command permit sequence, never the WebSocket frame sequence");
assert.doesNotMatch(commandActor, /reply\.transportSequence !== permit\.sequence/u, "transport frame ordering must never be compared with target-lease command ordering");
assert.match(targetAuthority, /await this\.send\("TARGET_CLAIM", this\.targets\.describeOperatorClaim\(next,/u, "navigation must publish the new exact Document before returning its terminal reply");
assert.match(targetLeaseManager, /const currentTarget = this\.resolveCurrentTarget\(\)/u, "every queued browser command must refresh the exact Document from the sole Broker before permit issuance");
assert.match(targetLeaseManager, /state\.current = currentTarget/u, "a lawful advanced Document must replace the execution lease's stale cached Document");
assert.match(supervisor, /onRevoked: \(reasonCode, refs\)/u, "the supervisor must forward extension diagnostic refs into the runtime log spine");
assert.match(supervisor, /RuntimeLogEventType\.BROWSER_EXTENSION_FAILURE/u, "authenticated extension runtime failures must become a dedicated terminal event");
assert.match(supervisor, /input\.releaseBuildId !== release\.releaseBuildId/u, "Workbench must reject a stale cached service worker build");
assert.match(supervisor, /Browser Authority 保持有效/u, "non-authentication diagnostics must explicitly preserve Browser Authority");
assert.doesNotMatch(supervisor, /45_000/u, "the authority certificate must not expire 45 seconds after pairing");
assert.doesNotMatch(webSocketUpgrade, /MAX_(?:SOCKET|WEBSOCKET|FRAME|PAYLOAD)_BYTES/u, "the transport must not impose an implementation byte ceiling on an owner-admitted command");
assert.doesNotMatch(webSocketUpgrade, /BROWSER_BACKPRESSURE/u, "WebSocket length encoding must not become a business-input rejection gate");
assert.match(webSocketUpgrade, /writeBigUInt64BE/u, "server frames must use the RFC 6455 64-bit length form when required");
assert.match(webSocketUpgrade, /readBigUInt64BE/u, "client frames must accept the RFC 6455 64-bit length form when required");
assert.doesNotMatch(frameCodec, /BROWSER_(?:AUTHORITY|CONTROL)_MAX_FRAME_BYTES/u, "the authenticated frame codec must not restore a hidden prompt byte ceiling");
assert.doesNotMatch(frameCodec, /BROWSER_BACKPRESSURE/u, "the authenticated frame codec must not reject an owner-admitted prompt by encoded byte length");
assert.equal("controlFrameMaxBytes" in JSON.parse(protocolSchema).transport, false, "the source protocol must not declare a prompt/control-message byte ceiling");
assert.equal(JSON.parse(protocolSchema).liveness.missedHeartbeatToleranceMs, 2_700_000, "missing heartbeat tolerance must be 45 minutes, not 45 seconds");
assert.equal(JSON.parse(protocolSchema).liveness.authorityLifetime, "authenticated-connection", "authority must live for the authenticated connection rather than a wall-clock ceiling");
assert.equal("authorityMaxMs" in JSON.parse(protocolSchema).liveness, false, "the protocol must not restore an eight-hour authority expiry");
assert.doesNotMatch(supervisor, /approveSessionWorkspace|installSessionWorkspaceApproval/u, "pair plus claim must physically replace the second workspace approval path");
assert.match(supervisor, /establishClaimBoundWorkspace/u, "target claim must establish the connection-bound Workspace before the claim becomes available");
assert.equal(JSON.parse(protocolSchema).frameKinds.includes("DIAGNOSTIC"), true, "the authenticated protocol must have a non-fatal extension diagnostic frame");
assert.doesNotMatch(generatedProtocol, /BROWSER_CONTROL_FRAME_MAX_BYTES/u, "the generated protocol projection must not resurrect the deleted byte ceiling");
const operatorChannel = new BrowserAuthorityWebSocket({
  pairingSecret: null,
  onPairingStarted: () => undefined,
  onHeartbeat: () => undefined,
  onAuthenticated: () => { throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE"); },
  onTargetClaim: () => undefined,
  onTargetRevoke: () => undefined,
  onDiagnostic: () => undefined,
  onRevoked: () => undefined,
});
assert.match(operatorChannel.readOperatorPairingSecret() ?? "", /^[a-f0-9]{64}$/u, "The production channel must mint a memory-only 256-bit pairing secret when no environment secret is supplied.");

const crossRuntimeKey = Buffer.from(Array.from({ length: 32 }, (_unused, index) => index));
const extensionKey = await globalThis.crypto.subtle.importKey("raw", cryptoBytes(crossRuntimeKey), "AES-GCM", false, ["encrypt", "decrypt"]);
const deadline = new Date(Date.now() + 10_000).toISOString();
const serverHeader = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "READY" as const, epoch: 1, sequence: 7, deadline };
const serverPlaintext = canonicalizeBrowserAuthorityValue({ authorityRef: "authority:test" });
const serverEncrypted = encryptBrowserAuthorityFrame({
  key: crossRuntimeKey,
  direction: "server-to-client",
  epoch: serverHeader.epoch,
  sequence: serverHeader.sequence,
  aad: canonicalizeBrowserAuthorityValue(serverHeader),
  plaintext: serverPlaintext,
});
const extensionDecrypted = await decrypt(extensionKey, "server-to-client", { ...serverHeader, body: { encrypted: serverEncrypted } } as BrowserAuthorityFrame);
assert.deepEqual(extensionDecrypted, { authorityRef: "authority:test" }, "The extension must decrypt a server frame using header-only AAD.");

const clientHeader = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "HEARTBEAT" as const, epoch: 1, sequence: 8, deadline };
const clientEncrypted = await encrypt(extensionKey, "client-to-server", clientHeader, {});
const clientDecrypted = decryptBrowserAuthorityFrame({
  key: crossRuntimeKey,
  direction: "client-to-server",
  epoch: clientHeader.epoch,
  sequence: clientHeader.sequence,
  aad: canonicalizeBrowserAuthorityValue(clientHeader),
  encrypted: clientEncrypted,
});
assert.equal(clientDecrypted, "{}", "The Workbench must decrypt an extension frame using the same header-only AAD.");

const maskedControlFrame = (opcode: 0x8 | 0x9, payload: Buffer): Buffer => {
  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.byteLength; index += 1) masked[index] = masked[index]! ^ mask[index % 4]!;
  return Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | payload.byteLength]), mask, masked]);
};
const maskedDataFrame = (firstByte: number, payload: Buffer): Buffer => {
  const mask = Buffer.from([4, 3, 2, 1]);
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.byteLength; index += 1) masked[index] = masked[index]! ^ mask[index % 4]!;
  return Buffer.concat([Buffer.from([firstByte, 0x80 | payload.byteLength]), mask, masked]);
};
const pingPayload = Buffer.from("ok", "utf8");
const ping = decodeClientWebSocketFrames(maskedControlFrame(0x9, pingPayload));
assert.equal(ping.closed, false);
assert.deepEqual(ping.payloads, []);
assert.deepEqual(ping.controlReplies[0], Buffer.concat([Buffer.from([0x8a, pingPayload.byteLength]), pingPayload]), "A browser ping must receive a bounded pong instead of being misreported as an invalid auth frame.");
const close = decodeClientWebSocketFrames(maskedControlFrame(0x8, Buffer.from([0x03, 0xe8])));
assert.equal(close.closed, true, "A normal browser close frame must become channel-unavailable, not BROWSER_AUTH_FRAME_INVALID.");
assert.equal(close.closeCode, 1000, "The Workbench must retain the peer WebSocket close code for structured transport diagnostics.");
const fragmented = decodeClientWebSocketFrames(Buffer.concat([
  maskedDataFrame(0x01, Buffer.from("owner-", "utf8")),
  maskedDataFrame(0x80, Buffer.from("admitted", "utf8")),
]));
assert.deepEqual(fragmented.payloads, ["owner-admitted"], "standard continuation frames must reassemble into the same authenticated message without a second transport");
assert.equal(fragmented.rest.byteLength, 0);
const largeServerPayload = "x".repeat(100_000_000);
const largeServerFrame = encodeServerWebSocketTextFrame(largeServerPayload);
assert.equal(largeServerFrame[1], 127, "A localization command above historical 64 KiB/512 KiB/1 MiB gates must use the legal 64-bit WebSocket frame length.");
assert.equal(largeServerFrame.readBigUInt64BE(2), BigInt(Buffer.byteLength(largeServerPayload)), "The 64-bit frame header must bind the exact payload byte length.");
assert.equal(parseBrowserAuthorityTargetClaim({
  targetRef: "target-first",
  documentRef: "document-first",
  navigationEpoch: 0,
  url: "https://chatgpt.com/",
  title: "ChatGPT",
}).navigationEpoch, 0, "The first claimed document generation is lawfully epoch zero.");
assert.throws(() => parseBrowserAuthorityTargetClaim({
  targetRef: "target-invalid",
  documentRef: "document-invalid",
  navigationEpoch: -1,
  url: "https://chatgpt.com/",
  title: "ChatGPT",
}), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);

const registryFixture = await mkdtemp(join(tmpdir(), "browser-artifact-registry-"));
const allowedRoot = join(registryFixture, "upload-attempts");
const stagedFile = join(allowedRoot, "attempt-1", "proof.txt");
const outsideFile = join(registryFixture, "outside.txt");
await mkdir(join(allowedRoot, "attempt-1"), { recursive: true });
await writeFile(stagedFile, "approved-browser-artifact", "utf8");
await writeFile(outsideFile, "outside-browser-artifact", "utf8");
const approvedBytes = await readFile(stagedFile);
const approvedHash = `sha256:${createHash("sha256").update(approvedBytes).digest("hex")}` as const;
const registry = new BrowserArtifactRegistry(allowedRoot);
try {
  await registry.registerArtifact({
    artifactRef: "approved",
    filePath: stagedFile,
    contentHash: approvedHash,
    sizeBytes: approvedBytes.byteLength,
  });
  assert.equal((await registry.resolveArtifact("approved")).canonicalPath, await realpath(stagedFile));
  await assert.rejects(
    registry.registerArtifact({
      artifactRef: "outside",
      filePath: outsideFile,
      contentHash: `sha256:${"0".repeat(64)}`,
      sizeBytes: 24,
    }),
    /BROWSER_FILE_GRANT_INVALID/u,
  );
  await assert.rejects(
    registry.registerArtifact({
      artifactRef: "tampered-hash",
      filePath: stagedFile,
      contentHash: `sha256:${"0".repeat(64)}`,
      sizeBytes: approvedBytes.byteLength,
    }),
    /BROWSER_FILE_GRANT_INVALID/u,
  );
} finally {
  await rm(registryFixture, { recursive: true, force: true });
}

const lockFixture = await mkdtemp(join(tmpdir(), "browser-owner-lock-"));
const lockPath = join(lockFixture, "browser", "owner.lock");
await mkdir(join(lockFixture, "browser"), { recursive: true });
await writeFile(lockPath, "2147483647\n", { encoding: "utf8", mode: 0o600 });
const recoveredLock = new BrowserOwnerLock(lockPath);
try {
  await recoveredLock.acquire();
  const competingLock = new BrowserOwnerLock(lockPath);
  await assert.rejects(competingLock.acquire(), /BROWSER_DUAL_ACTIVE_WORKER/u);
} finally {
  await recoveredLock.release();
  await rm(lockFixture, { recursive: true, force: true });
}
console.log("LOCAL_BROWSER_TERMINAL_CONTRACT_ACCEPTANCE_PASS");
