import type { BrowserWireMessage } from "../protocol/generated/browser-protocol.js";
import {
  browserExtensionAuthTranscript,
  type BrowserExtensionAuthTranscriptInput,
} from "./transport-transcript.js";
import type {
  BrowserAuthenticatedTransportContext,
  ChallengeState,
} from "./transport-authenticator.js";

export const capabilityProbeTranscript = (input: {
  probeId: string;
  nativePortEpoch: number;
  activationTupleHash: string;
  capabilitySetHash: string;
  permissionPolicyHash: string;
  originPolicyHash: string;
  maxControlFrameBytes: number;
  debuggerAvailable?: boolean;
}): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

export const extensionAuthenticationTranscript = (input: {
  message: Extract<BrowserWireMessage, { type: "extension_authenticated" }>;
  challenge: ChallengeState;
  connection: Pick<
    BrowserAuthenticatedTransportContext,
    "connectionGeneration" | "nativePortEpoch"
  >;
  protocolVersion: string;
  releaseIdentity: string;
  controllerIncarnationHash: string;
  activationTupleHash: string;
}): string => {
  const { message, challenge, connection } = input;
  const transcript: BrowserExtensionAuthTranscriptInput = {
    protocolVersion: input.protocolVersion,
    releaseIdentity: input.releaseIdentity,
    controllerIncarnationHash: input.controllerIncarnationHash,
    connectionGeneration: connection.connectionGeneration,
    nativePortEpoch: connection.nativePortEpoch,
    challengeId: challenge.challengeId,
    controllerNonce: challenge.controllerNonce,
    extensionNonce: message.extensionNonce,
    controllerPublicKey: challenge.ephemeral.publicKeyBase64,
    extensionPublicKey: message.extensionPublicKey,
    extensionInstanceId: message.extensionInstanceId,
    extensionArtifactDigest: challenge.hello.extensionArtifactDigest,
    activationTupleHash: input.activationTupleHash,
    capabilitySetHash: challenge.hello.capabilitySetHash,
    permissionPolicyHash: challenge.hello.permissionPolicyHash,
    originPolicyHash: challenge.hello.originPolicyHash,
  };
  return browserExtensionAuthTranscript(transcript);
};
