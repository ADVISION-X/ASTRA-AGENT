import {
  canonicalizeBrowserAuthorityValue,
  type BrowserAuthorityFrame,
} from "../transport/browser-authority-frame-codec.js";

export type JsonWebKeyRecord = Readonly<Record<string, string>>;

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return globalThis.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

export const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = globalThis.atob(padded);
    const result = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (base64Url(result) !== value) throw new Error("invalid base64url");
    return result;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

export const hexSecret = (value: string): Uint8Array => {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("BROWSER_PAIRING_SECRET_INVALID");
  return Uint8Array.from({ length: 32 }, (_unused, index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16));
};

export const equal = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index]! ^ right[index]!;
  return difference === 0;
};

export const encodeText = (value: string): Uint8Array => new TextEncoder().encode(value);
const decodeText = (value: Uint8Array): string => new TextDecoder().decode(value);
export const cryptoBytes = (value: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer as ArrayBuffer;
};

export const hmac = async (pairingSecret: string, role: "server" | "client", transcript: string): Promise<string> => {
  const key = await globalThis.crypto.subtle.importKey("raw", cryptoBytes(hexSecret(pairingSecret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, cryptoBytes(encodeText(`${role}:${transcript}`)))));
};

export const signaturePayload = (role: "server" | "client", transcript: string): Uint8Array =>
  encodeText(`${role}:${transcript}`);

const nonce = (direction: "client-to-server" | "server-to-client", epoch: number, sequence: number): Uint8Array => {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || !Number.isSafeInteger(sequence) || sequence < 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const value = new Uint8Array(12);
  const data = new DataView(value.buffer);
  data.setUint32(0, direction === "client-to-server" ? 1 : 2, false);
  data.setUint32(4, epoch, false);
  data.setUint32(8, sequence, false);
  return value;
};

const aad = (frame: Pick<BrowserAuthorityFrame, "protocolVersion" | "kind" | "epoch" | "sequence" | "deadline">): Uint8Array =>
  encodeText(canonicalizeBrowserAuthorityValue({
    protocolVersion: frame.protocolVersion,
    kind: frame.kind,
    epoch: frame.epoch,
    sequence: frame.sequence,
    deadline: frame.deadline,
  }));

export const encrypt = async (key: CryptoKey, direction: "client-to-server" | "server-to-client", frame: Pick<BrowserAuthorityFrame, "protocolVersion" | "kind" | "epoch" | "sequence" | "deadline">, body: Record<string, unknown>): Promise<Readonly<{ nonce: string; ciphertext: string; tag: string }>> => {
  const currentNonce = nonce(direction, frame.epoch, frame.sequence);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: cryptoBytes(currentNonce), additionalData: cryptoBytes(aad(frame)), tagLength: 128 },
    key,
    cryptoBytes(encodeText(canonicalizeBrowserAuthorityValue(body))),
  ));
  if (encrypted.byteLength < 17) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { nonce: base64Url(currentNonce), ciphertext: base64Url(encrypted.subarray(0, -16)), tag: base64Url(encrypted.subarray(-16)) };
};

export const decrypt = async (key: CryptoKey, direction: "client-to-server" | "server-to-client", frame: BrowserAuthorityFrame): Promise<Record<string, unknown>> => {
  const encrypted = asRecord(frame.body.encrypted);
  if (!encrypted || typeof encrypted.nonce !== "string" || typeof encrypted.ciphertext !== "string" || typeof encrypted.tag !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const currentNonce = nonce(direction, frame.epoch, frame.sequence);
  if (!equal(fromBase64Url(encrypted.nonce), currentNonce)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const ciphertext = fromBase64Url(encrypted.ciphertext);
  const tag = fromBase64Url(encrypted.tag);
  const joined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  joined.set(ciphertext, 0);
  joined.set(tag, ciphertext.byteLength);
  let encodedPlaintext: string;
  let plaintext: unknown;
  try {
    encodedPlaintext = decodeText(new Uint8Array(await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: cryptoBytes(currentNonce), additionalData: cryptoBytes(aad(frame)), tagLength: 128 },
      key,
      cryptoBytes(joined),
    )));
    plaintext = JSON.parse(encodedPlaintext);
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const body = asRecord(plaintext);
  if (!body || canonicalizeBrowserAuthorityValue(body) !== encodedPlaintext) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return body;
};

export const browserCommandErrorCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
    ? error.message
    : "BROWSER_CAPABILITY_REJECTED";

export const pairingErrorCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)
    ? error.message
    : "BROWSER_AUTH_TRANSCRIPT_INVALID";

export const publicSigningJwk = (value: JsonWebKey): JsonWebKeyRecord => {
  if (value.kty !== "EC" || value.crv !== "P-256" || typeof value.x !== "string" || typeof value.y !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return { kty: value.kty, crv: value.crv, x: value.x, y: value.y };
};

export const deriveKeys = async (sharedSecret: Uint8Array, pairingSecret: string, transcript: string): Promise<Readonly<{ clientToServerKey: CryptoKey; serverToClientKey: CryptoKey }>> => {
  const pairingSalt = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", cryptoBytes(hexSecret(pairingSecret))));
  const material = new Uint8Array(await globalThis.crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: cryptoBytes(pairingSalt), info: new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", cryptoBytes(encodeText(transcript)))) },
    await globalThis.crypto.subtle.importKey("raw", cryptoBytes(sharedSecret), "HKDF", false, ["deriveBits"]),
    512,
  ));
  return {
    clientToServerKey: await globalThis.crypto.subtle.importKey("raw", cryptoBytes(material.slice(0, 32)), "AES-GCM", false, ["encrypt"]),
    serverToClientKey: await globalThis.crypto.subtle.importKey("raw", cryptoBytes(material.slice(32, 64)), "AES-GCM", false, ["decrypt"]),
  };
};
