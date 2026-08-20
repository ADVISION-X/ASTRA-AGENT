import { createHash, randomUUID } from "node:crypto";

export type ReplyChannelToken = Readonly<{
  value: string;
  connectionGeneration: number;
  hostProcessEpoch: number;
  nativePortEpoch: number;
  sourceChannelHash: `sha256:${string}`;
}>;

export const issueReplyChannelToken = (input: {
  connectionGeneration: number;
  hostProcessEpoch: number;
  nativePortEpoch: number;
  sourceChannelIdentity: string;
}): ReplyChannelToken =>
  Object.freeze({
    value: `reply:${randomUUID()}`,
    connectionGeneration: input.connectionGeneration,
    hostProcessEpoch: input.hostProcessEpoch,
    nativePortEpoch: input.nativePortEpoch,
    sourceChannelHash: `sha256:${createHash("sha256")
      .update(input.sourceChannelIdentity)
      .digest("hex")}`,
  });
