import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const INFO = Buffer.from("grasseye-browser-command-frame-v3", "utf8");
export type BrowserControllerEphemeralKey = Readonly<{
  publicKeyBase64: string;
  computeSharedSecret(
    extensionPublicKeyBase64: string,
    nonceBase64: string,
  ): Buffer;
}>;
export const createBrowserControllerEphemeralKey =
  (): BrowserControllerEphemeralKey => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    return Object.freeze({
      publicKeyBase64: ecdh.getPublicKey().toString("base64"),
      computeSharedSecret(
        extensionPublicKeyBase64: string,
        nonceBase64: string,
      ): Buffer {
        const raw = ecdh.computeSecret(
          Buffer.from(extensionPublicKeyBase64, "base64"),
        );
        return Buffer.from(
          hkdfSync("sha256", raw, Buffer.from(nonceBase64, "base64"), INFO, 32),
        );
      },
    });
  };
export const browserTranscriptProof = (
  key: Buffer,
  transcript: string,
): string => createHmac("sha256", key).update(transcript).digest("base64");
export const verifyBrowserTranscriptProof = (
  key: Buffer,
  transcript: string,
  proofBase64: string,
): boolean => {
  const expected = Buffer.from(
    browserTranscriptProof(key, transcript),
    "base64",
  );
  const actual = Buffer.from(proofBase64, "base64");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
export type BrowserFrameBinding = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  replyChannelToken: string;
  sequence: number;
  permitHash: `sha256:${string}`;
}>;
const aad = (input: BrowserFrameBinding): Buffer =>
  Buffer.from(
    [
      input.authorityRef,
      input.authorityEpoch,
      input.replyChannelToken,
      input.sequence,
      input.permitHash,
    ].join(":"),
    "utf8",
  );
export const encryptBrowserFrame = (
  key: Buffer,
  binding: BrowserFrameBinding,
  value: unknown,
): Readonly<{ iv: string; ciphertext: string }> => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return Object.freeze({
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
};
export const decryptBrowserFrame = <T>(
  key: Buffer,
  binding: BrowserFrameBinding,
  input: Readonly<{ iv: string; ciphertext: string }>,
): T => {
  const packed = Buffer.from(input.ciphertext, "base64");
  if (packed.length < 17) throw new Error("BROWSER_FRAME_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(input.iv, "base64"),
  );
  decipher.setAAD(aad(binding));
  decipher.setAuthTag(packed.subarray(packed.length - 16));
  const plaintext = Buffer.concat([
    decipher.update(packed.subarray(0, packed.length - 16)),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
};
