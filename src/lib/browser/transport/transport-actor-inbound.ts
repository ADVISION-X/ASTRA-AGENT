import {
  GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES,
} from "../protocol/generated/browser-protocol.js";
import type { BrowserArtifactChunk } from "../exact-target/browser-artifact-stream.js";
import type { TransportHostCandidate } from "./transport-actor-runtime.js";

export const isArtifactChunk = (value: unknown): value is BrowserArtifactChunk => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserArtifactChunk>;
  return (
    item.type === "artifact_chunk" &&
    typeof item.artifactRef === "string" &&
    typeof item.commandId === "string" &&
    typeof item.authorityRef === "string" &&
    Number.isSafeInteger(item.authorityEpoch) &&
    Number.isSafeInteger(item.sequence) &&
    typeof item.contentHash === "string" &&
    Number.isSafeInteger(item.chunkIndex) &&
    Number.isSafeInteger(item.chunkCount) &&
    Number.isSafeInteger(item.byteLength) &&
    typeof item.dataBase64 === "string"
  );
};

export type TransportActorInboundPort = Readonly<{
  terminate(reason: string): void;
  enqueue(operation: () => void | Promise<void>): Promise<void>;
  handleIncoming(
    candidate: TransportHostCandidate,
    value: unknown,
  ): Promise<void>;
}>;

export const receiveTransportActorData = (
  port: TransportActorInboundPort,
  candidate: TransportHostCandidate,
  chunk: string,
): void => {
  candidate.buffer += chunk;
  if (frameBufferExceedsBudget(candidate.buffer)) {
    port.terminate("BROWSER_BACKPRESSURE:host frame buffer exceeded");
    return;
  }
  for (;;) {
    const line = takeNextFrame(candidate);
    if (line === null) return;
    if (!line) continue;
    const parsed = parseFrame(line, port);
    if (parsed === undefined) return;
    void port.enqueue(() => port.handleIncoming(candidate, parsed));
  }
};

const frameBufferExceedsBudget = (value: string): boolean =>
  Buffer.byteLength(value, "utf8") >
  GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES + 64 * 1024;

const takeNextFrame = (candidate: TransportHostCandidate): string | null => {
  const newline = candidate.buffer.indexOf("\n");
  if (newline < 0) return null;
  const line = candidate.buffer.slice(0, newline);
  candidate.buffer = candidate.buffer.slice(newline + 1);
  return line;
};

const parseFrame = (
  line: string,
  port: TransportActorInboundPort,
): unknown | undefined => {
  try {
    return JSON.parse(line);
  } catch {
    port.terminate("BROWSER_AUTH_TRANSCRIPT_INVALID:invalid JSON");
    return undefined;
  }
};
