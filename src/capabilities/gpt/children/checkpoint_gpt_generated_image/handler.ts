import { createHash } from "node:crypto";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const checkpointGptGeneratedImageHandler:
GptChildHandler<"checkpoint_gpt_generated_image"> = async (intent, context) => {
  requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const turnMarker = stringInput(intent, "turnMarker");
  const userTurnId = stringInput(intent, "userTurnId");
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) {
    throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  }
  const browser = requireBrowser(context);
  const deadline = Date.now() + probeBudgetMs;
  let media: Awaited<ReturnType<typeof browser.readAuthenticatedMedia>>;
  for (;;) {
    if (Date.now() >= deadline) throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    if (!context.waitForProviderObservation) {
      throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");
    }
    if (await context.waitForProviderObservation(
      deadline, "generated-image-source-pending",
    ) === "deadline") {
      throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    }
    try {
      media = await browser.readAuthenticatedMedia({ canonicalConversationUrl: conversationUrl, userTurnId,
        semanticMediaId: "gpt-generated-image-main" });
      break;
    } catch (error) {
      const code = failureCode(error);
      if (code !== "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT"
        && code !== "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT") throw error;
    }
  }
  const original = Buffer.from(media.bytesBase64, "base64");
  if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
  }
  return success({
    value: { assistantTurnId: media.assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
      authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
      canonicalConversationUrl: conversationUrl, turnMarker,
      originalBytes: new Uint8Array(original),
      originalSha256: media.sha256, originalSizeBytes: original.byteLength,
      originalMediaType: media.mediaType,
      },
    ...declaredFacts({ decision: "DONE", factResultIds: Object.freeze([media.sha256]),
      candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
      authorityRefHashes: Object.freeze([media.authorityTargetHash, media.authorityDocumentHash]),
      observationRevisionHash: null,
      mutationOutcome: "no", browserFact: null, nativeFailureCode: null }),
  });
};
