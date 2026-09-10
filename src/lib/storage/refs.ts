import { createHash } from "node:crypto";

const refHash = (identity: string): string =>
  createHash("sha256").update(identity, "utf8").digest("hex");

export function createArtifactRef(identity: string): string {
  return `art-${refHash(`artifact\0${identity}`)}`;
}
