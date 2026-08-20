import {
  GRASSEYE_BROWSER_CAPABILITY_SET_HASH,
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_EXTENSION_VERSION,
  GRASSEYE_BROWSER_ORIGIN_POLICY_HASH,
  GRASSEYE_BROWSER_PERMISSION_POLICY_HASH,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireMessage,
} from "./browser-protocol.js";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const isSafeInteger = (value: unknown): boolean =>
  Number.isSafeInteger(value);
const isString = (value: unknown): value is string =>
  typeof value === "string";

const isExtensionHello = (value: RecordValue): boolean =>
  value.extensionId === GRASSEYE_BROWSER_EXTENSION_ID &&
  value.extensionVersion === GRASSEYE_BROWSER_EXTENSION_VERSION &&
  isString(value.extensionInstanceId) &&
  isSafeInteger(value.nativePortEpoch) &&
  isString(value.extensionArtifactDigest) &&
  HASH_PATTERN.test(value.extensionArtifactDigest) &&
  Array.isArray(value.supportedActivationTupleIds) &&
  value.capabilitySetHash === GRASSEYE_BROWSER_CAPABILITY_SET_HASH &&
  value.permissionPolicyHash === GRASSEYE_BROWSER_PERMISSION_POLICY_HASH &&
  value.originPolicyHash === GRASSEYE_BROWSER_ORIGIN_POLICY_HASH;

const isControllerChallenge = (value: RecordValue): boolean =>
  isString(value.challengeId) &&
  isString(value.controllerNonce) &&
  isString(value.controllerPublicKey) &&
  isSafeInteger(value.connectionGeneration) &&
  isSafeInteger(value.nativePortEpoch) &&
  isString(value.activationTupleId) &&
  isString(value.activationTupleHash);

const isExtensionAuthenticated = (value: RecordValue): boolean =>
  isString(value.challengeId) &&
  isString(value.extensionNonce) &&
  isString(value.extensionPublicKey) &&
  isString(value.transcriptProof);

const isCapabilityProbe = (value: RecordValue): boolean =>
  isString(value.probeId) &&
  isSafeInteger(value.nativePortEpoch) &&
  isString(value.capabilitySetHash) &&
  isString(value.permissionPolicyHash) &&
  isString(value.originPolicyHash) &&
  isSafeInteger(value.maxControlFrameBytes) &&
  isString(value.proof);

const isAuthorityGrant = (value: RecordValue): boolean =>
  isString(value.authorityRef) &&
  isSafeInteger(value.authorityEpoch) &&
  isString(value.authorityCertificateHash) &&
  isSafeInteger(value.connectionGeneration) &&
  isSafeInteger(value.nativePortEpoch) &&
  isString(value.challengeId);

const isHeartbeat = (value: RecordValue): boolean =>
  isString(value.authorityRef) &&
  isSafeInteger(value.authorityEpoch) &&
  isSafeInteger(value.livenessLeaseEpoch) &&
  isSafeInteger(value.heartbeatSequence) &&
  isString(value.proof);

const isCommandFrame = (value: RecordValue): boolean =>
  isRecord(value.permit) &&
  isString(value.permit.authorityRef) &&
  isString(value.permit.writerFenceHash) &&
  isString(value.permit.permitHash) &&
  isString(value.iv) &&
  isString(value.ciphertext);

const isResponseFrame = (value: RecordValue): boolean =>
  isString(value.replyChannelToken) &&
  isString(value.permitHash) &&
  isString(value.authorityRef) &&
  isString(value.iv) &&
  isString(value.ciphertext);

type MessageType = BrowserWireMessage["type"];
const MESSAGE_VALIDATORS: Readonly<
  Record<MessageType, (value: RecordValue) => boolean>
> = {
  extension_hello: isExtensionHello,
  controller_challenge: isControllerChallenge,
  extension_authenticated: isExtensionAuthenticated,
  capability_probe: isCapabilityProbe,
  capability_probe_ack: isCapabilityProbe,
  authority_grant: isAuthorityGrant,
  authority_grant_ack: isAuthorityGrant,
  heartbeat_probe: isHeartbeat,
  heartbeat: isHeartbeat,
  command_frame: isCommandFrame,
  response_frame: isResponseFrame,
};

export const isBrowserWireMessage = (
  value: unknown,
): value is BrowserWireMessage => {
  if (
    !isRecord(value) ||
    value.protocolVersion !== GRASSEYE_BROWSER_PROTOCOL_VERSION ||
    value.releaseIdentity !== GRASSEYE_BROWSER_RELEASE_IDENTITY ||
    !isString(value.type)
  )
    return false;
  const validator = MESSAGE_VALIDATORS[value.type as MessageType];
  return validator?.(value) ?? false;
};
