import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type BrowserArtifactChunk = Readonly<{
  type: "artifact_chunk";
  artifactRef: string;
  commandId: string;
  authorityRef: string;
  authorityEpoch: number;
  sequence: number;
  contentHash: `sha256:${string}`;
  chunkIndex: number;
  chunkCount: number;
  byteLength: number;
  dataBase64: string;
}>;

export type BrowserArtifactReceipt = Readonly<{
  artifactRef: string;
  contentHash: `sha256:${string}`;
  byteLength: number;
  filePath: string;
}>;

type StreamState = {
  artifactRef: string;
  commandId: string;
  authorityRef: string;
  authorityEpoch: number;
  sequence: number;
  contentHash: `sha256:${string}`;
  chunkCount: number;
  chunks: Map<number, Buffer>;
  receivedBytes: number;
};

export class BrowserArtifactStreamReceiver {
  private readonly streams = new Map<string, StreamState>();

  constructor(
    private readonly rootDir: string,
    private readonly budget: {
      maxArtifactStreams: number;
      maxArtifactBytes: number;
      maxChunkBytes: number;
    },
  ) {}

  accept(chunk: BrowserArtifactChunk): void {
    const data = this.validateChunk(chunk);
    const state = this.getOrCreateState(chunk);
    this.assertChunkBinding(state, chunk);
    if (state.receivedBytes + data.byteLength > this.budget.maxArtifactBytes) {
      this.streams.delete(chunk.artifactRef);
      throw new Error("BROWSER_BACKPRESSURE:artifact bytes exceeded");
    }
    state.chunks.set(chunk.chunkIndex, data);
    state.receivedBytes += data.byteLength;
  }

  private validateChunk(chunk: BrowserArtifactChunk): Buffer {
    if (
      !Number.isSafeInteger(chunk.chunkIndex) ||
      chunk.chunkIndex < 0 ||
      !Number.isSafeInteger(chunk.chunkCount) ||
      chunk.chunkCount < 1 ||
      chunk.chunkIndex >= chunk.chunkCount
    )
      throw new Error("BROWSER_ARTIFACT_CHUNK_INVALID");
    const data = Buffer.from(chunk.dataBase64, "base64");
    if (data.byteLength === 0 || data.byteLength > this.budget.maxChunkBytes) {
      throw new Error("BROWSER_BACKPRESSURE:artifact chunk exceeds budget");
    }
    return data;
  }

  private getOrCreateState(chunk: BrowserArtifactChunk): StreamState {
    const existing = this.streams.get(chunk.artifactRef);
    if (existing) return existing;
    if (this.streams.size >= this.budget.maxArtifactStreams) {
      throw new Error(
        "BROWSER_BACKPRESSURE:artifact stream concurrency exceeded",
      );
    }
    const state: StreamState = {
      artifactRef: chunk.artifactRef,
      commandId: chunk.commandId,
      authorityRef: chunk.authorityRef,
      authorityEpoch: chunk.authorityEpoch,
      sequence: chunk.sequence,
      contentHash: chunk.contentHash,
      chunkCount: chunk.chunkCount,
      chunks: new Map(),
      receivedBytes: 0,
    };
    this.streams.set(chunk.artifactRef, state);
    return state;
  }

  private assertChunkBinding(
    state: StreamState,
    chunk: BrowserArtifactChunk,
  ): void {
    const mismatched =
      state.commandId !== chunk.commandId ||
      state.authorityRef !== chunk.authorityRef ||
      state.authorityEpoch !== chunk.authorityEpoch ||
      state.sequence !== chunk.sequence ||
      state.contentHash !== chunk.contentHash ||
      state.chunkCount !== chunk.chunkCount ||
      state.chunks.has(chunk.chunkIndex);
    if (!mismatched) return;
    this.streams.delete(chunk.artifactRef);
    throw new Error("BROWSER_ARTIFACT_CHUNK_BINDING_INVALID");
  }

  async finalize(input: {
    artifactRef: string;
    contentHash: `sha256:${string}`;
    byteLength: number;
  }): Promise<BrowserArtifactReceipt> {
    const state = this.streams.get(input.artifactRef);
    if (
      !state ||
      state.contentHash !== input.contentHash ||
      state.chunks.size !== state.chunkCount ||
      state.receivedBytes !== input.byteLength
    ) {
      throw new Error("BROWSER_ARTIFACT_STREAM_INCOMPLETE");
    }
    const chunks: Buffer[] = [];
    for (let index = 0; index < state.chunkCount; index += 1) {
      const chunk = state.chunks.get(index);
      if (!chunk) throw new Error("BROWSER_ARTIFACT_STREAM_INCOMPLETE");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const actual =
      `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
    if (actual !== input.contentHash || bytes.byteLength !== input.byteLength) {
      this.streams.delete(input.artifactRef);
      throw new Error("BROWSER_ARTIFACT_STREAM_HASH_MISMATCH");
    }
    await mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    const name = input.contentHash.slice(7);
    const finalPath = path.join(this.rootDir, `${name}.artifact`);
    const tempPath = `${finalPath}.tmp`;
    await writeFile(tempPath, bytes, { mode: 0o600 });
    await rename(tempPath, finalPath);
    this.streams.delete(input.artifactRef);
    return Object.freeze({
      artifactRef: input.artifactRef,
      contentHash: input.contentHash,
      byteLength: input.byteLength,
      filePath: finalPath,
    });
  }

  async discardAll(): Promise<void> {
    this.streams.clear();
    await rm(this.rootDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}
