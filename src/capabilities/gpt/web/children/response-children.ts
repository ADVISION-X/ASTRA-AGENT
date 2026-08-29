import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import type { GptChildCapabilityIntent, GptExecutionContext } from "../../contract.js";

import type { GptChildHandlerMap, GptChildObservation } from "../child-handler.js";
import {
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import { findCount, readExactAttribute } from "../gpt-dom-observation.js";
import { GPT_GENERATING_STOP_SELECTOR, GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const turnOrdinal = (testId: string): number => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(testId);
  if (!match) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  const ordinal = Number(match[1]);
  if (!Number.isSafeInteger(ordinal)) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return ordinal;
};

const assistantSelector = (assistantTurnId: string): string =>
  `[data-testid=${JSON.stringify(assistantTurnId)}][data-turn='assistant']`;

const providerWait = (
  context: GptExecutionContext,
  browser: BrowserTargetLease,
  durationMs: number,
): Promise<void> => context.yieldForProviderWait
  ? context.yieldForProviderWait(Math.max(25, Math.min(5_000, Math.floor(durationMs))))
  : browser.wait({ durationMs: Math.max(25, Math.min(5_000, Math.floor(durationMs))) });

const readAssistantText = async (
  browser: BrowserTargetLease,
  assistantTurnId: string,
): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "inspect",
    selector: assistantSelector(assistantTurnId),
    fields: ["text", "visible", "connected"],
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "GPT_ASSISTANT_TURN_INVALID");
  }
  const state = value as Record<string, unknown>;
  if (state.visible !== true || state.connected !== true || typeof state.text !== "string") {
    throw executionFailure("failed", "GPT_ASSISTANT_TURN_INVALID");
  }
  return state.text;
};

type StableImageState = { assistantTurnId: string | null; stableSince: number };

const observeStableImage = async (
  browser: BrowserTargetLease,
  marker: string,
  state: StableImageState,
): Promise<GptChildObservation | null> => {
  const userCount = await findCount(browser, {
    selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
  });
  if (userCount > 1) throw executionFailure("failed", `GPT_USER_TURN_COUNT_${userCount}`);
  if (userCount !== 1) return null;
  const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
  const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
  const assistantCount = await findCount(browser, { selector: assistantSelector(assistantTurnId), maxMatches: 2 });
  const imageCount = assistantCount === 1
    ? await findCount(browser, { selector: `${assistantSelector(assistantTurnId)} img[alt]`, maxMatches: 2 })
    : 0;
  const generating = await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 });
  if (imageCount > 1) throw executionFailure("failed", `GPT_GENERATED_IMAGE_COUNT_${imageCount}`);
  if (assistantCount !== 1 || imageCount !== 1 || generating !== 0) return null;
  if (state.assistantTurnId !== assistantTurnId) {
    state.assistantTurnId = assistantTurnId;
    state.stableSince = Date.now();
    return null;
  }
  if (Date.now() - state.stableSince < 3_000) return null;
  const responseText = await readAssistantText(browser, assistantTurnId);
  if (!responseText.trim()) throw executionFailure("failed", "GPT_IMAGE_RESPONSE_TEXT_PENDING");
  return success({
    value: {
      assistantTurnId,
      semanticMediaId: "gpt-generated-image-main",
      responseText,
      responseHash: hash(responseText),
    },
    candidateCount: 1,
    observedSemantics: ["one directly following assistant turn", "one semantic image", "generation control absent", "stable bounded interval"],
    committedMutation: "no",
  });
};

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

const writeGeneratedImageFile = async (filePath: string, bytes: Buffer, expectedHash: string): Promise<void> => {
  try {
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
  } catch (cause) {
    const existing = await readFile(filePath).catch(() => null);
    if (!existing || hash(existing) !== expectedHash) throw cause;
  }
};

