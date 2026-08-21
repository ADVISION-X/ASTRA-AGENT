import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertExactWorkbenchPortSender,
  assertPageSessionGrant,
} from "../../src/lib/browser/chrome-extension/external-port-actor.js";
import {
  assertExtensionCommandPermit,
  clearExtensionPermitAuthority,
  setExtensionPermitAuthority,
} from "../../src/lib/browser/chrome-extension/command-permit-validator.js";
import type { ExtensionExternalPort } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { hashBrowserAuthorityCertificate } from "../../src/lib/browser/infrastructure/browser-authority-certificate.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { GRASSEYE_BROWSER_EXTENSION_ID } from "../../src/lib/browser/release/cws-extension-release-identity.js";
import { BrowserTransportActor } from "../../src/lib/browser/transport/transport-actor.js";
import {
  WORKBENCH_EXTENSION_CHANNEL_PORT_NAME,
  WorkbenchExtensionChannel,
} from "../../src/lib/browser/transport/workbench-extension-channel.js";
import type { BrowserUnsignedCommandPermit } from "../../src/lib/browser/transport/command-permit.js";

const retiredPaths = [
  "src/lib/browser/native-messaging-host",
  "src/lib/browser/chrome-extension/native-port-actor.ts",
  "src/lib/browser/transport/browser-native-framing.ts",
  "src/lib/browser/transport/controller-host-command-port.ts",
  "src/lib/browser/release/active-activation.json",
  "src/lib/browser/release/verify-artifacts.mjs",
] as const;

for (const retiredPath of retiredPaths) {
  assert.equal(existsSync(resolve(retiredPath)), false, `Retired Browser path remains: ${retiredPath}`);
}

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
const issuer = new BrowserAuthorityIssuer();
const transport = new BrowserTransportActor(issuer);
transport.start();
let disconnected = false;

const channel = new WorkbenchExtensionChannel({
  authenticate: ({ extensionId, extensionVersion, pageSessionHash, sourceChannelToken }) => {
    assert.equal(extensionId, GRASSEYE_BROWSER_EXTENSION_ID);
    const proof = {
      authTranscriptHash: hash("terminal-transcript"),
      handshake: {
        pageSessionHash,
        extensionId,
        extensionVersion,
        sourceChannelToken,
        artifactSetHash: hash("terminal-artifact"),
        releaseSecurityPolicyHash: hash("terminal-release-policy"),
        profileEnrollmentHash: hash("terminal-profile"),
        connectionGeneration: 1,
        protocolRevision: 1,
        capabilitySetHash: hash("terminal-capabilities"),
        permissionPolicyHash: hash("terminal-permissions"),
        originPolicyHash: hash("terminal-origins"),
        livenessPolicyHash: hash("terminal-liveness"),
        commandAdmissionBudgetHash: hash("terminal-command-budget"),
        artifactStreamBudgetHash: hash("terminal-artifact-budget"),
        expiresAt: new Date(Date.now() + 10_000).toISOString(),
      },
    };
    transport.commitAuthentication(proof);
    return proof;
  },
  authorityContext: () => {
    const slot = issuer.current();
    if (slot.kind !== "PRESENT") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    return {
      authorityRef: slot.authority.authorityRef,
      authorityEpoch: slot.authority.authorityEpoch,
      certificateHash: hashBrowserAuthorityCertificate(slot.authority),
      channelSessionHash: slot.authority.channelSessionHash,
      commandPermitKey: issuer.commandPermitKeyBase64(),
    };
  },
  onOperatorTargetClaim: () => undefined,
  onDisconnect: (reasonCode) => {
    disconnected = true;
    transport.disconnect(reasonCode);
  },
});

channel.start();
const opened = await channel.handle({ operation: "open" });
assert.equal(opened.extensionId, GRASSEYE_BROWSER_EXTENSION_ID);
assert.equal(opened.portName, WORKBENCH_EXTENSION_CHANNEL_PORT_NAME);
assert.equal(typeof opened.pageSessionGrant, "string");
const grant = opened.pageSessionGrant;
if (!grant) throw new Error("grant missing");
assert.doesNotThrow(() => assertPageSessionGrant(grant));
assert.throws(() => assertPageSessionGrant("short"), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);

