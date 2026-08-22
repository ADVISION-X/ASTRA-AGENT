import {
  createECDH,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPublicKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from "node:crypto";

import { canonicalizeBrowserAuthorityValue } from "./browser-authority-frame-codec.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";

export type BrowserAuthorityDirectionalKeys = Readonly<{
  clientToServer: Buffer;
  serverToClient: Buffer;
  commandPermit: Buffer;
}>;

export type BrowserAuthorityEncryptedFrame = Readonly<{
  nonce: string;
  ciphertext: string;
  tag: string;
}>;

export const assertPairingSecret: (pairingSecret: string) => void = (pairingSecret) => {
  if (!/^[a-f0-9]{64}$/u.test(pairingSecret)) throw new Error("BROWSER_PAIRING_SECRET_INVALID");
};

export const deriveDirectionalSessionKeys = (input: Readonly<{ sharedSecret: Buffer; pairingSecret: string; transcript: string }>): BrowserAuthorityDirectionalKeys => {
  assertPairingSecret(input.pairingSecret);
  const salt = createHash("sha256").update(input.pairingSecret, "hex").digest();
  const info = createHash("sha256").update(input.transcript).digest();
  const material = Buffer.from(hkdfSync("sha256", input.sharedSecret, salt, info, 96));
  return {
    clientToServer: material.subarray(0, 32),
    serverToClient: material.subarray(32, 64),
    commandPermit: material.subarray(64, 96),
  };
};

export const nonceForDirectionSequence = (direction: "client-to-server" | "server-to-client", epoch: number, sequence: number): Buffer => {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || !Number.isSafeInteger(sequence) || sequence < 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const nonce = Buffer.alloc(12);
  nonce.writeUInt32BE(direction === "client-to-server" ? 1 : 2, 0);
  nonce.writeUInt32BE(epoch, 4);
  nonce.writeUInt32BE(sequence, 8);
  return nonce;
};

export const encryptBrowserAuthorityFrame = (input: Readonly<{ key: Buffer; direction: "client-to-server" | "server-to-client"; epoch: number; sequence: number; aad: string; plaintext: string }>): BrowserAuthorityEncryptedFrame => {
  const nonce = nonceForDirectionSequence(input.direction, input.epoch, input.sequence);
  const cipher = createCipheriv("aes-256-gcm", input.key, nonce);
  cipher.setAAD(Buffer.from(input.aad));
  const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
  return { nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
};

export const decryptBrowserAuthorityFrame = (input: Readonly<{ key: Buffer; direction: "client-to-server" | "server-to-client"; epoch: number; sequence: number; aad: string; encrypted: BrowserAuthorityEncryptedFrame }>): string => {
  const expectedNonce = nonceForDirectionSequence(input.direction, input.epoch, input.sequence);
  const actualNonce = Buffer.from(input.encrypted.nonce, "base64url");
  if (actualNonce.byteLength !== expectedNonce.byteLength || !timingSafeEqual(actualNonce, expectedNonce)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", input.key, expectedNonce);
  decipher.setAAD(Buffer.from(input.aad));
  decipher.setAuthTag(Buffer.from(input.encrypted.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(input.encrypted.ciphertext, "base64url")), decipher.final()]).toString("utf8");
};

type BrowserAuthorityJsonWebKey = Readonly<Record<string, string>>;

export type BrowserAuthorityPairingHello = Readonly<{
  extensionId: string;
  extensionVersion: string;
  releaseBuildId: string;
  clientSigningPublicJwk: BrowserAuthorityJsonWebKey;
  clientEcdhPublicKey: string;
  deadline: string;
}>;

export type BrowserAuthorityPairingChallenge = Readonly<{
  serverSigningPublicJwk: BrowserAuthorityJsonWebKey;
  serverEcdhPublicKey: string;
  challenge: string;
  serverSignature: string;
  serverPairingMac: string;
}>;

export type BrowserAuthorityPairingProof = Readonly<{
  clientSignature: string;
  clientPairingMac: string;
}>;

export type BrowserAuthorityHandshakeState = Readonly<{
  hello: BrowserAuthorityPairingHello;
  challenge: BrowserAuthorityPairingChallenge;
  transcript: string;
  expiresAtMs: number;
  pairingSecret: string;
  clientSigningPublicKey: ReturnType<typeof createPublicKey>;
  clientEcdhPublicKey: Buffer;
  serverSigningPrivateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
  serverEcdh: ReturnType<typeof createECDH>;
}>;

export type VerifiedBrowserAuthorityHandshake = Readonly<{
  extensionId: string;
  extensionVersion: string;
  releaseBuildId: string;
  sessionHash: `sha256:${string}`;
  directionalKeys: BrowserAuthorityDirectionalKeys;
  serverFinalSignature: string;
}>;

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const base64Url = (value: Buffer): string => value.toString("base64url");

const decodeBase64Url = (value: string): Buffer => {
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.byteLength === 0 || decoded.toString("base64url") !== value) throw new Error("invalid base64url");
    return decoded;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const assertPublicJwk: (value: unknown) => asserts value is BrowserAuthorityJsonWebKey = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !Object.values(value).every((entry) => typeof entry === "string")) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const pairingMac = (pairingSecret: string, role: "server" | "client", transcript: string): string =>
  base64Url(createHmac("sha256", Buffer.from(pairingSecret, "hex")).update(`${role}:${transcript}`).digest());

const signingPayload = (role: "server" | "client", transcript: string): Buffer =>
  Buffer.from(`${role}:${transcript}`, "utf8");

const p1363Key = <T>(key: T): Readonly<{ key: T; dsaEncoding: "ieee-p1363" }> => ({
  key,
  dsaEncoding: "ieee-p1363",
});

const equal = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
};

