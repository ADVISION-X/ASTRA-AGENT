import { BROWSER_ARTIFACT_CHUNK_MAX_BYTES } from "../protocol/generated/browser-protocol.generated.js";

export const assertArtifactChunk = (chunk: Uint8Array): void => {
  if (chunk.byteLength > BROWSER_ARTIFACT_CHUNK_MAX_BYTES) throw new Error("BROWSER_BACKPRESSURE");
};
