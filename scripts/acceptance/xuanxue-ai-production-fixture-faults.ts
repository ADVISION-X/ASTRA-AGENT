import { createHash } from "node:crypto";

import type {
  AiFeedInput,
  AiFeedResult,
} from "../../src/capabilities/ai-input-gateway/index.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const withoutOutput = (result: AiFeedResult): AiFeedResult => ({
  ...result,
  status: "failed",
  rawResponseText: null,
  normalizedText: null,
  rawOutputRef: null,
  rawOutputHash: null,
  parsedJson: null,
  schemaValidationStatus: "invalid",
  providerProof: {
    ...result.providerProof,
    outputHash: null,
    outputRefs: [],
  },
  failureReason: "不能获取对象。 (-1728)",
});

const terminalAttachmentFailure = (
  result: AiFeedResult,
): AiFeedResult => {
  const occurredAt = new Date().toISOString();
  const failed = withoutOutput(result);
  return {
    ...failed,
    providerProof: {
      ...failed.providerProof,
      webChatUrl: null,
      freshConversationProof: null,
      uploadedFileRefs: [],
      uploadedFiles: [],
      attachmentUploadProof: {
        childCapabilityId: "attach-approved-web-chat-files-once",
        uploadAttemptId: "fixture-terminal-attachment-attempt",
        transportKind: "ordered_clipboard",
        expectedFileCount: 1,
        detectedFileCount: 0,
        stagingManifestHash: hash("fixture-terminal-attachment-manifest"),
        files: [{
          inputRefId: "terminal-attachment-fixture",
          order: 1,
          sourceFileName: "terminal-attachment-fixture.json",
          displayFileName: "terminal-attachment-fixture.json",
          sha256: hash("terminal-attachment-fixture"),
          byteCount: 27,
        }],
        startedAt: occurredAt,
        endedAt: occurredAt,
        status: "failed",
        failureReason: "WEB_CHAT_ATTACHMENT_TRANSPORT_FAILED",
        reviewRequiredReason: null,
      },
    },
    failureReason: "WEB_CHAT_ATTACHMENT_TRANSPORT_FAILED",
  };
};

const contaminatedResult = (result: AiFeedResult): AiFeedResult => {
  const rawResponseText = `{"answer":"\uE200filecite\uE202turn0file0\uE201"}`;
  const rawOutputHash = hash(rawResponseText);
  return {
    ...result,
    rawResponseText,
    normalizedText: rawResponseText,
    rawOutputHash,
    providerProof: { ...result.providerProof, outputHash: rawOutputHash },
  };
};

const reviewFailure = (
  result: AiFeedResult,
  reason: string,
): AiFeedResult => ({
  ...withoutOutput(result),
  status: "review_required",
  failureReason: null,
  reviewRequiredReason: reason,
});

type ConsumedFixtureFault = {
  result: AiFeedResult;
  emitsRecoveryProgress: boolean;
};

export class FixtureGatewayFaults {
  readonly transient = new Map<string, number>();
  readonly terminalAttachment = new Map<string, number>();
  readonly submittedReview = new Map<string, number>();
  readonly contaminated = new Map<string, number>();
  readonly continuation = new Map<string, number>();

  private take(
    inventory: Map<string, number>,
    key: string,
  ): boolean {
    const remaining = inventory.get(key) ?? 0;
    if (remaining < 1) return false;
    inventory.set(key, remaining - 1);
    return true;
  }

  consume(
    request: AiFeedInput,
    result: AiFeedResult,
  ): ConsumedFixtureFault | null {
    const key = request.taskIdentity.sourceTaskId;
    if (this.take(this.continuation, key)) return {
      result: reviewFailure(result,
        "WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT: expected=https://chatgpt.com/c/old-parent; actual=https://chatgpt.com/"),
      emitsRecoveryProgress: false,
    };
    if (this.take(this.submittedReview, key)) return {
      result: reviewFailure(result,
        "review_required: more than one physical provider tab is open."),
      emitsRecoveryProgress: false,
    };
    if (this.take(this.terminalAttachment, key)) return {
      result: terminalAttachmentFailure(result),
      emitsRecoveryProgress: false,
    };
    if (this.take(this.transient, key)) return {
      result: withoutOutput(result),
      emitsRecoveryProgress: true,
    };
    if (this.take(this.contaminated, key)) return {
      result: contaminatedResult(result),
      emitsRecoveryProgress: false,
    };
    return null;
  }
}
