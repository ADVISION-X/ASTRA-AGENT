import { timingSafeEqual } from "node:crypto";

import {
  canonicalizeBrowserAuthorityValue,
  type BrowserAuthorityFrame,
} from "./browser-authority-frame-codec.js";

export const authorityRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const encryptedFrameBody = (
  frame: BrowserAuthorityFrame,
): Readonly<{ nonce: string; ciphertext: string; tag: string }> => {
  const body = authorityRecord(frame.body);
  const encrypted = body ? authorityRecord(body.encrypted) : null;
  if (!encrypted || typeof encrypted.nonce !== "string"
    || typeof encrypted.ciphertext !== "string" || typeof encrypted.tag !== "string") {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return { nonce: encrypted.nonce, ciphertext: encrypted.ciphertext, tag: encrypted.tag };
};

export const canonicalBrowserAuthorityPlaintext = (value: unknown): string =>
  canonicalizeBrowserAuthorityValue(value);

export const parseCanonicalPlaintext = (value: string): Record<string, unknown> => {
  try {
    const body = authorityRecord(JSON.parse(value) as unknown);
    if (!body || canonicalBrowserAuthorityPlaintext(body) !== value) throw new Error("invalid canonical plaintext");
    return body;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

export const compareReplyToken = (actual: string, expected: string): boolean => {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
};
