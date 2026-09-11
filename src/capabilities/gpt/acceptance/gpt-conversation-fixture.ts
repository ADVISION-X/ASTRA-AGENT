import { createHash } from "node:crypto";

export const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const conversationUrl = "https://chatgpt.com/c/gpt-browser-handoff";
export const promptHash = hash("[GRASSEYE:gpt-browser-handoff]\napproved prompt");
export const approvedFile = Object.freeze({
  artifactRef: "artifact:approved",
  displayName: "approved.pdf",
  providerDisplayName: "approved-0123456789ab.pdf",
  sha256: hash("approved-file"),
  bytes: 10,
});
