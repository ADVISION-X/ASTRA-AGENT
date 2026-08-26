import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { BrowserAuthorityWebSocket, parseBrowserAuthorityTargetClaim } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import { canonicalizeBrowserAuthorityValue, type BrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { decryptBrowserAuthorityFrame, encryptBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-session-crypto.js";
import { cryptoBytes, decrypt, encrypt } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";
import { BrowserProofJournal, readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { decodeClientWebSocketFrames, encodeServerWebSocketTextFrame } from "../../src/app/workbench-browser-websocket-upgrade.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { runtimeInitializationDisposition } from "../../src/lib/local-runtime/workbench-status.js";
import { verifyBrowserSupervisorRestartContract } from "./local-browser-supervisor-restart.acceptance-support.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";
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
assert.deepEqual(
  runtimeInitializationDisposition("BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID"),
  {
    actionableMessage: "Keep Browser execution and claim blocked. With current human runtime-data and major law/schema authorization, stop the Browser Owner and run the explicit browser:journal:recover command; otherwise preserve the original journal and remain blocked.",
    ownerResponsible: "local-browser-session",
  },
  "journal integrity failure must expose one safe Owner-specific recovery action without auto-repair",
);
const [workspace, permit, journal, commandActor, targetLeaseManager, extensionSocket, extensionHeartbeat, authoritySocket, supervisor, webSocketUpgrade, frameCodec, protocolSchema, generatedProtocol, commandDiagnostic, actorDiagnostics] = await Promise.all([
  readFile("src/lib/browser/exact-target/browser-session-workspace.ts", "utf8"),
  readFile("src/lib/browser/transport/command-permit.ts", "utf8"),
  readFile("src/lib/browser/exact-target/browser-proof-journal.ts", "utf8"),
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
  readFile("src/lib/browser/chrome-extension/websocket-command-diagnostic.ts", "utf8"),
  readFile("src/lib/browser/chrome-extension/websocket-actor-diagnostics.ts", "utf8"),
]);
const extensionDiagnosticSources = `${extensionSocket}\n${commandDiagnostic}\n${actorDiagnostics}`;
const [targetAuthority, authorityBroker, pairingPage, extensionManifestText] = await Promise.all([
  readFile("src/lib/browser/chrome-extension/extension-target-authority.ts", "utf8"),
  readFile("src/lib/browser/infrastructure/browser-authority-broker.ts", "utf8"),
  readFile("src/lib/browser/chrome-extension/pairing.html", "utf8"),
  readFile("src/lib/browser/chrome-extension/manifest.json", "utf8"),
]);
const extensionManifest = JSON.parse(extensionManifestText) as { permissions?: unknown };
assert.match(workspace, /SessionWorkspaceBindingV6/u);
assert.match(workspace, /connectionGeneration/u);
assert.match(workspace, /belongsTo/u);
assert.doesNotMatch(workspace, /expiresAt|eightHoursMs/u, "a claimed Workspace must not expire because wall-clock time passed");
assert.match(permit, /commandTtlMs/u);
assert.doesNotMatch(permit, /deadlineAt/u);
assert.match(journal, /PREPARED/u);
assert.match(journal, /"UNKNOWN"/u);
assert.match(journal, /previousEntryHash/u);
assert.match(journal, /entryHash/u);
assert.match(journal, /fsyncSync/u);
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
assert.match(extensionDiagnosticSources, /failedFrameKind: frame\?\.kind \?\? "UNDECODED"/u, "the extension must report the failed authenticated frame kind");
assert.match(extensionDiagnosticSources, /failedFrameSequence: frame\?\.sequence \?\? 0/u, "the extension must report the failed authenticated frame sequence");
assert.match(extensionSocket, /unhandledrejection/u, "the extension worker must capture unhandled promise failures for the Workbench terminal");
assert.match(extensionSocket, /worker-error/u, "the extension worker must capture global runtime failures for the Workbench terminal");
assert.match(extensionDiagnosticSources, /diagnosticSource: "extension-runtime"/u, "global extension failures must use the authenticated diagnostic path");
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
assert.match(extensionDiagnosticSources, /runtimeEventType: "command-handler"/u, "authenticated command failures must reach the structured Workbench terminal");
assert.match(extensionDiagnosticSources, /commandStage/u, "command failure diagnostics must identify the failed command stage");
assert.match(extensionDiagnosticSources, /commandIntentKind/u, "DOM command failure diagnostics must identify the fixed intent kind without logging selector or payload content");
assert.match(extensionDiagnosticSources, /capabilityId/u, "command failure diagnostics must identify the governed capability without logging payload content");
assert.match(authoritySocket, /if \(frame\.kind === "DIAGNOSTIC"\)/u, "the Workbench must accept a non-fatal encrypted extension diagnostic frame");
assert.match(authoritySocket, /BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID/u, "a cached pre-build-identity worker must fail with an exact release identity reason");
assert.match(authoritySocket, /failedFrameSequence: String\(nonNegativeIntegerField\(body, "failedFrameSequence"\)\)/u, "the Workbench diagnostic refs must retain the failed frame sequence");
for (const field of ["commandStage", "commandKind", "commandIntentKind", "capabilityId"]) {
  assert.match(authoritySocket, new RegExp(`\\b${field}\\b`, "u"), `the Workbench terminal must retain the redacted command diagnostic field ${field}`);
}
assert.match(authoritySocket, /refs\.encodedByteLength = String/u, "the Workbench diagnostic refs must retain the failed encoded byte length without raw payload");
assert.match(authoritySocket, /refs\.targetRef = body\.targetRef\.slice/u, "the Workbench diagnostic refs must identify the detached governed target without exposing page data");
assert.match(extensionSocket, /\{ requestSequence, permitSequence, replyChannelToken, result \}/u, "an extension reply must echo transport and permit sequences as separate identities");
assert.match(extensionSocket, /\{ requestSequence, permitSequence, replyChannelToken, errorCode:/u, "an extension failure reply must preserve both sequence domains");
assert.match(authoritySocket, /permitSequence !== reply\.permitSequence/u, "the Workbench must validate the permit sequence independently from transport request correlation");
assert.match(commandActor, /reply\.permitSequence !== permit\.sequence/u, "the command actor must compare only the command permit sequence, never the WebSocket frame sequence");
assert.doesNotMatch(commandActor, /reply\.transportSequence !== permit\.sequence/u, "transport frame ordering must never be compared with target-lease command ordering");
assert.match(targetAuthority, /await this\.publishMainFrameNavigation/u, "navigation must publish the new exact Document before returning its terminal reply");
assert.match(targetAuthority, /navigationPublication/u, "a main-frame event and command navigation must share one acknowledged Document publication");
assert.match(extensionSocket, /await this\.targetAuthority\.claimPreauthorizedChatGptTarget\(\)/u, "READY must trigger the fixed extension target owner");
assert.doesNotMatch(extensionSocket, /GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget/u, "the manual active-tab claim path must be physically absent");
assert.deepEqual(extensionManifest.permissions, ["debugger", "alarms"], "the fixed extension must retain only its exact automatic-claim permissions");
assert.doesNotMatch(pairingPage, /claim-active-target|认领当前标签页|activeTab/u, "the popup must not restore the retired manual target-claim control");
assert.match(supervisor, /requireGptWebChatPolicyForUrl\(input\.url\)/u, "the server must revalidate the exact ChatGPT policy before Workspace establishment");
assert.match(authorityBroker, /current\.targetRef !== claim\.targetRef/u, "an existing claim must reject silent target replacement");
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
assert.match(
  supervisor,
  /await this\.ownerLock\.acquire\(\)[\s\S]*new BrowserProofJournal[\s\S]*this\.transport\.start\(\)/u,
  "the Browser Owner lock must be acquired before the proof journal tail is read and before transport starts",
);
assert.match(
  supervisor,
  /public async stop[\s\S]*this\.transport\.disconnect\(reasonCode\)[\s\S]*phase: "AUTHORITY_REVOKED"[\s\S]*await this\.ownerLock\.release\(\)/u,
  "shutdown must revoke Browser Authority before durably journaling revoke and releasing the Owner lock",
);
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

await verifyBrowserArtifactAndLockContracts();

const processLockFixture = await mkdtemp(join(tmpdir(), "browser-owner-process-lock-"));
const processLockPath = join(processLockFixture, "browser", "owner.lock");
const ownerLockModule = resolve("src/lib/browser/infrastructure/browser-owner-lock.ts");
const ownerChildSource = `
const { BrowserOwnerLock } = await import(process.env.OWNER_LOCK_MODULE);
const lock = new BrowserOwnerLock(process.env.OWNER_LOCK_PATH);
try {
  await lock.acquire();
  process.stdout.write("ACQUIRED\\n");
  if (process.env.HOLD_OWNER === "1") {
    const keepAlive = setInterval(() => undefined, 1_000);
    process.on("SIGTERM", async () => { clearInterval(keepAlive); await lock.release(); process.exit(0); });
    await new Promise(() => undefined);
  }
  await lock.release();
} catch (error) {
  process.stdout.write((error instanceof Error ? error.message : String(error)) + "\\n");
}
`;
const spawnOwner = (hold: boolean) => spawn(
  process.execPath,
  ["--import", "tsx", "--input-type=module", "--eval", ownerChildSource],
  {
    cwd: resolve("."),
    env: {
      ...process.env,
      OWNER_LOCK_MODULE: ownerLockModule,
      OWNER_LOCK_PATH: processLockPath,
      HOLD_OWNER: hold ? "1" : "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const activeOwnerProcess = spawnOwner(true);
let activeOwnerOutput = "";
activeOwnerProcess.stdout.setEncoding("utf8");
await new Promise<void>((resolveReady, rejectReady) => {
  activeOwnerProcess.stdout.on("data", (chunk: string) => {
    activeOwnerOutput += chunk;
    if (activeOwnerOutput.includes("ACQUIRED\n")) resolveReady();
  });
  activeOwnerProcess.once("exit", (code) => rejectReady(new Error(`owner process exited before ready: ${code}`)));
});
const competingOwnerProcess = spawnOwner(false);
let competingOwnerOutput = "";
competingOwnerProcess.stdout.setEncoding("utf8");
competingOwnerProcess.stdout.on("data", (chunk: string) => { competingOwnerOutput += chunk; });
await once(competingOwnerProcess, "exit");
assert.match(competingOwnerOutput, /BROWSER_DUAL_ACTIVE_WORKER/u, "two real OS processes must never own the Browser lock together");
activeOwnerProcess.kill("SIGTERM");
await once(activeOwnerProcess, "exit");
await rm(processLockFixture, { recursive: true, force: true });

const journalFixture = await mkdtemp(join(tmpdir(), "browser-proof-journal-restart-"));
const journalPath = join(journalFixture, "browser", "proof-events.ndjson");
const firstOwner = new BrowserOwnerLock(join(journalFixture, "browser", "owner.lock"));
const secondOwner = new BrowserOwnerLock(join(journalFixture, "browser", "owner.lock"));
const identity = {
  candidateHash: `sha256:${"1".repeat(64)}` as const,
  extensionId: "emkmbecadncngofidjgocmifhbonifgm",
  releaseBuildId: "release-build-journal-restart-v1",
};
const journalAuthorityRefHash = `sha256:${"5".repeat(64)}` as const;
const canonicalJournalValue = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonicalJournalValue)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalJournalValue(item)]))
    : value;
const journalEntryHash = (core: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalJournalValue(core))).digest("hex")}`;
try {
  assert.throws(
    () => new BrowserProofJournal(journalPath, identity, () => secondOwner.assertHeld()),
    /BROWSER_CONTROLLER_ALREADY_OWNED/u,
    "a waiting process must not read or cache the journal tail before it owns the Browser lock",
  );
  await firstOwner.acquire();
  const firstJournal = new BrowserProofJournal(journalPath, identity, () => firstOwner.assertHeld());
  firstJournal.recordLifecycle({ eventType: "LIFECYCLE", phase: "AUTHENTICATED", authorityRefHash: journalAuthorityRefHash });
  const firstEnvelope = readBrowserProofJournal(journalPath)[0]!;
  const corruptedCases = [
    { ...firstEnvelope, sequence: 2 },
    { ...firstEnvelope, previousEntryHash: `sha256:${"2".repeat(64)}` },
    { ...firstEnvelope, entryHash: `sha256:${"3".repeat(64)}` },
    { ...firstEnvelope, unexpected: true },
  ];
  for (const [index, corrupted] of corruptedCases.entries()) {
    const corruptedPath = join(journalFixture, `corrupted-${index}.ndjson`);
    await writeFile(corruptedPath, `${JSON.stringify(corrupted)}\n`, "utf8");
    assert.throws(
      () => readBrowserProofJournal(corruptedPath),
      /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u,
    );
  }
  const semanticEvent = { ...firstEnvelope.event, phase: "TARGET_CLAIMED" };
  const semanticCore = {
    schemaVersion: firstEnvelope.schemaVersion,
    sequence: firstEnvelope.sequence,
    previousEntryHash: firstEnvelope.previousEntryHash,
    event: semanticEvent,
  };
  const semanticInvalid = {
    ...semanticCore,
    entryHash: `sha256:${createHash("sha256").update(canonicalizeBrowserAuthorityValue(semanticCore)).digest("hex")}`,
  };
  const semanticInvalidPath = join(journalFixture, "semantic-invalid.ndjson");
  await writeFile(semanticInvalidPath, `${JSON.stringify(semanticInvalid)}\n`, "utf8");
  assert.throws(
    () => readBrowserProofJournal(semanticInvalidPath),
    /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u,
    "a correctly rehashed but phase-invalid lifecycle event must fail strict schema validation",
  );
  const schemaInvalidCore = {
    schemaVersion: firstEnvelope.schemaVersion,
    sequence: firstEnvelope.sequence,
    previousEntryHash: firstEnvelope.previousEntryHash,
    event: { ...firstEnvelope.event, phase: "IMPOSTOR_PHASE" },
  };
  const schemaInvalidPath = join(journalFixture, "schema-invalid.ndjson");
  await writeFile(schemaInvalidPath, `${JSON.stringify({ ...schemaInvalidCore, entryHash: journalEntryHash(schemaInvalidCore) })}\n`, "utf8");
  assert.throws(
    () => readBrowserProofJournal(schemaInvalidPath),
    /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u,
    "a hash-valid envelope with an invalid event schema must fail closed",
  );
  const commandEvent = {
    eventType: "COMMAND",
    phase: "PREPARED",
    commandId: "command:strict-schema",
    actionId: "browser.navigate.v1",
    commandKind: "navigate",
    workspaceRef: "workspace:strict-schema",
    authorityRef: "authority:strict-schema",
    authorityCertificateHash: `sha256:${"6".repeat(64)}`,
    executionBindingHash: `sha256:${"7".repeat(64)}`,
    executionFenceHash: `sha256:${"8".repeat(64)}`,
    candidateHash: identity.candidateHash,
    contractManifestHash: `sha256:${"9".repeat(64)}`,
    ownerPluginId: "owner:strict-schema",
    jobId: "job:strict-schema",
    attemptId: "attempt:strict-schema",
    deviceId: "device:strict-schema",
    leaseVersion: 1,
    localOrderId: "order:strict-schema",
    targetRef: "target:strict-schema",
    documentRef: "document:strict-schema",
    commandTtlMs: 1_000,
    commandClass: "lifecycle",
    payloadHash: `sha256:${"a".repeat(64)}`,
    artifactRefs: [],
    recordedAt: new Date().toISOString(),
  } as const;
  const hashValidSemanticCases: readonly Readonly<Record<string, unknown>>[] = [
    { ...commandEvent, resultHash: `sha256:${"b".repeat(64)}` },
    { ...commandEvent, phase: "SEND", reason: "result fields forbidden before a result" },
    { ...commandEvent, phase: "FAILED" },
    { ...commandEvent, leaseVersion: 0 },
    { ...commandEvent, leaseVersion: -1 },
    { ...commandEvent, commandTtlMs: 0 },
    { ...commandEvent, commandTtlMs: -1 },
    { ...commandEvent, phase: "COMPLETED", resultHash: `sha256:${"b".repeat(64)}`, transportSequence: 0, permitSequence: 1 },
    { ...commandEvent, phase: "COMPLETED", resultHash: `sha256:${"b".repeat(64)}`, transportSequence: -1, permitSequence: 1 },
    { ...commandEvent, phase: "COMPLETED", resultHash: `sha256:${"b".repeat(64)}`, transportSequence: 1, permitSequence: 0 },
    { ...commandEvent, phase: "COMPLETED", resultHash: `sha256:${"b".repeat(64)}`, transportSequence: 1, permitSequence: -1 },
    { ...commandEvent, phase: "UNKNOWN", reason: "BROWSER_OUTCOME_UNKNOWN", resultHash: `sha256:${"b".repeat(64)}` },
  ];
  for (const [index, event] of hashValidSemanticCases.entries()) {
    const core = {
      schemaVersion: firstEnvelope.schemaVersion,
      sequence: firstEnvelope.sequence,
      previousEntryHash: firstEnvelope.previousEntryHash,
      event,
    };
    const invalidPath = join(journalFixture, `hash-valid-semantic-invalid-${index}.ndjson`);
    await writeFile(invalidPath, `${JSON.stringify({ ...core, entryHash: journalEntryHash(core) })}\n`, "utf8");
    assert.throws(
      () => readBrowserProofJournal(invalidPath),
      /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u,
      `hash-valid semantic command mutant ${index} must fail exact phase schema validation`,
    );
  }
  const partialTailPath = join(journalFixture, "partial-tail.ndjson");
  await writeFile(partialTailPath, JSON.stringify(firstEnvelope).slice(0, -1), "utf8");
  assert.throws(
    () => readBrowserProofJournal(partialTailPath),
    /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u,
    "an incomplete JSON tail must fail closed with the stable journal integrity code",
  );
  firstJournal.recordLifecycle({
    eventType: "LIFECYCLE",
    phase: "AUTHORITY_REVOKED",
    reason: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  });
  await firstOwner.release();
  assert.throws(
    () => firstJournal.recordLifecycle({ eventType: "LIFECYCLE", phase: "AUTHENTICATED", authorityRefHash: journalAuthorityRefHash }),
    /BROWSER_CONTROLLER_ALREADY_OWNED/u,
    "a stale journal reference must not append after its Owner lock is released",
  );

  await secondOwner.acquire();
  const secondJournal = new BrowserProofJournal(journalPath, identity, () => secondOwner.assertHeld());
  secondJournal.recordLifecycle({ eventType: "LIFECYCLE", phase: "AUTHENTICATED", authorityRefHash: journalAuthorityRefHash });
  secondJournal.recordLifecycle({
    eventType: "LIFECYCLE",
    phase: "TARGET_CLAIMED",
    authorityRefHash: journalAuthorityRefHash,
    targetRef: "target:restart",
    documentRef: "document:restart",
  });
  const restarted = readBrowserProofJournal(journalPath);
  assert.deepEqual(restarted.map((entry) => entry.sequence), [1, 2, 3, 4]);
  for (let index = 1; index < restarted.length; index += 1) {
    assert.equal(restarted[index]!.previousEntryHash, restarted[index - 1]!.entryHash);
  }
  await secondOwner.release();
  for (let restart = 0; restart < 100; restart += 1) {
    const owner = new BrowserOwnerLock(join(journalFixture, "browser", "owner.lock"));
    await owner.acquire();
    const current = new BrowserProofJournal(journalPath, identity, () => owner.assertHeld());
    current.recordLifecycle({ eventType: "LIFECYCLE", phase: "AUTHENTICATED", authorityRefHash: journalAuthorityRefHash });
    await owner.release();
  }
  const afterOneHundredRestarts = readBrowserProofJournal(journalPath);
  assert.equal(afterOneHundredRestarts.length, 104);
  for (let index = 0; index < afterOneHundredRestarts.length; index += 1) {
    assert.equal(afterOneHundredRestarts[index]!.sequence, index + 1);
    assert.equal(
      afterOneHundredRestarts[index]!.previousEntryHash,
      index === 0 ? `sha256:${"0".repeat(64)}` : afterOneHundredRestarts[index - 1]!.entryHash,
    );
  }
} finally {
  await secondOwner.release().catch(() => undefined);
  await firstOwner.release().catch(() => undefined);
  await rm(journalFixture, { recursive: true, force: true });
}
await verifyBrowserSupervisorRestartContract();
console.log("LOCAL_BROWSER_TERMINAL_CONTRACT_ACCEPTANCE_PASS");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-BROWSER-SESSION-004-V8", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:2","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:browser-terminal:atomic-journal", observedValue: "single mutation terminal contract and journal ownership verified" });