const sourceChannelToken = "terminal-source-channel-token";
await channel.handle({
  operation: "inbound",
  grant,
  frame: {
    kind: "extension-hello",
    sourceChannelToken,
    extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    extensionVersion: "0.2.0",
  },
});
assert.equal(issuer.current().kind, "PRESENT");
const ready = await channel.handle({ operation: "next", grant });
assert.equal((ready.frame as { kind?: string } | null)?.kind, "controller-ready");
await assert.rejects(() => channel.handle({ operation: "open" }), /BROWSER_PAGE_SESSION_REBIND_FORBIDDEN/u);

const slot = issuer.current();
if (slot.kind !== "PRESENT") throw new Error("authority missing");
setExtensionPermitAuthority({
  authorityRef: slot.authority.authorityRef,
  authorityEpoch: slot.authority.authorityEpoch,
  certificateHash: hashBrowserAuthorityCertificate(slot.authority),
  channelSessionHash: slot.authority.channelSessionHash,
  commandPermitKey: issuer.commandPermitKeyBase64(),
});
const unsignedPermit: BrowserUnsignedCommandPermit = {
  permitRef: "terminal-permit",
  authorityRef: slot.authority.authorityRef,
  authorityEpoch: slot.authority.authorityEpoch,
  certificateHash: hashBrowserAuthorityCertificate(slot.authority),
  channelSessionHash: slot.authority.channelSessionHash,
  executionBindingHash: hash("terminal-execution"),
  targetLeaseRef: "terminal-target-lease",
  targetRef: "terminal-target",
  documentRef: "terminal-document",
  capabilityId: "browser.wait.v1",
  commandId: "terminal-command",
  sequence: 1,
  mutationClass: "observation",
  deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  replyChannelToken: "terminal-reply-channel",
};
const permit = { ...unsignedPermit, commandFrameMac: issuer.signCurrentCommandPermit(unsignedPermit) };
await assert.doesNotReject(() => assertExtensionCommandPermit(permit));
await assert.rejects(
  () => assertExtensionCommandPermit({ ...permit, targetRef: "changed-target" }),
  /BROWSER_COMMAND_PERMIT_INVALID/u,
);
const reply = channel.send(permit, { kind: "wait", durationMs: 1 });
const command = await channel.handle({ operation: "next", grant });
assert.equal((command.frame as { kind?: string } | null)?.kind, "controller-command");
await channel.handle({
  operation: "inbound",
  grant,
  frame: {
    kind: "extension-reply",
    sourceChannelToken,
    replyChannelToken: permit.replyChannelToken,
    sequence: permit.sequence,
    result: { waitedMs: 1 },
  },
});
assert.deepEqual(await reply, { replyChannelToken: permit.replyChannelToken, sequence: permit.sequence, result: { waitedMs: 1 } });

const validPort = {
  name: WORKBENCH_EXTENSION_CHANNEL_PORT_NAME,
  sender: { url: "http://127.0.0.1/" },
  postMessage: () => undefined,
  disconnect: () => undefined,
  onMessage: { addListener: () => undefined },
  onDisconnect: { addListener: () => undefined },
} satisfies ExtensionExternalPort;
assert.doesNotThrow(() => assertExactWorkbenchPortSender(validPort));
assert.throws(
  () => assertExactWorkbenchPortSender({ ...validPort, sender: { url: "http://localhost/" } }),
  /BROWSER_ORIGIN_REJECTED/u,
);

await assert.rejects(
  () => channel.handle({ operation: "inbound", grant: "wrong-grant", frame: {} }),
  /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
);

assert.equal(disconnected, true);
assert.deepEqual(issuer.current(), { kind: "ABSENT", reasonCode: "BROWSER_AUTH_TRANSCRIPT_INVALID" });
clearExtensionPermitAuthority();
console.log("LOCAL_BROWSER_TERMINAL_CONTRACT_ACCEPTANCE_PASS");
