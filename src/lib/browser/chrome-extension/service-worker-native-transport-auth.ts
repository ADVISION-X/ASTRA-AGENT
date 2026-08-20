import {
  GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
  GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES,
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_EXTENSION_VERSION,
  GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
  GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireCommand,
  type BrowserWireMessage,
} from "../protocol/generated/browser-protocol.js";
import type { ExtensionEphemeralSession } from "./service-worker-session-crypto.js";

export type Hash = `sha256:${string}`;

export interface NativePort {
  postMessage(message: BrowserWireMessage): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}

export type RunCommand = (
  command: BrowserWireCommand,
  expectedLoaderId?: string,
) => Promise<unknown>;

export type ExtensionArtifactIdentity = Readonly<{
  extensionArtifactDigest: Hash;
  supportedActivationTupleIds: readonly string[];
}>;

export type AuthorityBinding = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  authorityCertificateHash: Hash;
  connectionGeneration: number;
  nativePortEpoch: number;
  livenessLeaseEpoch: number;
}>;

export type PendingHandshake = Readonly<{
  challengeId: string;
  controllerNonce: string;
  controllerIncarnationHash: Hash;
  connectionGeneration: number;
  nativePortEpoch: number;
  controllerPublicKey: string;
  activationTupleHash: Hash;
  session: ExtensionEphemeralSession;
}>;

const isHash = (value: unknown): value is Hash =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

export const extensionArtifactIdentityFromManifest = (
  manifest: Record<string, unknown>,
): ExtensionArtifactIdentity => {
  const extensionArtifactDigest = manifest["x-grasseye-extension-artifact-digest"];
  const supportedActivationTupleIds =
    manifest["x-grasseye-supported-activation-tuples"];
  if (
    !isHash(extensionArtifactDigest) ||
    !Array.isArray(supportedActivationTupleIds) ||
    supportedActivationTupleIds.length === 0 ||
    !supportedActivationTupleIds.every(
      (item) => typeof item === "string" && item.length > 0,
    )
  ) {
    throw new Error("BROWSER_EXTENSION_ARTIFACT_IDENTITY_MISSING");
  }
  return Object.freeze({
    extensionArtifactDigest,
    supportedActivationTupleIds: [...supportedActivationTupleIds],
  });
};

export const extensionAuthTranscript = (input: {
  controllerIncarnationHash: Hash;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
  controllerNonce: string;
  extensionNonce: string;
  controllerPublicKey: string;
  extensionPublicKey: string;
  extensionInstanceId: string;
  extensionArtifactDigest: Hash;
  activationTupleHash: Hash;
  capabilitySetHash: Hash;
  permissionPolicyHash: Hash;
  originPolicyHash: Hash;
}): string =>
  Object.entries({
    protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
    releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
    ...input,
  })
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

export const authorityGrantTranscript = (input: {
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: Hash;
  connectionGeneration: number;
  nativePortEpoch: number;
  challengeId: string;
  livenessLeaseEpoch: number;
}): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

export const heartbeatTranscript = (input: {
  authorityRef: string;
  authorityEpoch: number;
  livenessLeaseEpoch: number;
  connectionGeneration: number;
  nativePortEpoch: number;
  heartbeatSequence: number;
  monotonicMs: number;
}): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

export const capabilityProbeTranscript = (input: {
  probeId: string;
  nativePortEpoch: number;
  activationTupleHash: Hash;
  capabilitySetHash: Hash;
  permissionPolicyHash: Hash;
  originPolicyHash: Hash;
  maxControlFrameBytes: number;
  debuggerAvailable?: boolean;
}): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

export const randomNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
