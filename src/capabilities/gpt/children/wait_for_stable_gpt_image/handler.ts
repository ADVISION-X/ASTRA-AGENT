import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";

import {
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { assistantTurnForIdentity, ensureResponseConversation } from "./page-observation.js";
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

const validProbeBudget = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 1 && value <= 3_600_000;

const documentOwnsMedia = (
  authorityRefHashes: readonly `sha256:${string}`[],
  media: Readonly<{ authorityTargetHash: `sha256:${string}`; authorityDocumentHash: `sha256:${string}` }>,
): boolean => authorityRefHashes.includes(media.authorityTargetHash)
  && authorityRefHashes.includes(media.authorityDocumentHash);

export const waitForStableGptImageHandler: GptChildHandler<"wait_for_stable_gpt_image"> =
  async (intent, context) => {
    const invocationStartedAt = Date.now();
    requireExactInputKeys(intent, ["canonicalConversationUrl", "conversationIdentityHash", "expectedPromptHash", "probeBudgetMs", "turnMarker"]);
    const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const conversationIdentityHash = responseHashInput(intent, "conversationIdentityHash");
    const expectedPromptHash = responseHashInput(intent, "expectedPromptHash");
    const turnMarker = stringInput(intent, "turnMarker");
    const probeBudgetMs = numberInput(intent, "probeBudgetMs");
    if (!validProbeBudget(probeBudgetMs)) {
      throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    }
    const deadline = invocationStartedAt + probeBudgetMs;
    const browser = requireBrowser(context);
    let prior: Readonly<{ assistantTurnId: string; mediaHash: `sha256:${string}` }> | null = null;
    let rateLimitAcknowledged = false;
    let probeDelayMs = 250;
    do {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_IMAGE_WAIT_ABORTED");
      if (Date.now() >= deadline) break;
      const observed = await ensureResponseConversation({
        browser, canonicalConversationUrl: conversationUrl, context, deadline,
      });
      if (Date.now() >= deadline) break;
      const assistantTurnId = assistantTurnForIdentity(observed, {
        canonicalConversationUrl: conversationUrl, conversationIdentityHash, expectedPromptHash, turnMarker,
      });
      if (assistantTurnId && observed.generatingRaw === 0) {
        try {
          const media = await browser.downloadAuthenticatedMedia({
            assistantTurnId, semanticMediaId: "gpt-generated-image-main", delivery: "probe",
          });
          if (Date.now() >= deadline) break;
          if (!documentOwnsMedia(observed.facts.authorityRefHashes, media)) {
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
