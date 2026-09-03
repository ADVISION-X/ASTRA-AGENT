import { createHash } from "node:crypto";
import sharp from "sharp";
import { executionFailure, failureCode } from "../../../../lib/execution-failure.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  declaredFacts, recordInput, requireBrowser, requireConfirmedBrowserFact,
  requireExactInputKeys, stringInput, success,
} from "../child-handler.js";
import type { GptCoherentFactProjection } from "../gpt-dom-observation.js";
import {
  assistantTurnForPrompt, ensureResponseConversation, rateLimitState, type GptResponsePageState,
} from "../gpt-response-page.js";
import { GPT_RATE_LIMIT_ACK_SELECTOR, GPT_RATE_LIMIT_ROOT_SELECTOR } from "../gpt-page-selectors.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";
import type { GptTextCheckpointInput } from "../../contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-[1-9][0-9]*$/u;
const TEXT_CHECKPOINT_KEYS = [
  "artifactRef", "assistantTurnId", "canonicalConversationUrl", "checkpointKind", "evidenceHash",
  "evidenceRef", "promptHash", "rawDomHash", "semanticTextHash", "sourceAttemptId", "turnMarker",
] as const;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const hashInput = (intent: AnyIntent, key: string): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value as `sha256:${string}`;
};

const predecessorInput = (intent: AnyIntent): GptTextCheckpointInput => {
  const checkpoint = recordInput(intent, "predecessorTextCheckpoint");
  if (Object.keys(checkpoint).sort().join("|") !== [...TEXT_CHECKPOINT_KEYS].sort().join("|")
    || checkpoint.checkpointKind !== "text"
    || typeof checkpoint.assistantTurnId !== "string" || !TURN.test(checkpoint.assistantTurnId)
    || typeof checkpoint.canonicalConversationUrl !== "string"
    || typeof checkpoint.sourceAttemptId !== "string" || checkpoint.sourceAttemptId.length === 0
    || typeof checkpoint.artifactRef !== "string" || checkpoint.artifactRef.length === 0
    || typeof checkpoint.evidenceRef !== "string" || checkpoint.evidenceRef.length === 0
    || typeof checkpoint.turnMarker !== "string" || checkpoint.turnMarker.length === 0
    || [checkpoint.evidenceHash, checkpoint.promptHash, checkpoint.rawDomHash, checkpoint.semanticTextHash]
      .some((value) => typeof value !== "string" || !HASH.test(value))) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:predecessorTextCheckpoint`);
  }
  canonicalGptConversationUrl(checkpoint.canonicalConversationUrl);
  return checkpoint as GptTextCheckpointInput;
};

const providerWait = (
  context: Parameters<AnyHandler>[1],
  browser: BrowserTargetLease,
  durationMs: number,
): Promise<void> => context.yieldForProviderWait
  ? context.yieldForProviderWait(Math.max(25, Math.min(5_000, Math.floor(durationMs))))
  : browser.wait({ durationMs: Math.max(25, Math.min(5_000, Math.floor(durationMs))) });

const maybeAcknowledgeRateLimit = async (
  browser: BrowserTargetLease,
  state: GptResponsePageState,
  alreadyAcknowledged: boolean,
  readbackOnly: boolean,
): Promise<boolean> => {
  const rate = rateLimitState(state);
  if (rate === "absent") return alreadyAcknowledged;
  if (alreadyAcknowledged) throw executionFailure("failed", "GPT_PROVIDER_RATE_LIMIT_DIALOG_REPEATED");
  if (readbackOnly) throw executionFailure("failed", "GPT_PROVIDER_RATE_LIMIT_ACK_PENDING");
  await browser.executeDomIntent({
    kind: "click", selector: GPT_RATE_LIMIT_ACK_SELECTOR, expectedMatches: 1,
    postClickMatch: { selector: GPT_RATE_LIMIT_ROOT_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
  });
  return true;
};

const completionFacts = (
  intent: AnyIntent,
  browser: BrowserTargetLease,
  facts: GptCoherentFactProjection,
  acknowledged: boolean,
) => acknowledged ? (() => {
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return declaredFacts({ ...facts, decision: "ACT" as const,
    factResultIds: Object.freeze([...facts.factResultIds, browserFact.evidenceRef]),
    authorityRefHashes: Object.freeze([...facts.authorityRefHashes, browserFact.evidenceHash]),
    mutationOutcome: "confirmed" as const, browserFact, nativeFailureCode: null });
})() : declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
  browserFact: null, nativeFailureCode: null });

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

const stableImageObserved = (
  overdueRecoveryProbe: boolean,
  prior: Readonly<{ assistantTurnId: string; mediaHash: `sha256:${string}` }> | null,
  assistantTurnId: string,
  mediaHash: `sha256:${string}`,
): boolean => overdueRecoveryProbe
  || (prior !== null && prior.assistantTurnId === assistantTurnId && prior.mediaHash === mediaHash);

export const imageResponseChildHandlers = {
  async wait_for_stable_gpt_image(intent, context) {
    requireExactInputKeys(intent, ["absoluteDeadline", "canonicalConversationUrl", "expectedPromptHash", "turnMarker"]);
    const canonicalConversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    const browser = requireBrowser(context);
    const overdueRecoveryProbe = Date.now() >= deadline;
    let prior: Readonly<{ assistantTurnId: string; mediaHash: `sha256:${string}` }> | null = null;
    let rateLimitAcknowledged = false;
    let probeDelayMs = 250;
    do {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_IMAGE_WAIT_ABORTED");
      const observed = await ensureResponseConversation(browser, canonicalConversationUrl);
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
          if (stableImageObserved(overdueRecoveryProbe, prior, assistantTurnId, media.sha256)) {
            return success({
              value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256 },
              ...completionFacts(intent, browser, observed.facts, rateLimitAcknowledged),
            });
          }
          prior = Object.freeze({ assistantTurnId, mediaHash: media.sha256 });
        } catch (error) {
          if (failureCode(error) !== "BROWSER_AUTHENTICATED_MEDIA_ABSENT") throw error;
        }
      }
      rateLimitAcknowledged = await maybeAcknowledgeRateLimit(
        browser, observed, rateLimitAcknowledged, context.mutationMode === "readback",
      );
      if (overdueRecoveryProbe) break;
      const remaining = deadline - Date.now();
      if (remaining >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remaining));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    } while (Date.now() < deadline);
    throw executionFailure("failed", "GPT_IMAGE_STABILITY_TIMEOUT");
  },

  async checkpoint_gpt_generated_image(intent, context) {
    requireExactInputKeys(intent, ["assistantTurnId", "canonicalConversationUrl", "expectedMediaHash",
      "expectedPromptHash", "predecessorTextCheckpoint", "turnMarker"]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    if (!TURN.test(assistantTurnId)) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:checkpoint_gpt_generated_image:assistantTurnId");
    }
    const canonicalConversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    const expectedMediaHash = hashInput(intent, "expectedMediaHash");
    const turnMarker = stringInput(intent, "turnMarker");
    const predecessorTextCheckpoint = predecessorInput(intent);
    const browser = requireBrowser(context);
    const observed = await ensureResponseConversation(browser, canonicalConversationUrl);
    if (assistantTurnForPrompt(observed, expectedPromptHash) !== assistantTurnId || observed.generatingRaw !== 0) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    const media = await browser.downloadAuthenticatedMedia({
      assistantTurnId, semanticMediaId: "gpt-generated-image-main",
    });
    if (!observed.facts.authorityRefHashes.includes(media.authorityTargetHash)
      || !observed.facts.authorityRefHashes.includes(media.authorityDocumentHash)) {
      throw executionFailure("failed", "GPT_GENERATED_IMAGE_DOCUMENT_MISMATCH");
    }
    const original = Buffer.from(media.bytesBase64, "base64");
    if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
      throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
    }
    if (media.sha256 !== expectedMediaHash) throw executionFailure("failed", "GPT_GENERATED_IMAGE_IDENTITY_DRIFT");
    const webp = await renderGeneratedImage(original);
    const imageHash = hash(webp);
    return success({
      value: { assistantTurnId, semanticMediaId: "gpt-generated-image-main", mediaHash: media.sha256,
        authorityTargetHash: media.authorityTargetHash, authorityDocumentHash: media.authorityDocumentHash,
        canonicalConversationUrl, promptHash: expectedPromptHash, turnMarker,
        artifactId: `airesult_${imageHash.slice(7, 39)}`,
        originalBytes: new Uint8Array(original), webpBytes: new Uint8Array(webp), sha256: imageHash,
        originalSha256: media.sha256, originalSizeBytes: original.byteLength,
        originalMediaType: media.mediaType, originalWidth: media.width, originalHeight: media.height,
        bytes: webp.byteLength, mediaType: "image/webp", width: 1200, height: 630,
        predecessorTextCheckpoint },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  },
} satisfies GptChildHandlerMap;
