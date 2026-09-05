import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { assistantTurnForPrompt, ensureResponseConversation } from "./page-observation.js";
import {
  maybeAcknowledgeRateLimit,
  providerWait,
  responseCompletionFacts,
  responseHashInput,
} from "./response-support.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const stableImageObserved = (
  prior: Readonly<{ assistantTurnId: string; mediaHash: `sha256:${string}` }> | null,
  assistantTurnId: string,
  mediaHash: `sha256:${string}`,
): boolean => prior !== null && prior.assistantTurnId === assistantTurnId && prior.mediaHash === mediaHash;

export const waitForStableGptImageHandler: GptChildHandler<"wait_for_stable_gpt_image"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
    stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    if (Date.now() >= deadline) throw executionFailure("failed", "GPT_IMAGE_STABILITY_TIMEOUT");
    const browser = requireBrowser(context);
    let prior: Readonly<{ assistantTurnId: string; mediaHash: `sha256:${string}` }> | null = null;
    let rateLimitAcknowledged = false;
    let probeDelayMs = 250;
    do {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_IMAGE_WAIT_ABORTED");
      const observed = await ensureResponseConversation(browser, conversationUrl);
      const assistantTurnId = assistantTurnForPrompt(observed, expectedPromptHash);
      if (assistantTurnId && observed.generatingRaw === 0) {
        try {
          const media = await browser.downloadAuthenticatedMedia({
            assistantTurnId, semanticMediaId: "gpt-generated-image-main",
          });
          if (!observed.facts.authorityRefHashes.includes(media.authorityTargetHash)
            || !observed.facts.authorityRefHashes.includes(media.authorityDocumentHash)) {
            throw executionFailure("failed", "GPT_GENERATED_IMAGE_DOCUMENT_MISMATCH");
          }
          if (stableImageObserved(prior, assistantTurnId, media.sha256)) return success({
            value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256 },
            ...responseCompletionFacts(intent, browser, observed.facts, rateLimitAcknowledged),
          });
          prior = Object.freeze({ assistantTurnId, mediaHash: media.sha256 });
        } catch (error) {
          if (failureCode(error) !== "BROWSER_AUTHENTICATED_MEDIA_ABSENT") throw error;
        }
      }
      rateLimitAcknowledged = await maybeAcknowledgeRateLimit(
        browser, observed, rateLimitAcknowledged, context.mutationMode === "readback",
      );
      const remaining = deadline - Date.now();
      if (remaining >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remaining));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    } while (Date.now() < deadline);
    throw executionFailure("failed", "GPT_IMAGE_STABILITY_TIMEOUT");
  };
