import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import { findCount, readExactAttribute, readExactCanonicalPromptText, readExactSemanticText, readExactText, readGptDocument } from "../gpt-dom-observation.js";
import {
  GPT_GENERATING_STOP_SELECTOR,
  GPT_USER_PROMPT_BODY_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "../contracts/conversation.contract.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";
import { GPT_ATTACHMENT_REGION_SELECTOR } from "../contracts/attachment.contract.js";
import { GPT_COMPOSER_SELECTOR } from "../contracts/composer.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const boundedTimeout = (intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0]): number =>
  Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 60_000));

const canonicalOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); }
  catch { return null; }
};

const turnOrdinal = (testId: string): number => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(testId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal)) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return ordinal;
};

const assistantSelector = (assistantTurnId: string): string =>
  `[data-testid=${JSON.stringify(assistantTurnId)}][data-turn='assistant'] [data-message-author-role='assistant']`;

const userPromptBodySelector = (userTurnId: string): string =>
  `[data-testid=${JSON.stringify(userTurnId)}][data-turn='user'] [data-message-author-role='user'] ${GPT_USER_PROMPT_BODY_SELECTOR}`;

const forkButtonSelector = (assistantTurnId: string): string =>
  `[data-testid=${JSON.stringify(assistantTurnId)}][data-turn='assistant'] button[data-testid='branch-conversation-button']`;

const waitSlice = async (browser: ReturnType<typeof requireBrowser>, deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
};