/**
 * Creates the server half of the only pairing protocol.  The plaintext
 * handshake is bounded and carries public material only; the pairing secret
 * proves possession through directional MACs and is never placed on the wire.
 */
export const createBrowserAuthorityHandshake = (
  pairingSecret: string,
  hello: BrowserAuthorityPairingHello,
  now = Date.now(),
): BrowserAuthorityHandshakeState => {
  assertPairingSecret(pairingSecret);
  if (hello.extensionId.length === 0 || hello.extensionVersion.length === 0
    || !/^build-[a-f0-9-]{36}$/u.test(hello.releaseBuildId)
    || Date.parse(hello.deadline) <= now || Date.parse(hello.deadline) - now > BROWSER_COMMAND_DEFAULT_DEADLINE_MS) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  assertPublicJwk(hello.clientSigningPublicJwk);
  const clientSigningPublicKey = createPublicKey({ key: hello.clientSigningPublicJwk, format: "jwk" });
  const clientEcdhPublicKey = decodeBase64Url(hello.clientEcdhPublicKey);
  const clientEcdhValidator = createECDH("prime256v1");
  clientEcdhValidator.generateKeys();
  try { clientEcdhValidator.computeSecret(clientEcdhPublicKey); } catch { throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID"); }
  const serverEcdh = createECDH("prime256v1");
  serverEcdh.generateKeys();
  const serverSigning = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const challengeValue = base64Url(randomBytes(32));
  const challengeCore = {
    serverSigningPublicJwk: serverSigning.publicKey.export({ format: "jwk" }) as BrowserAuthorityJsonWebKey,
    serverEcdhPublicKey: base64Url(serverEcdh.getPublicKey()),
    challenge: challengeValue,
  };
  const transcript = canonicalizeBrowserAuthorityValue({ hello, challenge: challengeCore });
  const challenge: BrowserAuthorityPairingChallenge = {
    ...challengeCore,
    serverSignature: base64Url(sign("sha256", signingPayload("server", transcript), p1363Key(serverSigning.privateKey))),
    serverPairingMac: pairingMac(pairingSecret, "server", transcript),
  };
  return {
    hello,
    challenge,
    transcript,
    expiresAtMs: Date.parse(hello.deadline),
    pairingSecret,
    clientSigningPublicKey,
    clientEcdhPublicKey,
    serverSigningPrivateKey: serverSigning.privateKey,
    serverEcdh,
  };
};

/** Verifies the extension half and derives unique directional AES-GCM keys. */
export const verifyBrowserAuthorityChallenge = (
  state: BrowserAuthorityHandshakeState,
  proof: BrowserAuthorityPairingProof,
  now = Date.now(),
): VerifiedBrowserAuthorityHandshake => {
  if (now > state.expiresAtMs
    || !equal(proof.clientPairingMac, pairingMac(state.pairingSecret, "client", state.transcript))
    || !verify("sha256", signingPayload("client", state.transcript), p1363Key(state.clientSigningPublicKey), decodeBase64Url(proof.clientSignature))) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const sharedSecret = state.serverEcdh.computeSecret(state.clientEcdhPublicKey);
  const directionalKeys = deriveDirectionalSessionKeys({
    sharedSecret,
    pairingSecret: state.pairingSecret,
    transcript: state.transcript,
  });
  return {
    extensionId: state.hello.extensionId,
    extensionVersion: state.hello.extensionVersion,
    releaseBuildId: state.hello.releaseBuildId,
    sessionHash: hashText(state.transcript),
    directionalKeys,
    serverFinalSignature: base64Url(sign("sha256", Buffer.from(`authenticated:${state.transcript}`, "utf8"), p1363Key(state.serverSigningPrivateKey))),
  };
};
