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
import {
  findCount,
  readExactText,
  readGptDocument,
  requireOneCandidate,
} from "../gpt-dom-observation.js";
import { GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";
import { GPT_TITLE_INPUT_SELECTOR } from "../contracts/title.contract.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const rowSelector = (canonicalUrl: string): string =>
  `a[href=${JSON.stringify(new URL(canonicalUrl).pathname)}]`;

export const titleChildHandlers = {
  async open_gpt_title_control(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const row = rowSelector(canonicalUrl);
    const inputCount = await findCount(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
    if (inputCount !== 0) throw executionFailure("review_required", `GPT_TITLE_EDITOR_PREEXISTING_${inputCount}`);
    await requireOneCandidate(browser, { selector: row, maxMatches: 2 });
    const result = await browser.executeDomIntent({
      kind: "doubleClick",
      selector: row,
      expectedMatches: 1,
      postDoubleClickMatch: {
        selector: GPT_TITLE_INPUT_SELECTOR,
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    if (!result || typeof result !== "object" || Array.isArray(result)
      || (result as { postconditionVerified?: unknown }).postconditionVerified !== true) {
      throw executionFailure("review_required", "GPT_TITLE_EDITOR_OPEN_UNCONFIRMED");
    }
    return success({
      value: { state: "editor-open" }, candidateCount: 1,
      observedSemantics: ["one exact conversation row", "one title editor after double-click"],
      committedMutation: "yes",
    });
  },

  async write_exact_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["title"]);
    const title = stringInput(intent, "title");
    if (title.length > 80) throw executionFailure("failed", "GPT_TITLE_TOO_LONG");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
    const result = await browser.executeDomIntent({
      kind: "fill", selector: GPT_TITLE_INPUT_SELECTOR,
      approvedText: title, clearBeforeType: true, expectedMatches: 1,
    });
    if (!result || typeof result !== "object" || Array.isArray(result)
      || (result as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw executionFailure("review_required", "GPT_TITLE_WRITE_UNCONFIRMED");
    }
    return success({
      value: { titleHash: hash(title) }, candidateCount: 1,
      observedSemantics: ["one title input", "exact title retained"], committedMutation: "yes",
    });
  },

  async commit_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "title", "timeoutMs"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const title = stringInput(intent, "title");
    const timeoutMs = Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 15_000));
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
    const result = await browser.executeDomIntent({
      kind: "keypress",
      selector: GPT_TITLE_INPUT_SELECTOR,
      key: "Enter",
      expectedMatches: 1,
      postKeypressMatch: {
        selector: rowSelector(canonicalUrl),
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    if (!result || typeof result !== "object" || Array.isArray(result)
      || (result as { postconditionVerified?: unknown }).postconditionVerified !== true) {
      throw executionFailure("review_required", "GPT_TITLE_COMMIT_UNCONFIRMED");
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await readExactText(browser, rowSelector(canonicalUrl), 256) === title) {
        return success({
          value: { titleHash: hash(title) }, candidateCount: 1,
          observedSemantics: ["one exact title editor", "Enter committed exact sidebar title"],
          committedMutation: "yes",
        });
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs > 0) {
        await browser.wait({
          durationMs: Math.max(25, Math.min(250, Math.ceil(remainingMs / 8))),
        });
      }
    }
    throw executionFailure("review_required", "GPT_TITLE_COMMIT_UNCONFIRMED");
  },

  async verify_exact_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "title", "turnMarker"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const title = stringInput(intent, "title");
    const turnMarker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observedUrl = canonicalGptConversationUrl((await readGptDocument(browser)).url);
    const observedTitle = await readExactText(browser, rowSelector(canonicalUrl), 256);
    const markerCount = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: turnMarker, maxMatches: 20,
    });
    if (observedUrl !== canonicalUrl || observedTitle !== title || markerCount !== 1) {
      throw executionFailure("review_required", "GPT_TITLE_IDENTITY_READBACK_MISMATCH");
    }
    return success({
      value: {
        title,
        titleHash: hash(title),
        canonicalConversationUrl: observedUrl,
        turnMarker,
      },
      candidateCount: 1,
      observedSemantics: ["exact display title", "canonical URL", "one turn marker", "title is not route identity"],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
