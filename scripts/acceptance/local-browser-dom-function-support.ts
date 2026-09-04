import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { runInNewContext } from "node:vm";

type Style = Readonly<{ display?: string; visibility?: string; opacity?: string; pointerEvents?: string }>;

class FakeElement {
  public isConnected = true;
  public parentElement: FakeElement | null = null;
  public readonly tagName: string;
  public readonly nodeName: string;
  public readonly nodeType: number;
  public readonly nodeValue: string | null;
  public constructor(
    public textContent: string,
    private readonly queries: Readonly<Record<string, readonly FakeElement[]>> = {},
    public readonly style: Style = {},
    private readonly attributes: Readonly<Record<string, string>> = {},
    tagName = "DIV",
    public readonly childNodes: readonly FakeElement[] = [],
    nodeType = 1,
    nodeValue: string | null = null,
  ) {
    this.tagName = tagName;
    this.nodeName = tagName;
    this.nodeType = nodeType;
    this.nodeValue = nodeValue;
    for (const child of childNodes) child.parentElement = this;
  }
  public get outerHTML(): string {
    if (this.nodeType === 3 || this.nodeName === "#TEXT") return this.nodeValue ?? "";
    return `<${this.tagName.toLowerCase()}>${this.childNodes.map((child) => child.outerHTML).join("")}</${this.tagName.toLowerCase()}>`;
  }
  public querySelectorAll(selector: string): readonly FakeElement[] { return this.queries[selector] ?? []; }
  public getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; }
  public getClientRects(): readonly object[] { return [{}]; }
  public getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  public hasAttribute(name: string): boolean { return this.attributes[name] !== undefined; }
  public matches(selector: string): boolean { return selector === ":disabled" && this.hasAttribute("disabled"); }
  public closest(selector: string): FakeElement | null {
    const matches = selector === "[hidden]" ? this.hasAttribute("hidden")
      : selector === "[aria-hidden='true']" ? this.getAttribute("aria-hidden") === "true"
        : selector === "[inert]" ? this.hasAttribute("inert")
          : selector === "[aria-disabled='true']" ? this.getAttribute("aria-disabled") === "true" : false;
    return matches ? this : this.parentElement?.closest(selector) ?? null;
  }
  public contains(element: FakeElement): boolean { return element === this; }
}

const execute = (source: string, document: Readonly<Record<string, unknown>>, input: unknown,
  href = "https://chatgpt.com/"): unknown => {
  const context = {
    Element: FakeElement,
    URL,
    document,
    location: Object.freeze({ href }),
    crypto: globalThis.crypto,
    TextEncoder,
    getComputedStyle: (element: FakeElement) => ({
      display: element.style.display ?? "block", visibility: element.style.visibility ?? "visible",
      opacity: element.style.opacity ?? "1", pointerEvents: element.style.pointerEvents ?? "auto",
    }),
    innerHeight: 800,
    innerWidth: 1200,
  };
  const implementation = runInNewContext(`(${source})`, context) as (value: unknown) => unknown;
  return implementation(input);
};

