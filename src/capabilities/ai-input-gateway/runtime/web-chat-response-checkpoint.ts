import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type WebChatResponseCheckpoint = {
  rawOutputRef: string;
  rawOutputHash: `sha256:${string}`;
  byteCount: number;
  capturedAt: string;
  pageUrl: string;
  providerExecutionProfileProof: Readonly<{ profileHash: `sha256:${string}` }> | null;
};

const responseCheckpointPath = (dataDir: string, executionId: string): string =>
  path.join(
    dataDir,
    "runtime-data",
    "ai-input-gateway",
    "web-chat-response-checkpoints",
    `${createHash("sha256").update(executionId).digest("hex")}.txt`,
  );

export const persistWebChatResponseCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  answerText: string;
  pageUrl: string;
  providerExecutionProfileProof: Readonly<{ profileHash: `sha256:${string}` }> | null;
}): Promise<WebChatResponseCheckpoint> => {
  const destination = responseCheckpointPath(input.dataDir, input.executionId);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const bytes = Buffer.from(input.answerText, "utf8");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  return {
    rawOutputRef: destination,
    rawOutputHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    byteCount: bytes.byteLength,
    capturedAt: new Date().toISOString(),
    pageUrl: input.pageUrl,
    providerExecutionProfileProof: input.providerExecutionProfileProof,
  };
};

export const readWebChatResponseCheckpoint = async (
  checkpoint: WebChatResponseCheckpoint,
): Promise<string> => {
  const bytes = await readFile(checkpoint.rawOutputRef);
  const actualHash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (bytes.byteLength !== checkpoint.byteCount || actualHash !== checkpoint.rawOutputHash) {
    throw new Error("review_required: persisted web-chat response checkpoint identity is invalid.");
  }
  return bytes.toString("utf8");
};
