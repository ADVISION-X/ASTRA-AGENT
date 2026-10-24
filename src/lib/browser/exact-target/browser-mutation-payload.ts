import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  constants, closeSync, fchmodSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";

type EncryptedPayload = Readonly<{ nonce: string; ciphertext: string; tag: string }>;

export type ProviderRecoveryPayload = Readonly<{ terminalPayload: unknown; locatorPayload?: unknown }>;

export const browserMutationPayloadKey = (dataDir: string): Buffer => {
  const directory = join(dataDir, "browser");
  const file = join(directory, "browser-mutation.key");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    const metadata = lstatSync(file);
    const uid = process.getuid?.();
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0
      || (uid !== undefined && metadata.uid !== uid)) throw new Error("BROWSER_MUTATION_KEY_INVALID");
    const key = readFileSync(file);
    if (key.byteLength !== 32) throw new Error("BROWSER_MUTATION_KEY_INVALID");
    return key;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  const descriptor = openSync(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    const key = randomBytes(32);
    writeFileSync(descriptor, key);
    fchmodSync(descriptor, 0o600);
    return key;
  } finally {
    closeSync(descriptor);
  }
};

const encryptPayload = (key: Buffer, aad: string, value: unknown): EncryptedPayload => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Object.freeze({
    nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  });
};

const decryptPayload = (key: Buffer, aad: string, encrypted: EncryptedPayload): unknown => {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.nonce, "base64url"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64url")), decipher.final(),
    ]).toString("utf8")) as unknown;
  } catch {
    throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  }
};

export const sealProviderRecoveryPayload = (
  key: Buffer, commandId: string, value: ProviderRecoveryPayload,
): string => JSON.stringify(encryptPayload(key, `provider:${commandId}`, value));

export const unsealProviderRecoveryPayload = (
  key: Buffer, commandId: string, value: string,
): ProviderRecoveryPayload => {
  let encrypted: unknown;
  try { encrypted = JSON.parse(value) as unknown; } catch {
    throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  }
  if (!encrypted || typeof encrypted !== "object" || Array.isArray(encrypted)) {
    throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  }
  const fields = encrypted as Record<string, unknown>;
  if (typeof fields.nonce !== "string" || typeof fields.ciphertext !== "string"
    || typeof fields.tag !== "string") throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  const payload = decryptPayload(key, `provider:${commandId}`, {
    nonce: fields.nonce, ciphertext: fields.ciphertext, tag: fields.tag,
  });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || !("terminalPayload" in payload)) throw new Error("BROWSER_MUTATION_PAYLOAD_INVALID");
  return payload as ProviderRecoveryPayload;
};
