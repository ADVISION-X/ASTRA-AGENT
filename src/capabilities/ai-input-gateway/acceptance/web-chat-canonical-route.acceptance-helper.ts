import assert from "node:assert/strict";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { focusChatGptConversationByCanonicalPath } from "../runtime/web-chat-single-tab-routing.js";

type RoutingBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait" | "navigate">;

class CanonicalRouteBrowser implements RoutingBrowser {
  readonly observedIntents: unknown[] = [];
  private currentUrl = "https://chatgpt.com/";

  public constructor(private readonly findResults: Array<unknown>) {}

  public async executeDomIntent(intent: Parameters<BrowserTargetLease["executeDomIntent"]>[0]): Promise<unknown> {
    this.observedIntents.push(intent);
    if (intent.kind === "document") return { url: this.currentUrl, title: "ChatGPT" };
    if (intent.kind === "find") {
      const result = this.findResults.shift();
      if (result instanceof Error) throw result;
      return result ?? { count: 1 };
    }
    if (intent.kind === "click") {
      const match = /a\[href="([^"]+)"\]/u.exec(intent.selector);
      if (match?.[1]) this.currentUrl = new URL(match[1], "https://chatgpt.com").href;
      return { clicked: true };
    }
    throw new Error("BROWSER_TARGET_INVALID");
  }

  public async wait(): Promise<void> {}

  public async navigate(): Promise<BrowserTargetLease["document"]> {
    throw new Error("canonical route acceptance does not navigate");
  }
}

export const assertDuplicateCanonicalDomRowsAreOneLogicalRoute = async (): Promise<void> => {
  const browser = new CanonicalRouteBrowser([{ count: 1 }, { count: 1 }]);
  await assert.doesNotReject(focusChatGptConversationByCanonicalPath({
    base: browser,
    conversationUrl: "https://chatgpt.com/c/exact-canonical",
    turnMarker: "GRASSEYE_TURN_exact_canonical",
  }));
  assert.deepEqual(browser.observedIntents, [
    { kind: "document" },
    { kind: "find", selector: 'a[href="/c/exact-canonical"]', maxMatches: 1 },
    { kind: "click", selector: 'a[href="/c/exact-canonical"]', expectedMatches: 1 },
    { kind: "document" },
    {
      kind: "find",
      selector: "[data-testid^='conversation-turn-'][data-turn='user']",
      textContains: "GRASSEYE_TURN_exact_canonical",
      maxMatches: 1,
    },
  ]);

  const ambiguousBrowser = new CanonicalRouteBrowser([new Error("BROWSER_TARGET_INVALID")]);
  await assert.rejects(
    focusChatGptConversationByCanonicalPath({
      base: ambiguousBrowser,
      conversationUrl: "https://chatgpt.com/c/exact-canonical",
      turnMarker: "GRASSEYE_TURN_exact_canonical",
      timeoutMs: 100,
    }),
    /CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS/u,
  );
};
