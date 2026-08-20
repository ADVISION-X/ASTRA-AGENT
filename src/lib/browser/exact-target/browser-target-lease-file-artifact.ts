import { randomUUID } from "node:crypto";

import type {
  BrowserActionResult,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type { BrowserWireCommand } from "../protocol/generated/browser-protocol.js";
import type { BrowserMutationClass } from "./browser-command-contract.js";
import type { BrowserFileArtifactGrantV1 } from "./browser-file-artifact-grant.js";

const FILE_CHUNK_BYTES = 48 * 1024;

type ResolvedArtifact = Readonly<{
  grant: BrowserFileArtifactGrantV1;
  bytes: Buffer;
}>;

export type BrowserTargetLeaseFileArtifactPort = Readonly<{
  rawTabId(): number;
  command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<{ commandId: string; result: T }>;
  resolveArtifact(grant: BrowserFileArtifactGrantV1): Promise<ResolvedArtifact>;
  destroyArtifact(grantRef: string): Promise<void>;
  action(id: string, message: string, started: number): BrowserActionResult;
  defaultAbortSignal(): AbortSignal | undefined;
}>;

export const setBrowserFileInputArtifact = async (
  port: BrowserTargetLeaseFileArtifactPort,
  input: Parameters<BrowserTargetLease["setFileInputArtifact"]>[0],
): Promise<BrowserActionResult> => {
  const started = Date.now();
  const resolved = await port.resolveArtifact(input.grant);
  try {
    await stageAllChunks(port, resolved, input.abortSignal);
    await port.command(
      {
        kind: "set_file_input_artifact",
        tabId: port.rawTabId(),
        selector: input.elementRef.selector,
        fileGrant: resolved.grant,
      },
      "non_idempotent_mutation",
      input.abortSignal ?? port.defaultAbortSignal(),
      30_000,
    );
    return port.action(
      `browser-file-input:${randomUUID()}`,
      input.description,
      started,
    );
  } finally {
    await port.destroyArtifact(input.grant.grantRef);
  }
};

const stageAllChunks = async (
  port: BrowserTargetLeaseFileArtifactPort,
  resolved: ResolvedArtifact,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const chunkCount = Math.max(
    1,
    Math.ceil(resolved.bytes.byteLength / FILE_CHUNK_BYTES),
  );
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    await stageChunk(port, resolved, chunkIndex, chunkCount, abortSignal);
  }
};

const stageChunk = async (
  port: BrowserTargetLeaseFileArtifactPort,
  resolved: ResolvedArtifact,
  chunkIndex: number,
  chunkCount: number,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const chunk = resolved.bytes.subarray(
    chunkIndex * FILE_CHUNK_BYTES,
    Math.min(resolved.bytes.byteLength, (chunkIndex + 1) * FILE_CHUNK_BYTES),
  );
  await port.command(
    {
      kind: "stage_file_artifact_chunk",
      tabId: port.rawTabId(),
      grantRef: resolved.grant.grantRef,
      artifactRef: resolved.grant.artifactRef,
      fileName: resolved.grant.fileName,
      contentHash: resolved.grant.contentHash,
      byteLength: resolved.grant.byteLength,
      chunkIndex,
      chunkCount,
      dataBase64: chunk.toString("base64"),
    },
    "idempotent_mutation",
    abortSignal ?? port.defaultAbortSignal(),
    10_000,
  );
};
