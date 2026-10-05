import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { chromium, type Page } from "playwright";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { readExactEditableText } from
  "../../src/lib/browser/chrome-extension/dom-exact-editable-text.js";

type Style = Readonly<{ display?: string; visibility?: string; opacity?: string; pointerEvents?: string }>;

// Native Exam only: an ephemeral, intercepted loopback page supplies real CSS and Web Crypto.
export const withSyntheticDom = async (exercise: (page: Page) => Promise<void>): Promise<void> => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><body></body>" }));
    await page.goto("http://127.0.0.1/native-exam");
    await exercise(page);
  } finally { await browser.close(); }
};

export class FakeElement {
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
  public querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null; }
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
  public contains(element: FakeElement): boolean {
    return element === this || this.childNodes.some((child) => child.contains(element));
  }
}

export class FakeTextNode extends FakeElement {
  public constructor(value: string) { super(value, {}, {}, {}, "#TEXT"); }
  public override get nodeType(): number { return 3; }
  public override get nodeValue(): string { return this.textContent; }
}

export const fakeGptUserTurn = (
  id: string,
  text: string,
  longPromptNodes: readonly FakeElement[],
  shortPromptNodes: readonly FakeElement[] = [],
  extras: readonly FakeElement[] = [],
): FakeElement => {
  const bubble = new FakeElement(text, {
    "[data-testid='collapsible-user-message-content']": longPromptNodes,
    ".whitespace-pre-wrap": shortPromptNodes,
  }, {}, { "data-user-message-bubble": "true" }, "DIV", [...longPromptNodes, ...shortPromptNodes]);
  const unit = new FakeElement(text, { "[data-user-message-bubble='true']": [bubble] }, {}, {
    "data-chatgpt-search-unit-key": "fallback-turn-0:0:user",
    "data-chatgpt-search-message-ids": id,
  }, "DIV", [bubble]);
  const marker = new FakeElement("", {}, {}, { "data-content-search-turn-key": "fallback-turn-0" });
  return new FakeElement(text, {
    "[data-content-search-turn-key^='fallback-turn-']": [marker],
    "[data-chatgpt-search-unit-key$=':user']": [unit],
  }, {}, { "data-turn-key": id }, "ARTICLE", [marker, unit, ...extras]);
};

export const RICH_SEMANTIC_TEXT = "Title\nBody `inline`\n- item\n\n{\"ok\":true}\nend";

export const richSemanticTree = (): FakeElement => new FakeElement("rich response", {}, {}, {}, "DIV", [
  new FakeElement("Title", {}, {}, {}, "H1", [new FakeTextNode("Title")]),
  new FakeElement("Body inline", {}, {}, {}, "P", [
    new FakeTextNode("Body "),
    new FakeElement("inline", {}, {}, {}, "CODE", [new FakeTextNode("inline")]),
  ]),
  new FakeElement("item", {}, {}, {}, "UL", [
    new FakeElement("item", {}, {}, {}, "LI", [new FakeTextNode("item")]),
  ]),
  new FakeElement('{"ok":true}', {}, {}, {}, "PRE", [
    new FakeElement('{"ok":true}', {}, {}, {}, "CODE", [new FakeTextNode('{"ok":true}')]),
  ]),
  new FakeElement("end", {}, {}, {}, "P", [new FakeTextNode("end")]),
]);

