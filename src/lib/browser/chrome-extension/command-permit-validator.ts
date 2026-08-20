import { browserCommandPermitMacPayload } from "../transport/command-permit.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";

type BrowserHash = `sha256:${string}`;

export type ExtensionCommandPermit = Readonly<{
  permitRef: string;
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  activationTupleHash: BrowserHash;
  executionBindingHash: BrowserHash;
  targetLeaseRef: string;
  targetRef: string;
  documentRef: string;
  capabilityId: BrowserCapabilityId;
  commandId: string;
  sequence: number;
  mutationClass: "observation" | "mutation" | "lifecycle";
  deadlineAt: string;
  replyChannelToken: string;
  commandFrameMac: BrowserHash;
}>;

export type ExtensionPermitAuthorityContext = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  certificateHash: BrowserHash;
  activationTupleHash: BrowserHash;
  executionBindingHash: BrowserHash;
  commandPermitKey: string;
}>;

let currentAuthority: ExtensionPermitAuthorityContext | null = null;

export const setExtensionPermitAuthority = (context: ExtensionPermitAuthorityContext): void => {
  currentAuthority = context;
};

export const clearExtensionPermitAuthority = (): void => {
  currentAuthority = null;
};

export async function assertExtensionCommandPermit(permit: ExtensionCommandPermit): Promise<void> {
  if (
    !permit.permitRef
    || !permit.authorityRef
    || !permit.targetLeaseRef
    || !permit.targetRef
    || !permit.documentRef
    || !permit.capabilityId
    || !permit.commandId
    || !permit.replyChannelToken
    || permit.authorityEpoch < 1
    || !Number.isInteger(permit.sequence)
    || permit.sequence < 1
    || Date.parse(permit.deadlineAt) <= Date.now()
    || !isHash(permit.certificateHash)
    || !isHash(permit.activationTupleHash)
    || !isHash(permit.executionBindingHash)
    || !isHash(permit.commandFrameMac)
  ) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
  const authority = currentAuthority;
  if (!authority
    || permit.authorityRef !== authority.authorityRef
    || permit.authorityEpoch !== authority.authorityEpoch
    || permit.certificateHash !== authority.certificateHash
    || permit.activationTupleHash !== authority.activationTupleHash
    || permit.executionBindingHash !== authority.executionBindingHash
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