const persistGeneratedImage = async (input: Readonly<{
  context: GptExecutionContext;
  intent: GptChildCapabilityIntent;
  original: Buffer;
  webp: Buffer;
}>): Promise<Readonly<{ originalHash: `sha256:${string}`; imageHash: `sha256:${string}`; originalLocalPath: string; localPath: string }>> => {
  const originalHash = hash(input.original);
  const imageHash = hash(input.webp);
  const directory = join(input.context.dataDir, "generated-images", hash(input.intent.executionId).slice(7, 39));
  const originalLocalPath = join(directory, `${originalHash.slice(7)}.original`);
  const localPath = join(directory, `${imageHash.slice(7)}.webp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeGeneratedImageFile(originalLocalPath, input.original, originalHash);
  await writeGeneratedImageFile(localPath, input.webp, imageHash);
  const [originalReadback, readback] = await Promise.all([readFile(originalLocalPath), readFile(localPath)]);
  if (hash(originalReadback) !== originalHash || originalReadback.byteLength !== input.original.byteLength
    || hash(readback) !== imageHash || readback.byteLength !== input.webp.byteLength) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_READBACK_INVALID");
  }
  return { originalHash, imageHash, originalLocalPath, localPath };
};

export const responseChildHandlers = {
  async wait_for_stable_gpt_text(intent, context) {
    requireExactInputKeys(intent, ["absoluteDeadline", "turnMarker"]);
    const marker = stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    const browser = requireBrowser(context);
    let assistantTurnId: string | null = null;
    let priorHash: string | null = null;
    let stableSince = 0;
    let probeDelayMs = 250;
    while (Date.now() < deadline) {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_RESPONSE_WAIT_ABORTED");
      const userCount = await findCount(browser, {
        selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
      });
      if (userCount > 1) throw executionFailure("failed", `GPT_USER_TURN_COUNT_${userCount}`);
      if (userCount === 0) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 25) break;
        await providerWait(context, browser, Math.min(probeDelayMs, remainingMs));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
        continue;
      }
      const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
      assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
      const assistantCount = await findCount(browser, { selector: assistantSelector(assistantTurnId), maxMatches: 2 });
      if (assistantCount !== 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 25) break;
        await providerWait(context, browser, Math.min(probeDelayMs, remainingMs));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
        continue;
      }
      const text = await readAssistantText(browser, assistantTurnId);
      const currentHash = hash(text);
      const generating = await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 });
      if (text.trim().length > 0 && generating === 0) {
        if (currentHash !== priorHash) {
          priorHash = currentHash;
          stableSince = Date.now();
          probeDelayMs = 250;
        } else if (Date.now() - stableSince >= 3_000) {
          return success({
            value: { assistantTurnId, responseHash: currentHash, responseText: text },
            candidateCount: 1,
            observedSemantics: ["exact assistant turn", "generation control absent", "content stable for bounded interval"],
            committedMutation: "no",
          });
        }
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remainingMs));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    }
    throw executionFailure("failed", "GPT_RESPONSE_STABILITY_TIMEOUT");
  },

  async checkpoint_gpt_text_response(intent, context) {
    requireExactInputKeys(intent, ["assistantTurnId", "expectedResponseHash"]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    const expectedResponseHash = stringInput(intent, "expectedResponseHash");
    const text = await readAssistantText(requireBrowser(context), assistantTurnId);
    const responseHash = hash(text);
    if (text.trim().length === 0 || responseHash !== expectedResponseHash) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    return success({
      value: {
        assistantTurnId,
        rawText: text,
        rawHash: responseHash,
        checkpointRef: `gpt-response:${responseHash.slice(7)}`,
      },
      candidateCount: 1,
      observedSemantics: ["exact assistant turn bytes", responseHash, "stable response checkpoint"],
      committedMutation: "no",
    });
  },

  async checkpoint_gpt_generated_image(intent, context) {
    requireExactInputKeys(intent, ["assistantTurnId"]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    const browser = requireBrowser(context);
    const media = await browser.downloadAuthenticatedMedia({
      assistantTurnId,
      semanticMediaId: "gpt-generated-image-main",
    });
    const original = Buffer.from(media.bytesBase64, "base64");
    if (hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes) {
      throw executionFailure("failed", "GPT_GENERATED_IMAGE_AUTHENTICATED_BYTES_INVALID");
    }
    const webp = await renderGeneratedImage(original);
    const persisted = await persistGeneratedImage({ context, intent, original, webp });
    return success({
      value: {
        artifactId: `airesult_${persisted.imageHash.slice(7, 39)}`,
        localPath: persisted.localPath,
        originalLocalPath: persisted.originalLocalPath,
        sha256: persisted.imageHash,
        originalSha256: persisted.originalHash,
        bytes: webp.byteLength,
        mediaType: "image/webp",
        width: 1200,
        height: 630,
      },
      candidateCount: 1,
      observedSemantics: ["one exact authenticated generated image", media.sha256, persisted.imageHash, "metadata-free webp 1200x630"],
      committedMutation: "no",
    });
  },

  async wait_for_stable_gpt_image(intent, context) {
    requireExactInputKeys(intent, ["absoluteDeadline", "turnMarker"]);
    const marker = stringInput(intent, "turnMarker");
    const deadline = Date.parse(stringInput(intent, "absoluteDeadline"));
    if (!Number.isFinite(deadline) || deadline > Date.now() + 3_600_000) {
      throw executionFailure("failed", "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");
    }
    const browser = requireBrowser(context);
    const state: StableImageState = { assistantTurnId: null, stableSince: 0 };
    let probeDelayMs = 250;
    while (Date.now() < deadline) {
      if (context.signal?.aborted) throw executionFailure("failed", "GPT_IMAGE_WAIT_ABORTED");
      const observation = await observeStableImage(browser, marker, state);
      if (observation) return observation;
      const remaining = deadline - Date.now();
      if (remaining >= 25) {
        await providerWait(context, browser, Math.min(probeDelayMs, remaining));
        probeDelayMs = Math.min(5_000, Math.ceil(probeDelayMs * 1.5));
      } else break;
    }
    throw executionFailure("failed", "GPT_IMAGE_STABILITY_TIMEOUT");
  },
} satisfies GptChildHandlerMap;
