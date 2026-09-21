import { runInNewContext } from "node:vm";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { readExactEditableText } from "../../src/lib/browser/chrome-extension/dom-exact-editable-text.js";
import { FakeElement, FakeTextNode, RICH_SEMANTIC_TEXT, execute, hash, richSemanticTree }
  from "./local-browser-dom-function-fixture.js";

type QueryResults<T> = Readonly<{ queries: readonly Readonly<{ matches: readonly Readonly<T>[] }>[] }>;

const exerciseComposerExactHashes = async (source: string): Promise<void> => {
  const trailingBreak = new FakeElement("", {}, {}, { class: "ProseMirror-trailingBreak" }, "BR");
  const emptyParagraph = new FakeElement("", {}, {}, { "data-empty-paragraph": "true" }, "P", [trailingBreak]);
  const emptyComposer = new FakeElement("", {}, {}, { id: "prompt-textarea", contenteditable: "true" }, "DIV", [emptyParagraph]);
  const composerRoot = new FakeElement("", { "#prompt-textarea": [emptyComposer] });
  emptyComposer.parentElement = composerRoot;
  const emptyResult = await execute(source, { documentElement: composerRoot, querySelectorAll: () => [],
    elementFromPoint: () => emptyComposer }, [{ queryId: "composer", selector: "#prompt-textarea", maxMatches: 1,
    fields: ["semanticTextHash"] }]) as QueryResults<{ semanticTextHash: string }>;
  assert.equal(emptyResult.queries[0]?.matches[0]?.semanticTextHash,
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const markdownPrompt = "# Heading\n- item\n`code`\n";
  const markdownBlocks = markdownPrompt.split("\n").map((value) =>
    new FakeElement(value, {}, {}, {}, "P", value.length === 0 ? [] : [new FakeTextNode(value)]));
  const markdownComposer = new FakeElement(markdownPrompt, {}, {}, { id: "prompt-textarea", contenteditable: "true" }, "DIV", markdownBlocks);
  const styledComposer = new FakeElement("bold", {}, {}, { id: "prompt-textarea", contenteditable: "true" }, "DIV",
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
    const editable = new FakeElement(rendered, {}, {}, { id: "prompt-textarea", contenteditable: "true" }, "DIV", [new FakeTextNode(rendered)]);
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
  const editable = new FakeElement(rendered, {}, {}, { id: "prompt-textarea", contenteditable: "true" }, "DIV", [new FakeTextNode(rendered)]);
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
  const turn = new FakeElement(rendered, { "[data-testid='collapsible-user-message-content']": [body],
    "[data-message-author-role='user']": [body] }, {}, { "data-testid": "conversation-turn-111074" }, "ARTICLE", [body]);
  const root = new FakeElement("", { "#prompt-textarea": [editable], ".user-turn": [turn] });
  editable.parentElement = root; turn.parentElement = root;
  const result = await execute(source, { documentElement: root, querySelectorAll: () => [], elementFromPoint: () => editable }, [
    { queryId: "incident-editable", selector: "#prompt-textarea", maxMatches: 1, fields: ["exactEditableTextHash"] },
    { queryId: "incident-user-turn", selector: ".user-turn", maxMatches: 1, fields: ["exactGptUserPromptHash"] },
  ]) as QueryResults<{ exactEditableTextHash?: string; exactGptUserPromptHash?: string }>;
  assert.equal(result.queries[0]?.matches[0]?.exactEditableTextHash, hash(approved));
  assert.equal(result.queries[1]?.matches[0]?.exactGptUserPromptHash, hash(approved));
};

export const exerciseEditablePromptHashes = async (source: string): Promise<void> => {
  await exerciseComposerExactHashes(source);
  await exerciseIncidentScalePromptProjection(source);
};
