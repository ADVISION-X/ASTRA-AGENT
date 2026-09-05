import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

type Style = Readonly<{ display?: string; visibility?: string; opacity?: string; pointerEvents?: string }>;

class FakeElement {
  public isConnected = true;
  public parentElement: FakeElement | null = null;
  public readonly tagName: string;
  public readonly nodeName: string;
  public get nodeType(): number { return 1; }
  public get nodeValue(): string | null { return null; }
  public constructor(
    public textContent: string,
    private readonly queries: Readonly<Record<string, readonly FakeElement[]>> = {},
    public readonly style: Style = {},
    private readonly attributes: Readonly<Record<string, string>> = {},
    tagName = "DIV",
    public readonly childNodes: readonly FakeElement[] = [],
  ) {
    this.tagName = tagName;
    this.nodeName = tagName;
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

class FakeTextNode extends FakeElement {
  public constructor(value: string) { super(value, {}, {}, {}, "#TEXT"); }
  public override get nodeType(): number { return 3; }
  public override get nodeValue(): string { return this.textContent; }
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

const hash = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

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

export const exerciseCapturedCoherentObservationPointerFunction = (source: string): void => {
  const reasoning = new FakeElement("", {}, {}, {
    "aria-valuemin": "0", "aria-valuemax": "4", "aria-valuenow": "2",
  });
  const trigger = new FakeElement("", {}, {}, { "aria-expanded": "true" }, "BUTTON");
  const root = new FakeElement("root", { reasoning: [reasoning], trigger: [trigger] });
  reasoning.parentElement = root;
  trigger.parentElement = root;
  const result = execute(source, {
    documentElement: root, querySelectorAll: () => [], elementFromPoint: () => trigger,
  }, {
    candidate: { selector: "button" },
    postcondition: { queries: [
      { queryId: "reasoning-value", selector: "reasoning", maxMatches: 1,
        fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"], expectedEligibleCount: 1 },
      { queryId: "trigger", selector: "trigger", maxMatches: 1,
        fields: ["ariaExpanded"], expectedEligibleCount: 1 },
    ] },
  }) as Readonly<{ kind: string; observation: Readonly<{
    queries: readonly Readonly<{ matches: readonly Readonly<Record<string, unknown>>[] }>[];
  }> }>;
  assert.equal(result.kind, "postcondition");
  assert.equal(JSON.stringify(result.observation.queries[0]?.matches), JSON.stringify([{
    candidateIndex: 0, ariaValueMin: "0", ariaValueMax: "4", ariaValueNow: "2",
  }]));
  assert.equal(JSON.stringify(result.observation.queries[1]?.matches), JSON.stringify([{
    candidateIndex: 0, ariaExpanded: "true",
  }]));
  assert.equal((source.match(/location\.href/gu) ?? []).length, 1,
    "the atomic pointer preparation must read currentUrl and mechanical fields in one synchronous call");
};

const exerciseObservationRejections = async (source: string): Promise<Readonly<Record<string, unknown>>> => {
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
  return observationDocument;
};

const exerciseHiddenStateRead = async (source: string): Promise<void> => {
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
};

const exerciseComposerExactHashes = async (source: string): Promise<void> => {
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
  const markdownPrompt = "# Heading\n- item\n`code`\n";
  const markdownBlocks = markdownPrompt.split("\n").map((value) =>
    new FakeElement(value, {}, {}, {}, "P", value.length === 0 ? [] : [new FakeTextNode(value)]));
  const markdownComposer = new FakeElement(markdownPrompt, {}, {}, {
    id: "prompt-textarea", contenteditable: "true",
  }, "DIV", markdownBlocks);
  const styledParagraph = new FakeElement("bold", {}, {}, {}, "P", [
    new FakeElement("bold", {}, {}, {}, "STRONG", [new FakeTextNode("bold")]),
  ]);
  const styledComposer = new FakeElement("bold", {}, {}, {
    id: "prompt-textarea", contenteditable: "true",
  }, "DIV", [styledParagraph]);
  const exactRoot = new FakeElement("", { "#markdown": [markdownComposer], "#styled": [styledComposer] });
  markdownComposer.parentElement = exactRoot;
  styledComposer.parentElement = exactRoot;
  const exactResult = await execute(source, {
    documentElement: exactRoot, querySelectorAll: () => [], elementFromPoint: () => markdownComposer,
  }, [
    { queryId: "markdown", selector: "#markdown", maxMatches: 1,
      fields: ["exactEditableTextHash"] },
    { queryId: "styled", selector: "#styled", maxMatches: 1,
      fields: ["exactEditableTextHash", "semanticTextHash"] },
  ]) as Readonly<{ queries: readonly Readonly<{ matches: readonly Readonly<{
      exactEditableTextHash: string; semanticTextHash?: string;
    }>[] }>[] }>;
  assert.equal(exactResult.queries[0]?.matches[0]?.exactEditableTextHash, hash(markdownPrompt),
    "Composer exact hash must preserve headings, list markers, backticks, and the trailing newline");
  assert.equal(exactResult.queries[1]?.matches[0]?.exactEditableTextHash, hash("bold"));
  assert.equal(exactResult.queries[1]?.matches[0]?.semanticTextHash, hash("**bold**"),
    "rendered semantic text must remain distinct from the Composer current-value projection");
};

const exerciseUserPromptHashes = async (source: string): Promise<void> => {
  const userPrompt = "[GRASSEYE:exact-user-prompt]\napproved prompt";
  const promptBody = new FakeElement(userPrompt, {}, {}, {
    "data-testid": "collapsible-user-message-content",
  }, "DIV", [
    new FakeElement("[GRASSEYE:exact-user-prompt]", {}, {}, {}, "P", [
      new FakeTextNode("[GRASSEYE:exact-user-prompt]"),
    ]),
    new FakeElement("approved prompt", {}, {}, {}, "P", [new FakeTextNode("approved prompt")]),
  ]);
  const attachmentCard = new FakeElement("公开知识生产资料.zip 文件", {}, {}, {}, "DIV", [
    new FakeTextNode("公开知识生产资料.zip 文件"),
  ]);
  const collapseControl = new FakeElement("展开/收起", {}, {}, {}, "BUTTON", [new FakeTextNode("展开/收起")]);
  const userTurn = new FakeElement(`${userPrompt}公开知识生产资料.zip 文件展开/收起`, {
    "[data-testid='collapsible-user-message-content']": [promptBody],
  }, {}, { "data-testid": "conversation-turn-1", "data-turn": "user" }, "ARTICLE", [
    promptBody, attachmentCard, collapseControl,
  ]);
  const userTurnRoot = new FakeElement("", { ".user-turn": [userTurn] });
  userTurn.parentElement = userTurnRoot;
  const userTurnResult = await execute(source, {
    documentElement: userTurnRoot, querySelectorAll: () => [], elementFromPoint: () => userTurn,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["testId", "semanticTextHash", "exactGptUserPromptHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{
        testId: string; semanticTextHash: string; exactGptUserPromptHash: string;
      }>[] }>[];
    }>;
  const exactUserTurn = userTurnResult.queries[0]?.matches[0];
  assert.equal(exactUserTurn?.testId, "conversation-turn-1");
  assert.equal(exactUserTurn?.exactGptUserPromptHash, hash(userPrompt),
    "the exact GPT user Prompt hash must include only the unique rendered Prompt body");
  assert.notEqual(exactUserTurn?.semanticTextHash, hash(userPrompt),
    "the outer user-turn semantic hash must expose why attachment and controls cannot identify the Prompt");
  const missingPromptBody = new FakeElement("attachment only", {}, {}, {
    "data-testid": "conversation-turn-1", "data-turn": "user",
  });
  const missingRoot = new FakeElement("", { ".user-turn": [missingPromptBody] });
  await assert.rejects(async () => execute(source, {
    documentElement: missingRoot, querySelectorAll: () => [], elementFromPoint: () => missingPromptBody,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]), /BROWSER_DOM_READ_INVALID/u,
  "a user turn without the exact Prompt body must fail closed");
  const duplicatePromptTurn = new FakeElement(userPrompt, {
    "[data-testid='collapsible-user-message-content']": [promptBody, promptBody],
  }, {}, { "data-testid": "conversation-turn-1", "data-turn": "user" });
  const duplicateRoot = new FakeElement("", { ".user-turn": [duplicatePromptTurn] });
  await assert.rejects(async () => execute(source, {
    documentElement: duplicateRoot, querySelectorAll: () => [], elementFromPoint: () => duplicatePromptTurn,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]), /BROWSER_DOM_READ_INVALID/u,
  "multiple Prompt bodies inside one user turn must fail closed");
};

const exerciseInvalidObservationUrls = async (
  source: string,
  observationDocument: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const input = [{ queryId: "reasons", selector: "button", maxMatches: 1, fields: ["visible"] }];
  for (const invalidUrl of ["http://chatgpt.com/", "https://example.com/", "https://user@chatgpt.com/",
    "https://chatgpt.com/c/", "https://chatgpt.com/c/one/two", `https://chatgpt.com/c/${"x".repeat(257)}`]) {
    await assert.rejects(async () => execute(source, observationDocument, input, invalidUrl), /BROWSER_DOM_READ_INVALID/u);
  }
};

export const exerciseCapturedObservationFunction = async (source: string): Promise<void> => {
  const observationDocument = await exerciseObservationRejections(source);
  await exerciseHiddenStateRead(source);
  await exerciseComposerExactHashes(source);
  await exerciseUserPromptHashes(source);
  await exerciseInvalidObservationUrls(source, observationDocument);
};

export const exerciseCapturedExactAssistantTurnFunction = (source: string): void => {
  const text = (value: string) => new FakeTextNode(value);
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