export const execute = (source: string, document: Readonly<Record<string, unknown>>, input: unknown,
  href = "https://chatgpt.com/"): unknown => {
  const originalQuery = document.querySelectorAll as ((selector: string) => readonly FakeElement[]);
  const root = document.documentElement as FakeElement;
  const context = {
    Element: FakeElement,
    URL,
    document: { ...document, querySelectorAll: (selector: string) => {
      const match = /^\[data-turn-key="([a-f0-9-]+)"\]$/.exec(selector);
      if (match) return root.querySelectorAll(".user-turn")
        .filter((turn) => turn.getAttribute("data-turn-key") === match[1]);
      return originalQuery(selector);
    } },
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

export const hash = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type QueryResults<T> = Readonly<{ queries: readonly Readonly<{ matches: readonly Readonly<T>[] }>[] }>;

const exerciseComposerExactHashes = async (source: string): Promise<void> => {
  const trailingBreak = new FakeElement("", {}, {}, { class: "ProseMirror-trailingBreak" }, "BR");
  const emptyParagraph = new FakeElement("", {}, {}, { "data-empty-paragraph": "true" }, "P", [trailingBreak]);
  const emptyComposer = new FakeElement("", {}, {}, { "data-composer-markdown": "", role: "textbox", contenteditable: "true" }, "DIV", [emptyParagraph]);
  const composerRoot = new FakeElement("", { "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']": [emptyComposer] });
  emptyComposer.parentElement = composerRoot;
  const emptyResult = await execute(source, { documentElement: composerRoot, querySelectorAll: () => [],
    elementFromPoint: () => emptyComposer }, [{ queryId: "composer", selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']", maxMatches: 1,
    fields: ["semanticTextHash"] }]) as QueryResults<{ semanticTextHash: string }>;
  assert.equal(emptyResult.queries[0]?.matches[0]?.semanticTextHash,
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const chatMode = new FakeElement("聊天", {}, {}, { "aria-pressed": "true" }, "BUTTON");
  const modeRoot = new FakeElement("", { "[role='group'] > button:first-of-type": [chatMode] });
  chatMode.parentElement = modeRoot;
  const modeResult = await execute(source, { documentElement: modeRoot, querySelectorAll: () => [],
    elementFromPoint: () => chatMode }, [{ queryId: "chat-mode",
    selector: "[role='group'] > button:first-of-type", maxMatches: 1,
    fields: ["ariaPressed"] }]) as QueryResults<{ ariaPressed: string }>;
  assert.equal(modeResult.queries[0]?.matches[0]?.ariaPressed, "true");
  const markdownPrompt = "# Heading\n- item\n`code`\n";
  const markdownBlocks = markdownPrompt.split("\n").map((value) =>
    new FakeElement(value, {}, {}, {}, "P", value.length === 0 ? [] : [new FakeTextNode(value)]));
  const markdownComposer = new FakeElement(markdownPrompt, {}, {}, { "data-composer-markdown": "", role: "textbox", contenteditable: "true" }, "DIV", markdownBlocks);
  const styledComposer = new FakeElement("bold", {}, {}, { "data-composer-markdown": "", role: "textbox", contenteditable: "true" }, "DIV",
    [new FakeElement("bold", {}, {}, {}, "P", [new FakeElement("bold", {}, {}, {}, "STRONG", [new FakeTextNode("bold")])])]);
  const richResponse = richSemanticTree();
  const root = new FakeElement("", { "#markdown": [markdownComposer], "#styled": [styledComposer], "#rich": [richResponse] });
  for (const node of [markdownComposer, styledComposer, richResponse]) node.parentElement = root;
  const result = await execute(source, { documentElement: root, querySelectorAll: () => [], elementFromPoint: () => markdownComposer }, [
    { queryId: "markdown", selector: "#markdown", maxMatches: 1, fields: ["exactEditableTextHash"] },
    { queryId: "styled", selector: "#styled", maxMatches: 1, fields: ["exactEditableTextHash", "semanticTextHash"] },
    { queryId: "rich", selector: "#rich", maxMatches: 1, fields: ["semanticTextHash"] },
  ]) as QueryResults<{ exactEditableTextHash: string; semanticTextHash?: string }>;
  assert.equal(result.queries[0]?.matches[0]?.exactEditableTextHash, hash(markdownPrompt));
  assert.equal(result.queries[1]?.matches[0]?.exactEditableTextHash, hash("bold"));
  assert.equal(result.queries[1]?.matches[0]?.semanticTextHash, hash("**bold**"));
  assert.equal(result.queries[2]?.matches[0]?.semanticTextHash, hash(RICH_SEMANTIC_TEXT));
  const cases = [["approved\u00a0prompt", "approved prompt"], ["approved\u202fprompt", "approved\u202fprompt"],
    ["approved\u2007prompt", "approved\u2007prompt"], ["approved\tprompt", "approved\tprompt"],
    ["approved  prompt", "approved  prompt"], ["approved\nprompt", "approved\nprompt"]] as const;
  for (const [index, [rendered, expected]] of cases.entries()) {
    const editable = new FakeElement(rendered, {}, {}, { "data-composer-markdown": "", role: "textbox", contenteditable: "true" }, "DIV", [new FakeTextNode(rendered)]);
    const editableRoot = new FakeElement("", { [`#editable-${index}`]: [editable] });
    editable.parentElement = editableRoot;
    const observed = await execute(source, { documentElement: editableRoot, querySelectorAll: () => [],
      elementFromPoint: () => editable }, [{ queryId: `editable-${index}`, selector: `#editable-${index}`,
      maxMatches: 1, fields: ["exactEditableTextHash"] }]) as QueryResults<{ exactEditableTextHash: string }>;
    assert.equal(observed.queries[0]?.matches[0]?.exactEditableTextHash, hash(expected));
  }
};

const exerciseIncidentScalePromptProjection = async (source: string): Promise<void> => {
  const tail = "one two three four five six seven eight";
  const approved = `${"甲".repeat(111_075)}\n${tail}\n[GRASSEYE:prompt-end]`;
  const rendered = `${"甲".repeat(111_075)}\n${tail.replaceAll(" ", "\u00a0")}\n[GRASSEYE:prompt-end]`;
  const editable = new FakeElement(rendered, {}, {}, { "data-composer-markdown": "", role: "textbox", contenteditable: "true" }, "DIV", [new FakeTextNode(rendered)]);
  const runtime = { async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
    if (method === "DOM.resolveNode") return { object: { objectId: "incident-editable" } };
    if (method === "Runtime.callFunctionOn") {
      const implementation = runInNewContext(`(${String(parameters?.functionDeclaration)})`, { Element: FakeElement }) as
        (this: FakeElement) => unknown;
      return { result: { value: implementation.call(editable) } };
    }
    if (method === "Runtime.releaseObject") return {};
    throw new Error(`UNEXPECTED_INCIDENT_PROMPT_METHOD:${method}`);
  } } as ExtensionDebuggerRuntime;
  assert.equal(await readExactEditableText(runtime, 1, 1), approved);
  const body = new FakeElement(rendered, {}, {}, { "data-testid": "collapsible-user-message-content" }, "DIV", [new FakeTextNode(rendered)]);
  const turn = fakeGptUserTurn("00000000-0000-4000-8000-000000111074", rendered, [body]);
  const root = new FakeElement("", { "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']": [editable], ".user-turn": [turn] });
  editable.parentElement = root; turn.parentElement = root;
  const result = await execute(source, { documentElement: root, querySelectorAll: () => [], elementFromPoint: () => editable }, [
    { queryId: "incident-editable", selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']", maxMatches: 1, fields: ["exactEditableTextHash"] },
    { queryId: "incident-user-turn", selector: ".user-turn", maxMatches: 1, fields: ["exactGptUserPromptHash"] },
  ]) as QueryResults<{ exactEditableTextHash?: string; exactGptUserPromptHash?: string }>;
  assert.equal(result.queries[0]?.matches[0]?.exactEditableTextHash, hash(approved));
  assert.equal(result.queries[1]?.matches[0]?.exactGptUserPromptHash, hash(approved));
};

export const exerciseEditablePromptHashes = async (source: string): Promise<void> => {
  await exerciseComposerExactHashes(source);
  await exerciseIncidentScalePromptProjection(source);
};
