import { createHash } from "node:crypto";
import sharp from "sharp";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  numberInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  projectExactAssistantTurn,
  readExactAssistantTurn,
} from "../../web/gpt-dom-observation.js";
import { responseHashInput } from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import { adjacentGptAssistantTurnId, readCurrentGptDocumentUrl } from
  "../checkpoint_gpt_text_response/exact-response.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const renderGeneratedImage = async (original: Buffer): Promise<Buffer> => {
  const webp = await sharp(original, { failOn: "error", limitInputPixels: 100_000_000 })
    .rotate().resize(1200, 630, { fit: "cover", position: "centre" })
    .webp({ quality: 90, effort: 6 }).toBuffer();
  const metadata = await sharp(webp, { failOn: "error", limitInputPixels: false }).metadata();
  if (metadata.format !== "webp" || metadata.width !== 1200 || metadata.height !== 630
    || metadata.exif || metadata.icc || metadata.iptc || metadata.xmp) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_MECHANICAL_IDENTITY_INVALID");
  }
  return webp;
};

export const checkpointGptGeneratedImageHandler:
GptChildHandler<"checkpoint_gpt_generated_image"> = async (intent, context) => {
  requireExactInputKeys(intent, ["canonicalConversationUrl", "expectedPromptHash", "probeBudgetMs", "turnMarker", "userTurnId"]);
  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
  const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
  const turnMarker = stringInput(intent, "turnMarker");
  const userTurnId = stringInput(intent, "userTurnId");
  const exactAssistantTurnId = adjacentGptAssistantTurnId(userTurnId);
  const probeBudgetMs = numberInput(intent, "probeBudgetMs");
  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) {
    throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
  }
  const browser = requireBrowser(context);
  const deadline = Date.now() + probeBudgetMs;
  let observed: Awaited<ReturnType<typeof readExactAssistantTurn>> | null = null;
  let assistantTurnId: string;
  let media: Awaited<ReturnType<typeof browser.downloadAuthenticatedMedia>>;
  for (;;) {
    if (await readCurrentGptDocumentUrl(browser) !== conversationUrl) {
      if (!context.selectExactProviderConversation) {
        throw executionFailure("failed", "GPT_PROVIDER_CONVERSATION_GATE_REQUIRED");
      }
      if (await context.selectExactProviderConversation(conversationUrl, deadline) === "deadline") {
        throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
      }
      continue;
    }
    try {
      observed = await readExactAssistantTurn(browser, exactAssistantTurnId, {
        canonicalConversationUrl: conversationUrl, expectedPromptHash, turnMarker,
      });
    } catch (error) {
      if (failureCode(error) !== "BROWSER_DOM_CANDIDATE_MISSING") throw error;
      observed = null;
    }
    if (observed && observed.generatingRaw === 0) {
      try {
        media = await browser.downloadAuthenticatedMedia({ assistantTurnId: exactAssistantTurnId,
          semanticMediaId: "gpt-generated-image-main", delivery: "visible-download" });
        assistantTurnId = exactAssistantTurnId;
        break;
      } catch (error) {
        if (failureCode(error) !== "BROWSER_AUTHENTICATED_MEDIA_ABSENT") throw error;
      }
    }
    if (!context.yieldForProviderProbe) {
      throw executionFailure("failed", "GPT_PROVIDER_PROBE_GATE_REQUIRED");
    }
    if (await context.yieldForProviderProbe(conversationUrl, deadline) === "deadline") {
      throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
    }
  }
  if (!observed) throw executionFailure("failed", "GPT_IMAGE_TIMEOUT");
  const observedFacts = projectExactAssistantTurn(observed);
  if (!observedFacts.authorityRefHashes.includes(media.authorityTargetHash)
    || !observedFacts.authorityRefHashes.includes(media.authorityDocumentHash)) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_DOCUMENT_MISMATCH");
  }
  const original = Buffer.from(media.bytesBase64, "base64");
  if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
  }
  const webp = await renderGeneratedImage(original);
  const imageHash = hash(webp);
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return success({
    value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
      authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
      canonicalConversationUrl: conversationUrl, promptHash: expectedPromptHash, turnMarker,
      artifactId: `airesult_${imageHash.slice(7, 39)}`,
      originalBytes: new Uint8Array(original), webpBytes: new Uint8Array(webp), sha256: imageHash,
      originalSha256: media.sha256, originalSizeBytes: original.byteLength,
      originalMediaType: media.mediaType, originalWidth: media.width, originalHeight: media.height,
      bytes: webp.byteLength, mediaType: "image/webp", width: 1200, height: 630,
      },
    ...declaredFacts({ ...observedFacts, decision: "ACT",
      factResultIds: Object.freeze([...observedFacts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...observedFacts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: browserFact.mutationOutcome, browserFact, nativeFailureCode: null }),
  });
};
