import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import type { UnpackedExtensionReleaseIdentity } from "../release/unpacked-extension-release-identity.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../release/unpacked-extension-release-identity.js";
import {
  BROWSER_ARTIFACT_CHUNK_MAX_BYTES, BROWSER_COMMAND_DEFAULT_DEADLINE_MS, BROWSER_ERROR_CODES, BROWSER_HEARTBEAT_MS,
  BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS, BROWSER_PROTOCOL_REVISION, BROWSER_PROTOCOL_SCHEMA_SHA256,
  type BrowserErrorCode,
} from "../protocol/generated/browser-protocol.generated.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";

type AuthenticationInput = Readonly<{
  extensionId: string;
  extensionVersion: string;
  releaseBuildId: string;
  sessionHash: `sha256:${string}`;
  commandPermitKey: string;
}>;

type AuthenticationReady = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: `sha256:${string}`;
  channelSessionHash: `sha256:${string}`;
  commandPermitKey: string;
}>;

export const normalizeBrowserDisconnectReason = (
  reasonCode: string,
): BrowserErrorCode | "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" => {
  if (reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE") return reasonCode;
  return BROWSER_ERROR_CODES.find((candidate) => candidate === reasonCode) ?? "BROWSER_REVOCATION_REJECTED";
};

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const hashFile = (path: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(readFileSync(join(process.cwd(), path))).digest("hex")}`;

const assertRelease = (input: AuthenticationInput, options: Readonly<{
  releaseIdentity: UnpackedExtensionReleaseIdentity;
  enrolledProfile: BrowserProfileState;
}>): void => {
  const release = options.releaseIdentity;
  if (input.extensionId !== GRASSEYE_UNPACKED_EXTENSION_ID
    || input.extensionVersion !== release.version || input.releaseBuildId !== release.releaseBuildId
    || release.extensionId !== input.extensionId
    || release.extensionDirectoryHashV1 !== options.enrolledProfile.extensionTreeHash) {
    throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
  }
};

const permitKey = (encoded: string): Buffer => {
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength !== 32 || key.toString("base64") !== encoded) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return key;
};

const policyHashes = (): Readonly<{
  capabilityHash: `sha256:${string}`;
  livenessHash: `sha256:${string}`;
  commandBudgetHash: `sha256:${string}`;
  artifactStreamBudgetHash: `sha256:${string}`;
}> => {
  if (hashFile("src/lib/browser/protocol/browser-protocol.schema.json") !== BROWSER_PROTOCOL_SCHEMA_SHA256) {
    throw new Error("BROWSER_POLICY_UNVERIFIED");
  }
  return {
    capabilityHash: hashFile("src/lib/browser/protocol/browser-capabilities.json"),
    livenessHash: hashValue({
      heartbeatMs: BROWSER_HEARTBEAT_MS, missedHeartbeatToleranceMs: BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
      lifetime: "authenticated-connection",
    }),
    commandBudgetHash: hashValue({ maxInFlight: 1, commandTtlMs: BROWSER_COMMAND_DEFAULT_DEADLINE_MS }),
    artifactStreamBudgetHash: hashValue({ maxChunkBytes: BROWSER_ARTIFACT_CHUNK_MAX_BYTES }),
  };
};

export const commitBrowserAuthentication = (input: Readonly<{
  authentication: AuthenticationInput;
  state: ReturnType<typeof createBrowserInfrastructureState>;
  transport: BrowserTransportActor;
  issuer: BrowserAuthorityIssuer;
  profileConfig: BrowserProfileConfig;
  enrolledProfile: BrowserProfileState;
  releaseIdentity: UnpackedExtensionReleaseIdentity;
}>): AuthenticationReady => {
  if (!input.state.started) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  assertRelease(input.authentication, input);
  const commandPermitKey = permitKey(input.authentication.commandPermitKey);
  input.state.connectionGeneration += 1;
  const policies = policyHashes();
  const release = input.releaseIdentity;
  input.transport.commitAuthentication({
    authTranscriptHash: input.authentication.sessionHash, commandPermitKey,
    handshake: {
      pageSessionHash: input.authentication.sessionHash, extensionId: input.authentication.extensionId,
      extensionVersion: input.authentication.extensionVersion, sourceChannelToken: randomUUID(),
      artifactSetHash: release.extensionDirectoryHashV1, releaseSecurityPolicyHash: release.manifestHash,
      profileEnrollmentHash: input.enrolledProfile.enrollmentHash,
      connectionGeneration: input.state.connectionGeneration, protocolRevision: BROWSER_PROTOCOL_REVISION,
      capabilitySetHash: policies.capabilityHash, permissionPolicyHash: release.manifestHash,
      originPolicyHash: release.sitePolicyHash, livenessPolicyHash: policies.livenessHash,
      commandAdmissionBudgetHash: policies.commandBudgetHash,
      artifactStreamBudgetHash: policies.artifactStreamBudgetHash,
    },
  });
  const current = input.issuer.current();
  if (current.kind === "ABSENT") throw new Error(current.reasonCode);
  return {
    authorityRef: current.authority.authorityRef, authorityEpoch: current.authority.authorityEpoch,
    certificateHash: hashBrowserAuthorityCertificate(current.authority),
    channelSessionHash: current.authority.channelSessionHash,
    commandPermitKey: input.issuer.commandPermitKeyBase64(),
  };
};
