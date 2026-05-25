import { createHash } from "node:crypto";

export const buildDeepResearchTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
