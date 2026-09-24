import { canonicalizeBrowserAuthorityValue, encodeBrowserAuthorityFrame,
  type BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import { BROWSER_PROTOCOL_REVISION } from "../protocol/generated/browser-protocol.generated.js";
import { asRecord, base64Url, cryptoBytes, decrypt, deriveKeys, encodeText,
  equal, fromBase64Url, hmac, signaturePayload,
  type JsonWebKeyRecord } from "./websocket-actor-crypto.js";

export type PendingPairing = Readonly<{
  hello: Readonly<{ extensionId: string; extensionVersion: string; releaseBuildId: string;
    clientSigningPublicJwk: JsonWebKeyRecord; clientEcdhPublicKey: string; deadline: string }>;
  signing: CryptoKeyPair; ecdh: CryptoKeyPair; pairingSecret: string;
}>;
export type AuthenticatedSession = Readonly<{
  clientToServerKey: CryptoKey; serverToClientKey: CryptoKey;
  serverSigningPublicKey: CryptoKey; transcript: string; nextClientSequence: number;
}>;

/** Verify the server challenge before publishing the client's one pairing proof. */
export const answerPairChallenge = async (
  pending: PendingPairing | null, frame: BrowserAuthorityFrame,
): Promise<Readonly<{ session: AuthenticatedSession; proofFrame: string }>> => {
  if (!pending || frame.epoch !== 0 || frame.sequence !== 0) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const serverSigningPublicJwk = asRecord(frame.body.serverSigningPublicJwk);
  const serverEcdhPublicKey = typeof frame.body.serverEcdhPublicKey === "string" ? frame.body.serverEcdhPublicKey : null;
  const challenge = typeof frame.body.challenge === "string" ? frame.body.challenge : null;
  const serverSignature = typeof frame.body.serverSignature === "string" ? frame.body.serverSignature : null;
  const serverPairingMac = typeof frame.body.serverPairingMac === "string" ? frame.body.serverPairingMac : null;
  if (!serverSigningPublicJwk || !serverEcdhPublicKey || !challenge || !serverSignature || !serverPairingMac) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const transcript = canonicalizeBrowserAuthorityValue({ hello: pending.hello,
    challenge: { serverSigningPublicJwk, serverEcdhPublicKey, challenge } });
  const serverKey = await globalThis.crypto.subtle.importKey("jwk", serverSigningPublicJwk,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const expectedMac = fromBase64Url(await hmac(pending.pairingSecret, "server", transcript));
  const actualMac = fromBase64Url(serverPairingMac);
  const verified = await globalThis.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" },
    serverKey, cryptoBytes(fromBase64Url(serverSignature)), cryptoBytes(signaturePayload("server", transcript)));
  if (!verified || !equal(expectedMac, actualMac)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const clientSignature = base64Url(new Uint8Array(await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, pending.signing.privateKey,
    cryptoBytes(signaturePayload("client", transcript)))));
  const clientPairingMac = await hmac(pending.pairingSecret, "client", transcript);
  const serverEcdh = await globalThis.crypto.subtle.importKey("raw",
    cryptoBytes(fromBase64Url(serverEcdhPublicKey)), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await globalThis.crypto.subtle.deriveBits(
    { name: "ECDH", public: serverEcdh }, pending.ecdh.privateKey, 256));
  const keys = await deriveKeys(sharedSecret, pending.pairingSecret, transcript);
  return Object.freeze({
    session: { ...keys, serverSigningPublicKey: serverKey, transcript, nextClientSequence: 2 },
    proofFrame: encodeBrowserAuthorityFrame({ protocolVersion: BROWSER_PROTOCOL_REVISION,
      kind: "PAIR_PROOF", epoch: 0, sequence: 1, deadline: pending.hello.deadline,
      body: { clientSignature, clientPairingMac } }),
  });
};

export const verifyServerAuthenticated = async (
  session: AuthenticatedSession | null, frame: BrowserAuthorityFrame, epoch: number,
): Promise<void> => {
  if (!session || frame.epoch !== epoch || frame.sequence !== 0
    || typeof frame.body.serverFinalSignature !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const verified = await globalThis.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" },
    session.serverSigningPublicKey, cryptoBytes(fromBase64Url(frame.body.serverFinalSignature)),
    cryptoBytes(encodeText(`authenticated:${session.transcript}`)));
  if (!verified) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

export const readServerReadyPermit = async (
  session: AuthenticatedSession | null, frame: BrowserAuthorityFrame, epoch: number,
): Promise<Readonly<{ authorityRef: string; authorityEpoch: number;
  certificateHash: `sha256:${string}`; channelSessionHash: `sha256:${string}`;
  commandPermitKey: string }>> => {
  if (!session || frame.epoch !== epoch || frame.sequence !== 1) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const ready = await decrypt(session.serverToClientKey, "server-to-client", frame);
  if (typeof ready.authorityRef !== "string" || typeof ready.authorityEpoch !== "number"
    || typeof ready.certificateHash !== "string"
    || typeof ready.channelSessionHash !== "string"
    || typeof ready.commandPermitKey !== "string") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { authorityRef: ready.authorityRef, authorityEpoch: ready.authorityEpoch,
    certificateHash: ready.certificateHash as `sha256:${string}`,
    channelSessionHash: ready.channelSessionHash as `sha256:${string}`,
    commandPermitKey: ready.commandPermitKey };
};
