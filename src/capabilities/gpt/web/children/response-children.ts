import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import { findCount, readExactAttribute } from "../gpt-dom-observation.js";
import { GPT_GENERATING_STOP_SELECTOR, GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";
import { GPT_GENERATED_IMAGE_ALT_PREFIX } from "../contracts/response.contract.js";

const hash = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const turnOrdinal = (testId: string): number => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(testId);
  if (!match) throw new Error("review_required:GPT_TURN_ID_INVALID");
  const ordinal = Number(match[1]);
  if (!Number.isSafeInteger(ordinal)) throw new Error("review_required:GPT_TURN_ID_INVALID");
  return ordinal;
};

const assistantSelector = (assistantTurnId: string): string =>
  `[data-testid=${JSON.stringify(assistantTurnId)}][data-turn='assistant']`;

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
    throw new Error("review_required:GPT_ASSISTANT_TURN_INVALID");
  }
  const state = value as Record<string, unknown>;
  if (state.visible !== true || state.connected !== true || typeof state.text !== "string") {
    throw new Error("review_required:GPT_ASSISTANT_TURN_INVALID");
  }
  return state.text;
};

export const responseChildHandlers = {
  async observe_exact_gpt_assistant_turn(intent, context) {
    requireExactInputKeys(intent, ["turnMarker"]);
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const userCount = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
    });
    if (userCount !== 1) throw new Error(`review_required:GPT_USER_TURN_COUNT_${userCount}`);
    const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
    const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
    const count = await findCount(browser, { selector: assistantSelector(assistantTurnId), maxMatches: 2 });
    if (count !== 1) throw new Error(`recovery_pending:GPT_ASSISTANT_TURN_COUNT_${count}`);
    return success({
      value: { userTurnId, assistantTurnId, assistantSelector: assistantSelector(assistantTurnId) },
      candidateCount: count,
      observedSemantics: ["one marked user turn", "one directly following assistant turn"],
      committedMutation: "no",
    });
  },

  async wait_for_stable_gpt_response(intent, context) {
    requireExactInputKeys(intent, ["assistantTurnId", "timeoutMs"]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    const timeoutMs = Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 3_600_000));
    const browser = requireBrowser(context);
    const deadline = Date.now() + timeoutMs;
    let priorHash: string | null = null;
    let stableSince = 0;
    while (Date.now() < deadline) {
      if (context.signal?.aborted) throw new Error("recovery_pending:GPT_RESPONSE_WAIT_ABORTED");
      const text = await readAssistantText(browser, assistantTurnId);
      const currentHash = hash(text);
      const generating = await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 });
      if (text.trim().length > 0 && generating === 0) {
        if (currentHash !== priorHash) {
          priorHash = currentHash;
          stableSince = Date.now();
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
      if (remainingMs > 0) {
        await browser.wait({
          durationMs: Math.max(25, Math.min(500, Math.ceil(remainingMs / 20))),
        });
      }
    }
    throw new Error("recovery_pending:GPT_RESPONSE_STABILITY_TIMEOUT");
  },

  async checkpoint_gpt_text_response(intent, context) {
    requireExactInputKeys(intent, ["assistantTurnId", "expectedResponseHash"]);
    const assistantTurnId = stringInput(intent, "assistantTurnId");
    const expectedResponseHash = stringInput(intent, "expectedResponseHash");
    const text = await readAssistantText(requireBrowser(context), assistantTurnId);
    const responseHash = hash(text);
    if (text.trim().length === 0 || responseHash !== expectedResponseHash) {
      throw new Error("review_required:GPT_RESPONSE_CHECKPOINT_MISMATCH");
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
    const selector = `${assistantSelector(assistantTurnId)} img[alt^=${JSON.stringify(GPT_GENERATED_IMAGE_ALT_PREFIX)}]`;
    const count = await findCount(browser, { selector, maxMatches: 2 });
    if (count !== 1) throw new Error(`review_required:GPT_GENERATED_IMAGE_COUNT_${count}`);
    throw new Error("review_required:GPT_GENERATED_IMAGE_ORIGINAL_BYTES_NOT_PRODUCTION_VERIFIED");
  },

  async capture_gpt_response_artifact(intent, context) {
    requireExactInputKeys(intent, ["rawText", "mediaType"]);
    requireBrowser(context);
    const rawText = stringInput(intent, "rawText");
    const mediaType = stringInput(intent, "mediaType");
    if (mediaType === "application/json") {
      try { JSON.parse(rawText); } catch { throw new Error("review_required:GPT_JSON_ARTIFACT_INVALID"); }
    } else if (mediaType === "text/html") {
      const lower = rawText.trim().toLowerCase();
      if (!(lower.includes("<html") && lower.includes("<body"))) {
        throw new Error("review_required:GPT_HTML_ARTIFACT_INVALID");
      }
    } else {
      throw new Error(`failed:GPT_ARTIFACT_MEDIA_TYPE_UNSUPPORTED:${mediaType}`);
    }
    const artifactHash = hash(Buffer.from(rawText, "utf8"));
    return success({
      value: {
        artifactRef: `gpt-artifact:${artifactHash.slice(7)}`,
        mediaType,
        bytes: Buffer.byteLength(rawText, "utf8"),
        hash: artifactHash,
        rawText,
      },
      candidateCount: 1,
      observedSemantics: ["checkpointed response bytes", mediaType, artifactHash],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