export const conversationChildHandlers = {
  async prepare_clean_gpt_chat(intent, context) {
    requireExactInputKeys(intent, ["timeoutMs"]);
    const browser = requireBrowser(context);
    const deadline = Date.now() + boundedTimeout(intent);
    let observed = { composer: 0, turns: 0, attachments: 0, generating: 0, draftEmpty: null as boolean | null };
    let staleDraftReadyToClear = false;
    while (Date.now() < deadline) {
      observed = {
        composer: await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 }),
        turns: await findCount(browser, { selector: GPT_USER_TURN_SELECTOR, maxMatches: 20 }),
        attachments: await findCount(browser, { selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2 }),
        generating: await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 }),
        draftEmpty: null,
      };
      if (observed.composer === 1 && observed.turns === 0
        && observed.attachments === 0 && observed.generating === 0) {
        const draft = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
        observed = { ...observed, draftEmpty: draft === "" };
        if (!observed.draftEmpty) {
          staleDraftReadyToClear = true;
          break;
        }
        return success({
          value: { ...observed, staleDraftCleared: false }, candidateCount: 1,
          observedSemantics: ["hydrated fresh composer", "exact empty draft", "zero prior turns", "zero attachments", "not generating"],
          committedMutation: "no",
        });
      }
      await waitSlice(browser, deadline);
    }
    if (staleDraftReadyToClear) {
      if (context.mutationMode === "readback") {
        throw executionFailure("failed", "GPT_CHAT_DRAFT_CLEAR_PENDING");
      }
      await browser.executeDomIntent({
        kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: "", clearBeforeType: true,
        expectedMatches: 1,
      });
      const clearedDraft = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
      if (clearedDraft !== "") throw executionFailure("failed", "GPT_CHAT_DRAFT_CLEAR_FAILED");
      observed = { ...observed, draftEmpty: true };
      return success({
        value: { ...observed, staleDraftCleared: true }, candidateCount: 1,
        observedSemantics: ["hydrated fresh composer", "one stale draft cleared", "exact empty draft", "zero prior turns", "zero attachments", "not generating"],
        committedMutation: "confirmed",
      });
    }
    throw executionFailure("failed", `GPT_CHAT_HYDRATION_PENDING:composer=${observed.composer}:turns=${observed.turns}:attachments=${observed.attachments}:generating=${observed.generating}:draftEmpty=${observed.draftEmpty ?? "unread"}`);
  },

  async focus_exact_gpt_conversation(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const before = canonicalOrNull((await readGptDocument(browser)).url);
    if (before === expected) return success({
      value: { url: expected, state: "already-focused" }, candidateCount: 1,
      observedSemantics: ["exact permanent conversation already focused"], committedMutation: "no",
    });
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    await browser.navigate({ url: expected, title: "focus exact GPT conversation" });
    const after = canonicalOrNull((await readGptDocument(browser)).url);
    if (after !== expected) throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    return success({
      value: { url: after }, candidateCount: 1,
      observedSemantics: ["exact permanent conversation URL"], committedMutation: "confirmed",
    });
  },

  async verify_gpt_conversation_identity(intent, context) {
    requireExactInputKeys(intent, [
      "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "timeoutMs", "turnMarker",
    ]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = stringInput(intent, "expectedPromptHash");
    const expectedResponseHash = stringInput(intent, "expectedResponseHash");
    if (!/^sha256:[a-f0-9]{64}$/u.test(expectedPromptHash)
      || !/^sha256:[a-f0-9]{64}$/u.test(expectedResponseHash)) {
      throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
    }
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const deadline = Date.now() + boundedTimeout(intent);
    let markerCount = 0;
    let composerCount = 0;
    while (Date.now() < deadline) {
      const observed = canonicalOrNull((await readGptDocument(browser)).url);
      composerCount = await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
      markerCount = await findCount(browser, {
        selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
      });
      if (observed === expected && composerCount === 1 && markerCount === 1) {
        const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
        const promptText = await readExactCanonicalPromptText(browser, userPromptBodySelector(userTurnId));
        const promptHash = hash(promptText);
        if (promptHash !== expectedPromptHash) {
          throw executionFailure("failed", "GPT_USER_TURN_HASH_MISMATCH");
        }
        const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
        const assistantCount = await findCount(browser, { selector: assistantSelector(assistantTurnId), maxMatches: 2 });
        if (assistantCount !== 1) {
          await waitSlice(browser, deadline);
          continue;
        }
        const semanticText = await readExactSemanticText(browser, assistantSelector(assistantTurnId));
        const responseHash = hash(semanticText);
        if (responseHash !== expectedResponseHash) {
          throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
        }
        return success({
          value: {
            canonicalConversationUrl: observed,
            turnMarker: marker,
            userTurnId,
            assistantTurnId,
            semanticText,
            promptHash,
            responseHash,
            conversationHash: hash(`${observed}\n${marker}\n${userTurnId}\n${promptHash}\n${responseHash}`),
          },
          candidateCount: markerCount,
          observedSemantics: [
            "permanent canonical URL", "hydrated composer", "one exact turn marker",
            "exact prompt body hash", "exact assistant response hash",
          ],
          committedMutation: "no",
        });
      }
      await waitSlice(browser, deadline);
    }
    throw executionFailure("failed", `GPT_CONVERSATION_HYDRATION_PENDING:marker=${markerCount}:composer=${composerCount}`);
  },

  async fork_exact_gpt_conversation_at_checkpoint(intent, context) {
    requireExactInputKeys(intent, [
      "sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
      "sourceResponseHash", "sourceTurnMarker", "timeoutMs",
    ]);
    const sourceUrl = canonicalGptConversationUrl(stringInput(intent, "sourceCanonicalConversationUrl"));
    const assistantTurnId = stringInput(intent, "sourceAssistantTurnId");
    const marker = stringInput(intent, "sourceTurnMarker");
    const promptHash = stringInput(intent, "sourcePromptHash");
    const responseHash = stringInput(intent, "sourceResponseHash");
    if (!/^conversation-turn-[1-9][0-9]*$/u.test(assistantTurnId)
      || !/^sha256:[a-f0-9]{64}$/u.test(promptHash)
      || !/^sha256:[a-f0-9]{64}$/u.test(responseHash)) {
      throw executionFailure("failed", "GPT_FORK_SOURCE_INVALID");
    }
    const userTurnId = `conversation-turn-${turnOrdinal(assistantTurnId) - 1}`;
    const browser = requireBrowser(context);
    const verifySource = async (): Promise<void> => {
      const markerCount = await findCount(browser, {
        selector: `[data-testid=${JSON.stringify(userTurnId)}][data-turn='user']`,
        textContains: marker,
        maxMatches: 2,
      });
      const assistantCount = await findCount(browser, { selector: assistantSelector(assistantTurnId), maxMatches: 2 });
      if (markerCount !== 1 || assistantCount !== 1
        || hash(await readExactCanonicalPromptText(browser, userPromptBodySelector(userTurnId))) !== promptHash
        || hash(await readExactSemanticText(browser, assistantSelector(assistantTurnId))) !== responseHash) {
        throw executionFailure("failed", "GPT_FORK_SOURCE_CHECKPOINT_MISMATCH");
      }
    };
    const before = canonicalOrNull((await readGptDocument(browser)).url);
    if (context.mutationMode === "readback") {
      if (!before || before === sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
      await verifySource();
      return success({
        value: {
          sourceCanonicalConversationUrl: sourceUrl,
          sourceAssistantTurnId: assistantTurnId,
          childCanonicalConversationUrl: before,
          sourceToChildRelationHash: hash(`${sourceUrl}\n${assistantTurnId}\n${responseHash}\n${before}`),
        },
        candidateCount: 1,
        observedSemantics: ["exact source checkpoint", "unique fork child", "source-to-child relation"],
        committedMutation: "no",
      });
    }
    if (before !== sourceUrl) throw executionFailure("failed", "GPT_FORK_SOURCE_CONVERSATION_MISMATCH");
    await verifySource();
    const selector = forkButtonSelector(assistantTurnId);
    if (await findCount(browser, { selector, maxMatches: 2 }) !== 1) {
      throw executionFailure("failed", "GPT_FORK_ACTION_NOT_UNIQUE");
    }
    await browser.executeDomIntent({ kind: "click", selector, expectedMatches: 1 });
    const deadline = Date.now() + boundedTimeout(intent);
    let childUrl: string | null = null;
    while (Date.now() < deadline) {
      childUrl = canonicalOrNull((await readGptDocument(browser)).url);
      if (childUrl && childUrl !== sourceUrl) break;
      await waitSlice(browser, deadline);
    }
    if (!childUrl || childUrl === sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
    await verifySource();
    return success({
      value: {
        sourceCanonicalConversationUrl: sourceUrl,
        sourceAssistantTurnId: assistantTurnId,
        childCanonicalConversationUrl: childUrl,
        sourceToChildRelationHash: hash(`${sourceUrl}\n${assistantTurnId}\n${responseHash}\n${childUrl}`),
      },
      candidateCount: 1,
      observedSemantics: ["exact source checkpoint", "one fork mutation", "unique child readback"],
      committedMutation: "confirmed",
    });
  },
} satisfies GptChildHandlerMap;
