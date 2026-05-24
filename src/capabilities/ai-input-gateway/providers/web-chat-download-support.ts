import { createHash } from "node:crypto";

export const calculateFileSha256 = (bytes: Buffer): string =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");

