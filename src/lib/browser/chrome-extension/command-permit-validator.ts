import { browserCommandPermitMacPayload } from "../transport/command-permit.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

type BrowserHash = `sha256:${string}`;

export type ExtensionCommandPermit = Readonly<{
  permitRef: string;
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  channelSessionHash: BrowserHash;
  executionBindingHash: BrowserHash;
  writerFenceHash: BrowserHash;
  candidateHash: BrowserHash;
  contractManifestHash: BrowserHash;
  ownerPluginId: string;
  pluginVersion: number;
  jobId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  localOrderId: string;
  targetLeaseRef: string;
  targetRef: string;
  documentRef: string;
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  inputHash: BrowserHash;
  replayPolicy: "observation-only" | "target-local-per-generation" | "provider-effect-once";
  actionOrdinal: number;
  capabilityId: BrowserCapabilityId;
  commandId: string;
  sequence: number;
  mutationClass: "observation" | "mutation" | "lifecycle";
  workspaceRef: string;
  commandTtlMs: number;
  replyChannelToken: string;
  commandFrameMac: BrowserHash;
}>;

export type ExtensionPermitAuthorityContext = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  channelSessionHash: BrowserHash;
  commandPermitKey: string;
}>;

let currentAuthority: ExtensionPermitAuthorityContext | null = null;
const permitReceivedMonotonic = new Map<string, number>();

export const setExtensionPermitAuthority = (context: ExtensionPermitAuthorityContext): void => {
  currentAuthority = context;
};

export const clearExtensionPermitAuthority = (): void => {
  currentAuthority = null;
};

const hasRequiredPermitReferences = (permit: ExtensionCommandPermit): boolean => [
  permit.permitRef,
  permit.authorityRef,
  permit.targetLeaseRef,
  permit.targetRef,
  permit.documentRef,
  permit.productStepId,
  permit.callId,
  permit.childCapabilityId,
  permit.capabilityId,
  permit.commandId,
  permit.replyChannelToken,
  permit.workspaceRef,
  permit.ownerPluginId,
  permit.jobId,
  permit.attemptId,
  permit.deviceId,
  permit.localOrderId,
].every(Boolean);

const hasValidPermitMetadata = (permit: ExtensionCommandPermit): boolean => permit.authorityEpoch >= 1
  && Number.isInteger(permit.sequence)
  && permit.sequence >= 1
  && Number.isInteger(permit.actionOrdinal)
  && permit.actionOrdinal >= 1
  && Number.isInteger(permit.leaseVersion)
  && permit.leaseVersion >= 1
  && Number.isInteger(permit.pluginVersion)
  && permit.pluginVersion >= 1
  && Number.isInteger(permit.commandTtlMs)
  && permit.commandTtlMs >= 1
  && permit.commandTtlMs <= 3_600_000
  && isHash(permit.certificateHash)
  && isHash(permit.channelSessionHash)
  && isHash(permit.executionBindingHash)
  && isHash(permit.writerFenceHash)
  && isHash(permit.candidateHash)
  && isHash(permit.contractManifestHash)
  && isHash(permit.inputHash)
  && isHash(permit.commandFrameMac);

const hasValidPermitShape = (permit: ExtensionCommandPermit): boolean => hasRequiredPermitReferences(permit)
  && hasValidPermitMetadata(permit);

const matchesPermitAuthority = (
  permit: ExtensionCommandPermit,
  authority: ExtensionPermitAuthorityContext,
): boolean => permit.authorityRef === authority.authorityRef
  && permit.authorityEpoch === authority.authorityEpoch
  && permit.certificateHash === authority.certificateHash
  && permit.channelSessionHash === authority.channelSessionHash;

export async function assertExtensionCommandPermit(permit: ExtensionCommandPermit): Promise<void> {
  if (!hasValidPermitShape(permit)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  const authority = currentAuthority;
  const now = performance.now();
  const receivedAt = permitReceivedMonotonic.get(permit.permitRef) ?? now;
  permitReceivedMonotonic.set(permit.permitRef, receivedAt);
  if (now - receivedAt > permit.commandTtlMs) {
    permitReceivedMonotonic.delete(permit.permitRef);
    throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
  }
  if (!authority || !matchesPermitAuthority(permit, authority)
    || !await hasValidPermitMac(permit, authority.commandPermitKey)) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
}

const isHash = (value: string): value is BrowserHash => /^sha256:[a-f0-9]{64}$/u.test(value);

const hasValidPermitMac = async (permit: ExtensionCommandPermit, commandPermitKey: string): Promise<boolean> => {
  const rawKey = decodeBase64(commandPermitKey);
  if (!rawKey || rawKey.byteLength !== 32) return false;
  try {
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBuffer(rawKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const { commandFrameMac, ...unsigned } = permit;
    const signature = new Uint8Array(await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      toArrayBuffer(new TextEncoder().encode(browserCommandPermitMacPayload(unsigned))),
    ));
    return commandFrameMac === `sha256:${toHex(signature)}`;
  } catch {
    return false;
  }
};

const decodeBase64 = (value: string): Uint8Array | null => {
  try {
    return Uint8Array.from(globalThis.atob(value), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};
