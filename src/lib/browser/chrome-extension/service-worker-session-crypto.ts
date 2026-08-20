const INFO = new TextEncoder().encode("grasseye-browser-command-frame-v3");

const toBase64 = (value: ArrayBuffer | Uint8Array): string => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string): ArrayBuffer => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

const aad = (
  input: Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
    sequence: number;
    permitHash: string;
  }>,
): ArrayBuffer =>
  new TextEncoder().encode(
    `${input.authorityRef}:${input.authorityEpoch}:${input.replyChannelToken}:${input.sequence}:${input.permitHash}`,
  ).buffer;

export type ExtensionEphemeralSession = Readonly<{
  publicKeyBase64: string;
  frameKey: CryptoKey;
  hmacKey: CryptoKey;
}>;

export const createExtensionEphemeralSession = async (
  input: Readonly<{
    controllerPublicKeyBase64: string;
    nonceBase64: string;
  }>,
): Promise<ExtensionEphemeralSession> => {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const controllerKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(input.controllerPublicKeyBase64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: controllerKey },
    keyPair.privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: fromBase64(input.nonceBase64),
      info: INFO,
    },
    hkdfKey,
    256,
  );
  const [frameKey, hmacKey, publicKey] = await Promise.all([
    crypto.subtle.importKey("raw", derivedBits, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]),
    crypto.subtle.importKey(
      "raw",
      derivedBits,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    ),
    crypto.subtle.exportKey("raw", keyPair.publicKey),
  ]);
  return Object.freeze({
    publicKeyBase64: toBase64(publicKey),
    frameKey,
    hmacKey,
  });
};

export const signExtensionTranscript = async (
  key: CryptoKey,
  transcript: string,
): Promise<string> =>
  toBase64(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(transcript)),
  );

export const verifyControllerProof = async (
  key: CryptoKey,
  transcript: string,
  proofBase64: string,
): Promise<boolean> =>
  crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64(proofBase64),
    new TextEncoder().encode(transcript),
  );

export const encryptExtensionFrame = async (
  key: CryptoKey,
  binding: Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
    sequence: number;
    permitHash: string;
  }>,
  value: unknown,
): Promise<Readonly<{ iv: string; ciphertext: string }>> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const plaintext = new TextEncoder().encode(JSON.stringify(value)).buffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(binding), tagLength: 128 },
    key,
    plaintext,
  );
  return Object.freeze({ iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
};

export const decryptExtensionFrame = async <T>(
  key: CryptoKey,
  binding: Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
    sequence: number;
    permitHash: string;
  }>,
  input: Readonly<{ iv: string; ciphertext: string }>,
): Promise<T> => {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(input.iv),
      additionalData: aad(binding),
      tagLength: 128,
    },
    key,
    fromBase64(input.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
};