export const exerciseCapturedCandidateFunction = (source: string): void => {
  const target = new FakeElement("Run", {}, {}, {}, "BUTTON");
  const scope = new FakeElement("Container text is deliberately not equal to Run", { button: [target] });
  target.parentElement = scope;
  const document = { documentElement: scope, querySelectorAll: (selector: string) => selector === "main" ? [scope] : [],
    elementFromPoint: () => target };
  assert.equal(execute(source, document, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), target, "scope text must not be mistaken for target exact text");
  const pointerInput = {
    selector: "button", scope: { selector: "main" },
    text: { value: "Run", exact: true }, output: "pointer",
  } as const;
  assert.equal(JSON.stringify(execute(source, document, pointerInput)), JSON.stringify({ x: 5, y: 5 }),
    "the captured function must derive the pointer point from the same unique candidate and hit-test");
  const disabledTarget = new FakeElement("Run", {}, {}, { disabled: "" }, "BUTTON");
  const disabledScope = new FakeElement("scope", { button: [disabledTarget] });
  disabledTarget.parentElement = disabledScope;
  assert.equal(execute(source, {
    documentElement: disabledScope, querySelectorAll: () => [disabledScope], elementFromPoint: () => disabledTarget,
  }, pointerInput), "BROWSER_DOM_ACTION_DISABLED");
  const pointerBlocked = new FakeElement("Run", {}, { pointerEvents: "none" }, {}, "BUTTON");
  const blockedScope = new FakeElement("scope", { button: [pointerBlocked] });
  pointerBlocked.parentElement = blockedScope;
  assert.equal(execute(source, {
    documentElement: blockedScope, querySelectorAll: () => [blockedScope], elementFromPoint: () => pointerBlocked,
  }, pointerInput), "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE");
  const overlay = new FakeElement("overlay");
  assert.equal(execute(source, { ...document, elementFromPoint: () => overlay }, pointerInput),
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  const excessiveScopes = Array.from({ length: 257 }, () => new FakeElement("scope"));
  assert.equal(execute(source, { ...document, querySelectorAll: () => excessiveScopes }, {
    selector: "button", scope: { selector: "main" },
  }), "BROWSER_DOM_READ_INVALID", "257 scope candidates must fail the whole call");
  const excessiveTargets = Array.from({ length: 256 }, () => new FakeElement("Run"));
  const oneScope = new FakeElement("scope", { button: excessiveTargets });
  assert.equal(execute(source, { ...document, querySelectorAll: () => [oneScope] }, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), "BROWSER_DOM_READ_INVALID", "scope plus target candidates must share the 256 budget");
};

export const exerciseCapturedObservationFunction = async (source: string): Promise<void> => {
  const nodes = [new FakeElement("a", {}, { display: "none" }),
    new FakeElement("b", {}, { visibility: "hidden" }), new FakeElement("c", {}, { opacity: "0" }),
    new FakeElement("d", {}, {}, { inert: "" })];
  const root = new FakeElement("root", { button: nodes });
  for (const node of nodes) node.parentElement = root;
  const observationDocument = { documentElement: root, querySelectorAll: () => [],
    elementFromPoint: () => null };
  const result = await execute(source, observationDocument,
    [{ queryId: "reasons", selector: "button", maxMatches: 1, fields: ["visible"] }],
    "https://chatgpt.com/c/exact-conversation?query=discarded#fragment") as Readonly<{
      currentUrl: string; queries: readonly Readonly<{ rejections: readonly unknown[] }>[];
    }>;
  assert.equal(result.currentUrl, "https://chatgpt.com/c/exact-conversation");
  assert.equal((source.match(/location\.href/gu) ?? []).length, 1,
    "the coherent function must read location.href exactly once");
  assert.equal(result.queries[0]?.rejections.length, 4,
    "the executed observation function must retain every rejected candidate");
  assert.equal(JSON.stringify(result.queries[0]?.rejections), JSON.stringify([
    { index: 0, reasons: ["DISPLAY_HIDDEN"] }, { index: 1, reasons: ["VISIBILITY_HIDDEN"] },
    { index: 2, reasons: ["OPACITY_HIDDEN"] }, { index: 3, reasons: ["INERT"] },
  ]));
  const hiddenState = new FakeElement("", {}, {}, { "aria-hidden": "true", "aria-valuenow": "4" });
  const hiddenRoot = new FakeElement("root", { "[data-state]": [hiddenState] });
  hiddenState.parentElement = hiddenRoot;
  const hiddenResult = await execute(source, {
    documentElement: hiddenRoot, querySelectorAll: () => [], elementFromPoint: () => null,
  }, [
    { queryId: "default-state", selector: "[data-state]", maxMatches: 1, fields: ["ariaHidden"] },
    { queryId: "explicit-state", selector: "[data-state]", maxMatches: 1,
      readEligibility: "non-actionable-aria-state", fields: ["ariaHidden"] },
  ]) as Readonly<{ queries: readonly Readonly<{
    rawCount: number; eligibleCount: number; matches: readonly Readonly<{ ariaHidden: boolean }>[];
    rejections: readonly unknown[];
  }>[] }>;
  assert.equal(JSON.stringify({ rawCount: hiddenResult.queries[0]?.rawCount,
    eligibleCount: hiddenResult.queries[0]?.eligibleCount,
    rejections: hiddenResult.queries[0]?.rejections }), JSON.stringify({
    rawCount: 1, eligibleCount: 0, rejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
  }), "ordinary observation must reject an aria-hidden state node");
  assert.equal(JSON.stringify({ rawCount: hiddenResult.queries[1]?.rawCount,
    eligibleCount: hiddenResult.queries[1]?.eligibleCount,
    matches: hiddenResult.queries[1]?.matches }), JSON.stringify({
    rawCount: 1, eligibleCount: 1, matches: [{ candidateIndex: 0, ariaHidden: true }],
  }), "the explicit non-actionable read mode may ignore only ARIA_HIDDEN");
  const trailingBreak = new FakeElement("", {}, {}, { class: "ProseMirror-trailingBreak" }, "BR");
  const emptyParagraph = new FakeElement("", {}, {}, { "data-empty-paragraph": "true" }, "P", [trailingBreak]);
  const emptyComposer = new FakeElement("", {}, {}, {
    id: "prompt-textarea", contenteditable: "true",
  }, "DIV", [emptyParagraph]);
  const composerRoot = new FakeElement("", { "#prompt-textarea": [emptyComposer] });
  emptyComposer.parentElement = composerRoot;
  const emptyResult = await execute(source, {
    documentElement: composerRoot, querySelectorAll: () => [], elementFromPoint: () => emptyComposer,
  }, [{ queryId: "composer", selector: "#prompt-textarea", maxMatches: 1,
    fields: ["semanticTextHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{ semanticTextHash: string }>[] }>[];
    }>;
  assert.equal(emptyResult.queries[0]?.matches[0]?.semanticTextHash,
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "the exact live ProseMirror empty marker must project to the empty semantic string");
  const input = [{ queryId: "reasons", selector: "button", maxMatches: 1, fields: ["visible"] }];
  for (const invalidUrl of ["http://chatgpt.com/", "https://example.com/", "https://user@chatgpt.com/",
    "https://chatgpt.com/c/", "https://chatgpt.com/c/one/two", `https://chatgpt.com/c/${"x".repeat(257)}`]) {
    await assert.rejects(async () => execute(source, observationDocument, input, invalidUrl), /BROWSER_DOM_READ_INVALID/u);
  }
};

export const exerciseCapturedExactAssistantTurnFunction = (source: string): void => {
  const text = (value: string) => new FakeElement(value, {}, {}, {}, "#TEXT", [], 3, value);
  const paragraph = new FakeElement("bold", {}, {}, {}, "P", [
    new FakeElement("bold", {}, {}, {}, "STRONG", [text("bold")]),
  ]);
  const listItem = new FakeElement("item", {}, {}, {}, "LI", [text("item")]);
  const list = new FakeElement("item", {}, {}, {}, "UL", [listItem]);
  const assistant = new FakeElement("bold item", { "pre code": [] }, {}, {}, "DIV", [paragraph, list]);
  const selector = '[data-testid="conversation-turn-2"][data-turn="assistant"] [data-message-author-role="assistant"]';
  let queryCalls = 0;
  const document = {
    querySelectorAll: (value: string) => {
      queryCalls += 1;
      return value === selector ? [assistant] : [];
    },
    elementFromPoint: () => assistant,
  };
  const observed = execute(source, document, "conversation-turn-2") as Readonly<{
    rawCount: number; eligibleCount: number; rawDomHtml: string; semanticText: string;
    nativeStage: string;
  }>;
  assert.equal(queryCalls, 1, "the exact assistant turn must be selected once inside one synchronous call");
  assert.equal(observed.rawCount, 1);
  assert.equal(observed.eligibleCount, 1);
  assert.match(observed.rawDomHtml, /<strong>bold<\/strong>/u);
  assert.equal(observed.semanticText, "**bold**\n- item\n\n");
  assert.equal(observed.nativeStage, "runtime-call-function-on");
  const hidden = new FakeElement("hidden", { "pre code": [] }, { display: "none" }, {}, "DIV", [text("hidden")]);
  const hiddenObserved = execute(source, {
    querySelectorAll: () => [hidden], elementFromPoint: () => null,
  }, "conversation-turn-2") as Readonly<{ rawCount: number; eligibleCount: number; rawDomHtml: string }>;
  assert.deepEqual({ rawCount: hiddenObserved.rawCount, eligibleCount: hiddenObserved.eligibleCount,
    rawDomHtml: hiddenObserved.rawDomHtml }, { rawCount: 1, eligibleCount: 0, rawDomHtml: "" });
  const ambiguous = execute(source, {
    querySelectorAll: () => [assistant, assistant], elementFromPoint: () => assistant,
  }, "conversation-turn-2") as Readonly<{ rawCount: number; eligibleCount: number }>;
  assert.deepEqual({ rawCount: ambiguous.rawCount, eligibleCount: ambiguous.eligibleCount },
    { rawCount: 2, eligibleCount: 0 });
};
