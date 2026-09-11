import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { FakeElement, FakeTextNode, RICH_SEMANTIC_TEXT, execute, hash, richSemanticTree }
  from "./local-browser-dom-function-fixture.js";
export const exerciseCapturedCandidateFunction = async (source: string): Promise<void> => {
  const target = new FakeElement("Run", {}, {}, {}, "BUTTON");
  const scope = new FakeElement("Container text is deliberately not equal to Run", { button: [target] });
  target.parentElement = scope;
  const document = { documentElement: scope, querySelectorAll: (selector: string) => selector === "main" ? [scope] : [],
    elementFromPoint: () => target };
  assert.equal(await execute(source, document, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), target, "scope text must not be mistaken for target exact text");
  const pointerInput = {
    selector: "button", scope: { selector: "main" },
    text: { value: "Run", exact: true }, output: "pointer",
  } as const;
  assert.equal(JSON.stringify(await execute(source, document, pointerInput)), JSON.stringify({ x: 5, y: 5 }),
    "the captured function must derive the pointer point from the same unique candidate and hit-test");
  const disabledTarget = new FakeElement("Run", {}, {}, { disabled: "" }, "BUTTON");
  const disabledScope = new FakeElement("scope", { button: [disabledTarget] });
  disabledTarget.parentElement = disabledScope;
  assert.equal(await execute(source, {
    documentElement: disabledScope, querySelectorAll: () => [disabledScope], elementFromPoint: () => disabledTarget,
  }, pointerInput), "BROWSER_DOM_ACTION_DISABLED");
  const pointerBlocked = new FakeElement("Run", {}, { pointerEvents: "none" }, {}, "BUTTON");
  const blockedScope = new FakeElement("scope", { button: [pointerBlocked] });
  pointerBlocked.parentElement = blockedScope;
  assert.equal(await execute(source, {
    documentElement: blockedScope, querySelectorAll: () => [blockedScope], elementFromPoint: () => pointerBlocked,
  }, pointerInput), "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE");
  const overlay = new FakeElement("overlay");
  assert.equal(await execute(source, { ...document, elementFromPoint: () => overlay }, pointerInput),
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  const excessiveScopes = Array.from({ length: 257 }, () => new FakeElement("scope"));
  assert.equal(await execute(source, { ...document, querySelectorAll: () => excessiveScopes }, {
    selector: "button", scope: { selector: "main" },
  }), "BROWSER_DOM_READ_INVALID", "257 scope candidates must fail the whole call");
  const excessiveTargets = Array.from({ length: 256 }, () => new FakeElement("Run"));
  const oneScope = new FakeElement("scope", { button: excessiveTargets });
  assert.equal(await execute(source, { ...document, querySelectorAll: () => [oneScope] }, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), "BROWSER_DOM_READ_INVALID", "scope plus target candidates must share the 256 budget");

  const prompt = "approved prompt";
  const composer = new FakeElement(prompt, {}, {}, { contenteditable: "true" }, "DIV", [
    new FakeTextNode(prompt),
  ]);
  const attachment = new FakeElement("approved.pdf", {}, {}, { "aria-label": "approved.pdf" });
  const send = new FakeElement("Send", {}, {}, {}, "BUTTON");
  const form = new FakeElement(prompt, { attachment: [attachment] }, {}, {}, "FORM", [composer, attachment, send]);
  const guardedRoot = new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [form]);
  const guardedDocument = {
    documentElement: guardedRoot,
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [form] : [],
    elementFromPoint: () => send,
  };
  const guardedInput = {
    selector: "button", output: "pointer",
    exactOutgoingTurn: {
      composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
      latestUserTurnSelector: "latest-user-turn",
      expectedPromptHash: hash(prompt), expectedAttachmentLabels: ["approved.pdf"],
    },
  } as const;
  assert.equal(JSON.stringify(await execute(source, guardedDocument, guardedInput)),
    JSON.stringify({ x: 5, y: 5, baselineUserTurnId: null }),
    "one exact prompt plus its approved attachment set must authorize the click point");
  const retriedAttachment = new FakeElement("approved(5).pdf", {}, {}, { "aria-label": "approved(5).pdf" });
  const retriedForm = new FakeElement(prompt, { attachment: [retriedAttachment] }, {}, {},
    "FORM", [composer, retriedAttachment, send]);
  assert.equal(JSON.stringify(await execute(source, {
    documentElement: new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [retriedForm]),
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [retriedForm] : [],
    elementFromPoint: () => send,
  }, guardedInput)), JSON.stringify({ x: 5, y: 5, baselineUserTurnId: null }),
  "a Provider-only final numeric duplicate suffix must preserve the approved attachment identity");
  const twoApprovedForm = new FakeElement(prompt, { attachment: [attachment, retriedAttachment] }, {}, {},
    "FORM", [composer, attachment, retriedAttachment, send]);
  assert.equal(JSON.stringify(await execute(source, {
    documentElement: new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [twoApprovedForm]),
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [twoApprovedForm] : [], elementFromPoint: () => send,
  }, { ...guardedInput, exactOutgoingTurn: { ...guardedInput.exactOutgoingTurn,
    expectedAttachmentLabels: ["approved.pdf", "approved(5).pdf"] } })),
  JSON.stringify({ x: 5, y: 5, baselineUserTurnId: null }),
  "an explicitly approved numeric-parenthetical name must win before Provider suffix normalization");
  const renamedAttachment = new FakeElement("approved(copy).pdf", {}, {}, {
    "aria-label": "approved(copy).pdf",
  });
  const renamedForm = new FakeElement(prompt, { attachment: [renamedAttachment] }, {}, {},
    "FORM", [composer, renamedAttachment, send]);
  assert.equal(await execute(source, {
    documentElement: new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [renamedForm]),
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [renamedForm] : [], elementFromPoint: () => send,
  }, guardedInput), "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
  "a non-numeric parenthetical rename must not weaken exact attachment identity");
  const noAttachmentForm = new FakeElement(prompt, { attachment: [] }, {}, {}, "FORM", [composer, send]);
  const noAttachmentRoot = new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [noAttachmentForm]);
  assert.equal(JSON.stringify(await execute(source, {
    documentElement: noAttachmentRoot,
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [noAttachmentForm] : [],
    elementFromPoint: () => send,
  }, { ...guardedInput, exactOutgoingTurn: {
    ...guardedInput.exactOutgoingTurn, expectedAttachmentLabels: [],
  } })), JSON.stringify({ x: 5, y: 5, baselineUserTurnId: null }),
  "a Product that approves zero attachments must still authorize its exact prompt click");
  assert.equal(await execute(source, guardedDocument, { ...guardedInput, exactOutgoingTurn: {
    ...guardedInput.exactOutgoingTurn, expectedAttachmentLabels: [],
  } }), "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
  "an unexpected attachment must reject the one outgoing-turn identity");
  assert.equal(await execute(source, guardedDocument, { ...guardedInput, exactOutgoingTurn: {
    ...guardedInput.exactOutgoingTurn, expectedPromptHash: hash("different prompt"),
  } }), "BROWSER_DOM_ACTION_OUTGOING_PROMPT_HASH_MISMATCH",
  "a different prompt hash must expose the exact outgoing-turn mismatch");
  const unrelatedForm = new FakeElement(prompt, { attachment: [] }, {}, {}, "FORM", [composer]);
  assert.equal(await execute(source, { ...guardedDocument,
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [unrelatedForm] : [] }, guardedInput),
  "BROWSER_DOM_ACTION_OUTGOING_STRUCTURE_MISMATCH",
  "the send button must belong to the same form as the approved outgoing turn");
};
export const exerciseCapturedGptForkCandidateFunction = async (source: string): Promise<void> => {
  const assistantTurnId = "conversation-turn-10";
  const userTurnId = "conversation-turn-9";
  const turnMarker = "[GRASSEYE:fork]";
  const prompt = `approved ${turnMarker}`;
  const response = "approved response";
  const promptNode = new FakeElement(prompt, {}, {}, {}, "DIV", [new FakeTextNode(prompt)]);
  const responseNode = new FakeElement(response, {}, {}, {}, "DIV", [new FakeTextNode(response)]);
  const userTurn = new FakeElement(prompt, {
    "[data-testid='collapsible-user-message-content']": [promptNode],
    "[data-message-author-role='user']": [promptNode],
  });
  const candidate = new FakeElement("分支到新聊天", {}, {}, {}, "BUTTON");
  const root = new FakeElement("root", { "[role='menuitem']": [candidate] });
  for (const node of [promptNode, responseNode, userTurn, candidate]) node.parentElement = root;
  const assistantSelector = `[data-testid='${assistantTurnId}']:has([data-message-author-role='assistant']) [data-message-author-role='assistant']`;
  const userSelector = `[data-testid='${userTurnId}']:has([data-message-author-role='user'])`;
  const document = {
    documentElement: root,
    querySelectorAll: (selector: string) => selector === assistantSelector ? [responseNode]
      : selector === userSelector ? [userTurn] : [],
    elementFromPoint: () => candidate,
  };
  const checkpoint = Object.freeze({
    assistantTurnId,
    canonicalConversationUrl: "https://chatgpt.com/c/opaque%20segment",
    promptHash: hash(prompt),
    responseHash: hash(response),
    turnMarker,
  });
  const input = Object.freeze({
    selector: "[role='menuitem']",
    text: { value: "分支到新聊天", exact: true },
    gptSourceCheckpoint: checkpoint,
    output: "pointer",
  });
  const href = checkpoint.canonicalConversationUrl;
  assert.equal(JSON.stringify(await execute(source, document, input, href)), JSON.stringify({ x: 5, y: 5 }),
    "the async fork resolver must validate the exact source checkpoint before returning the pointer");
  assert.equal(JSON.stringify(await execute(
    source, document, input, `${href}?query=discarded#fragment`,
  )), JSON.stringify({ x: 5, y: 5 }),
  "the fork resolver must physically discard query and fragment before source URL comparison");
  const rejected = async (overrides: Readonly<Record<string, unknown>>, observedHref: string = href) =>
    await execute(source, document, {
      ...input,
      gptSourceCheckpoint: { ...checkpoint, ...overrides },
    }, observedHref);
  assert.equal(await rejected({ assistantTurnId: "conversation-turn-11" }), "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(await rejected({ turnMarker: "[GRASSEYE:wrong]" }), "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(await rejected({ promptHash: `sha256:${"1".repeat(64)}` }), "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(await rejected({ responseHash: `sha256:${"2".repeat(64)}` }), "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(await rejected({}, "https://chatgpt.com/c/another"), "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(await execute(source, {
    ...document,
    querySelectorAll: (selector: string) => selector === assistantSelector ? [responseNode] : [],
  }, input, href), "BROWSER_DOM_CANDIDATE_MISSING",
  "the matching assistant turn must not authorize a fork without its exact preceding user turn");
  assert.equal(await execute(source, document, input,
    "https://user:password@chatgpt.com/c/opaque%20segment"), "BROWSER_DOM_CANDIDATE_MISSING",
  "the runtime source URL check must reject userinfo exactly like the canonical contract");
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
  const sanitized = execute(source, {
    documentElement: root, querySelectorAll: () => [], elementFromPoint: () => trigger,
  }, {
    candidate: { selector: "button" },
    postcondition: { queries: [
      { queryId: "reasoning-value", selector: "reasoning", maxMatches: 1,
        fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"], expectedEligibleCount: 1 },
      { queryId: "trigger", selector: "trigger", maxMatches: 1,
        fields: ["ariaExpanded"], expectedEligibleCount: 1 },
    ] },
  }, "https://chatgpt.com/c/postcondition?query=discarded#fragment") as Readonly<{
    kind: string; observation: Readonly<{ currentUrl: string }>;
  }>;
  assert.equal(sanitized.observation.currentUrl, "https://chatgpt.com/c/postcondition",
    "the coherent postcondition packet must physically discard query and fragment");
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
  const richResponse = richSemanticTree();
  const exactRoot = new FakeElement("", {
    "#markdown": [markdownComposer], "#styled": [styledComposer], "#rich": [richResponse],
  });
  markdownComposer.parentElement = exactRoot;
  styledComposer.parentElement = exactRoot;
  richResponse.parentElement = exactRoot;
  const exactResult = await execute(source, {
    documentElement: exactRoot, querySelectorAll: () => [], elementFromPoint: () => markdownComposer,
  }, [
    { queryId: "markdown", selector: "#markdown", maxMatches: 1,
      fields: ["exactEditableTextHash"] },
    { queryId: "styled", selector: "#styled", maxMatches: 1,
      fields: ["exactEditableTextHash", "semanticTextHash"] },
    { queryId: "rich", selector: "#rich", maxMatches: 1, fields: ["semanticTextHash"] },
  ]) as Readonly<{ queries: readonly Readonly<{ matches: readonly Readonly<{
      exactEditableTextHash: string; semanticTextHash?: string;
    }>[] }>[] }>;
  assert.equal(exactResult.queries[0]?.matches[0]?.exactEditableTextHash, hash(markdownPrompt),
    "Composer exact hash must preserve headings, list markers, backticks, and the trailing newline");
  assert.equal(exactResult.queries[1]?.matches[0]?.exactEditableTextHash, hash("bold"));
  assert.equal(exactResult.queries[1]?.matches[0]?.semanticTextHash, hash("**bold**"),
    "rendered semantic text must remain distinct from the Composer current-value projection");
  assert.equal(exactResult.queries[2]?.matches[0]?.semanticTextHash, hash(RICH_SEMANTIC_TEXT),
    "coherent observation must hash the whole rich answer, including text around its one code block");
};
const userPromptFixture = () => {
  const userPrompt = "[GRASSEYE:exact-user-prompt]\napproved prompt";
  const promptBody = new FakeElement(userPrompt, {}, {}, {
    "data-testid": "collapsible-user-message-content",
  }, "DIV", [
    new FakeElement("[GRASSEYE:exact-user-prompt]", {}, {}, {}, "P", [
      new FakeTextNode("[GRASSEYE:exact-user-prompt]"),
    ]),
    new FakeElement("approved prompt", {}, {}, {}, "P", [new FakeTextNode("approved prompt")]),
  ]);
  return { userPrompt, promptBody };
};

const exerciseExactUserPromptHash = async (source: string): Promise<void> => {
  const { userPrompt, promptBody } = userPromptFixture();
  const attachmentCard = new FakeElement("公开知识生产资料.zip 文件", {}, {}, {}, "DIV", [
    new FakeTextNode("公开知识生产资料.zip 文件"),
  ]);
  const collapseControl = new FakeElement("展开/收起", {}, {}, {}, "BUTTON", [new FakeTextNode("展开/收起")]);
  const userTurn = new FakeElement(`${userPrompt}公开知识生产资料.zip 文件展开/收起`, {
    "[data-testid='collapsible-user-message-content']": [promptBody],
    "[data-message-author-role='user']": [promptBody],
  }, {}, { "data-testid": "conversation-turn-1" }, "ARTICLE", [
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

  const fencedPrompt = "[GRASSEYE:fenced-user-prompt]\n```text\nexact payload\n```\napproved prompt";
  const fencedCode = new FakeElement("text\nexact payload", {}, {}, {}, "CODE", [
    new FakeTextNode("text\nexact payload"),
  ]);
  const fencedPre = new FakeElement("text\nexact payload", {}, {}, {}, "PRE", [fencedCode]);
  const fencedWrapper = new FakeElement("text\nexact payload", {}, {}, {}, "DIV", [fencedPre]);
  const fencedBody = new FakeElement(fencedPrompt, {}, {}, {
    "data-testid": "collapsible-user-message-content",
  }, "DIV", [
    new FakeElement("[GRASSEYE:fenced-user-prompt]", {}, {}, {}, "P", [
      new FakeTextNode("[GRASSEYE:fenced-user-prompt]"),
    ]),
    fencedWrapper,
    new FakeElement("approved prompt", {}, {}, {}, "P", [new FakeTextNode("approved prompt")]),
  ]);
  const fencedTurn = new FakeElement(fencedPrompt, {
    "[data-testid='collapsible-user-message-content']": [fencedBody],
    "[data-message-author-role='user']": [fencedBody],
  }, {}, { "data-testid": "conversation-turn-2" }, "ARTICLE", [fencedBody]);
  const fencedRoot = new FakeElement("", { ".user-turn": [fencedTurn] });
  fencedTurn.parentElement = fencedRoot;
  const fencedResult = await execute(source, {
    documentElement: fencedRoot, querySelectorAll: () => [], elementFromPoint: () => fencedTurn,
  }, [{ queryId: "fenced-user-turn", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{ exactGptUserPromptHash: string }>[] }>[];
    }>;
  assert.equal(fencedResult.queries[0]?.matches[0]?.exactGptUserPromptHash, hash(fencedPrompt),
    "the exact rendered user Prompt must restore ChatGPT's stripped triple-backtick fence");

  const shortPrompt = "生成一张与本文主题一致的封面图";
  const shortLeaf = new FakeElement(shortPrompt, {}, {}, { class: "max-w-full whitespace-pre-wrap" }, "DIV", [
    new FakeTextNode(shortPrompt),
  ]);
  const shortUserRoot = new FakeElement(shortPrompt, { ".whitespace-pre-wrap": [shortLeaf] }, {}, {
    "data-message-author-role": "user",
  });
  const shortTurn = new FakeElement(shortPrompt, {
    "[data-testid='collapsible-user-message-content']": [],
    "[data-message-author-role='user']": [shortUserRoot],
  }, {}, { "data-testid": "conversation-turn-5" }, "ARTICLE", [shortUserRoot]);
  const shortRoot = new FakeElement("", { ".user-turn": [shortTurn] });
  shortTurn.parentElement = shortRoot;
  const shortResult = await execute(source, {
    documentElement: shortRoot, querySelectorAll: () => [], elementFromPoint: () => shortTurn,
  }, [{ queryId: "short-user-turn", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{ exactGptUserPromptHash: string }>[] }>[];
    }>;
  assert.equal(shortResult.queries[0]?.matches[0]?.exactGptUserPromptHash, hash(shortPrompt),
    "a real short Prompt must bind the unique uncollapsed whitespace-pre-wrap leaf");
};

const exerciseRejectedUserPromptHashes = async (source: string): Promise<void> => {
  const { userPrompt, promptBody } = userPromptFixture();
  const bodyWithoutMarker = new FakeElement("approved prompt", {}, {}, {
    "data-testid": "collapsible-user-message-content",
  }, "DIV", [new FakeTextNode("approved prompt")]);
  const markerOnlyInAttachment = new FakeElement("approved prompt [GRASSEYE:exact-user-prompt]", {
    "[data-testid='collapsible-user-message-content']": [bodyWithoutMarker],
    "[data-message-author-role='user']": [bodyWithoutMarker],
  }, {}, { "data-testid": "conversation-turn-1" }, "ARTICLE", [
    bodyWithoutMarker, new FakeElement("[GRASSEYE:exact-user-prompt]", {}, {}, {}, "DIV", [
      new FakeTextNode("[GRASSEYE:exact-user-prompt]"),
    ]),
  ]);
  const markerOnlyRoot = new FakeElement("", { ".user-turn": [markerOnlyInAttachment] });
  const markerOnlyResult = await execute(source, {
    documentElement: markerOnlyRoot, querySelectorAll: () => [], elementFromPoint: () => markerOnlyInAttachment,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    exactGptUserPromptContains: "[GRASSEYE:exact-user-prompt]",
    fields: ["exactGptUserPromptHash"] }]) as Readonly<{
      queries: readonly Readonly<{ eligibleCount: number; rejections: readonly Readonly<{
        reasons: readonly string[];
      }>[] }>[];
  }>;
  assert.equal(markerOnlyResult.queries[0]?.eligibleCount, 0);
  assert.equal(markerOnlyResult.queries[0]?.rejections[0]?.reasons.length, 1);
  assert.equal(markerOnlyResult.queries[0]?.rejections[0]?.reasons[0], "TEXT_MISMATCH",
    "attachment or control text must not satisfy a Prompt-body marker requirement");
  const missingPromptBody = new FakeElement("attachment only", {
    "[data-message-author-role='user']": [promptBody],
  }, {}, {
    "data-testid": "conversation-turn-1",
  });
  const missingRoot = new FakeElement("", { ".user-turn": [missingPromptBody] });
  await assert.rejects(async () => execute(source, {
    documentElement: missingRoot, querySelectorAll: () => [], elementFromPoint: () => missingPromptBody,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]), /BROWSER_DOM_CANDIDATE_MISSING/u,
  "a user turn without the exact Prompt body must fail closed");
  const duplicatePromptTurn = new FakeElement(userPrompt, {
    "[data-testid='collapsible-user-message-content']": [promptBody, promptBody],
    "[data-message-author-role='user']": [promptBody],
  }, {}, { "data-testid": "conversation-turn-1" });
  const duplicateRoot = new FakeElement("", { ".user-turn": [duplicatePromptTurn] });
  await assert.rejects(async () => execute(source, {
    documentElement: duplicateRoot, querySelectorAll: () => [], elementFromPoint: () => duplicatePromptTurn,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]), /BROWSER_DOM_CANDIDATE_AMBIGUOUS/u,
  "multiple Prompt bodies inside one user turn must fail closed");

  const shortLeaf = (value: string) => new FakeElement(value, {}, {}, {
    class: "max-w-full whitespace-pre-wrap",
  }, "DIV", [new FakeTextNode(value)]);
  const first = shortLeaf("first");
  const second = shortLeaf("second");
  const shortUserRoot = new FakeElement("first second", { ".whitespace-pre-wrap": [first, second] }, {}, {
    "data-message-author-role": "user",
  });
  const ambiguousShortTurn = new FakeElement("first second", {
    "[data-testid='collapsible-user-message-content']": [],
    "[data-message-author-role='user']": [shortUserRoot],
  }, {}, { "data-testid": "conversation-turn-5" });
  const ambiguousShortRoot = new FakeElement("", { ".user-turn": [ambiguousShortTurn] });
  await assert.rejects(async () => execute(source, {
    documentElement: ambiguousShortRoot, querySelectorAll: () => [], elementFromPoint: () => ambiguousShortTurn,
  }, [{ queryId: "user-turns", selector: ".user-turn", maxMatches: 1,
    fields: ["exactGptUserPromptHash"] }]), /BROWSER_DOM_CANDIDATE_AMBIGUOUS/u,
  "multiple short Prompt leaves must fail closed instead of guessing");
};
const exerciseUserPromptHashes = async (source: string): Promise<void> => {
  await exerciseExactUserPromptHash(source);
  await exerciseRejectedUserPromptHashes(source);
};

const assistantTurnFixture = (responses: readonly FakeElement[]) => {
  const control = new FakeElement("复制 点赞 重试", {}, {}, {}, "BUTTON", [
    new FakeTextNode("复制 点赞 重试"),
  ]);
  const assistantTurn = new FakeElement("rich response 复制 点赞 重试", {
    "[data-message-author-role='assistant']": responses,
  }, {}, { "data-testid": "conversation-turn-2" }, "ARTICLE",
  responses.length === 0 ? [control] : [responses[0]!, control]);
  const root = new FakeElement("", { ".assistant-turn": [assistantTurn] });
  assistantTurn.parentElement = root;
  return { assistantTurn, root };
};

const exerciseAssistantSemanticTextHash = async (source: string): Promise<void> => {
  const response = richSemanticTree();
  const { assistantTurn, root } = assistantTurnFixture([response]);
  const result = await execute(source, {
    documentElement: root, querySelectorAll: () => [], elementFromPoint: () => assistantTurn,
  }, [{ queryId: "assistant-turns", selector: ".assistant-turn", maxMatches: 1,
    fields: ["testId", "semanticTextHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{
        testId: string; semanticTextHash: string;
      }>[] }>[];
    }>;
  const observed = result.queries[0]?.matches[0];
  assert.equal(observed?.testId, "conversation-turn-2");
  assert.equal(observed?.semanticTextHash, hash(RICH_SEMANTIC_TEXT),
    "the existing assistant semantic hash must exclude outer turn controls");

  const imageOnlyTurn = assistantTurnFixture([]);
  const imageOnlyResult = await execute(source, {
    documentElement: imageOnlyTurn.root, querySelectorAll: () => [],
    elementFromPoint: () => imageOnlyTurn.assistantTurn,
  }, [{ queryId: "image-turns", selector: ".assistant-turn", maxMatches: 1,
    fields: ["semanticTextHash"] }]) as Readonly<{
      queries: readonly Readonly<{ matches: readonly Readonly<{ semanticTextHash: string }>[] }>[];
    }>;
  assert.equal(imageOnlyResult.queries[0]?.matches[0]?.semanticTextHash, hash("复制 点赞 重试"),
    "a non-user image turn without assistant text must keep its outer semantic projection");

  const mixedResponse = richSemanticTree();
  const mixedUser = new FakeElement("user prompt", {}, {}, {}, "DIV", [new FakeTextNode("user prompt")]);
  const mixedTurn = new FakeElement("mixed turn", {
    "[data-message-author-role='assistant']": [mixedResponse],
    "[data-message-author-role='user']": [mixedUser],
  }, {}, { "data-testid": "conversation-turn-2" }, "ARTICLE", [mixedUser, mixedResponse]);
  const mixedRoot = new FakeElement("", { ".assistant-turn": [mixedTurn] });
  mixedTurn.parentElement = mixedRoot;
  await assert.rejects(async () => execute(source, {
    documentElement: mixedRoot, querySelectorAll: () => [], elementFromPoint: () => mixedTurn,
  }, [{ queryId: "assistant-turns", selector: ".assistant-turn", maxMatches: 1,
    fields: ["semanticTextHash"] }]), /BROWSER_DOM_READ_INVALID/u,
  "an assistant turn that also contains a user node must fail closed");

  const rejected = assistantTurnFixture([richSemanticTree(), richSemanticTree()]);
  await assert.rejects(async () => execute(source, {
    documentElement: rejected.root, querySelectorAll: () => [],
    elementFromPoint: () => rejected.assistantTurn,
  }, [{ queryId: "assistant-turns", selector: ".assistant-turn", maxMatches: 1,
    fields: ["semanticTextHash"] }]), /BROWSER_DOM_READ_INVALID/u,
  "duplicate assistant response bodies must fail closed");
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
  await exerciseAssistantSemanticTextHash(source);
  await exerciseInvalidObservationUrls(source, observationDocument);
};

export const exerciseCapturedExactAssistantTurnFunction = async (source: string): Promise<void> => {
  const text = (value: string) => new FakeTextNode(value);
  const paragraph = new FakeElement("bold", {}, {}, {}, "P", [
    new FakeElement("bold", {}, {}, {}, "STRONG", [text("bold")]),
  ]);
  const listItem = new FakeElement("item", {}, {}, {}, "LI", [text("item")]);
  const list = new FakeElement("item", {}, {}, {}, "UL", [listItem]);
  const assistant = new FakeElement("bold item", { "pre code": [] }, {}, {}, "DIV", [paragraph, list]);
  const selector = '[data-testid="conversation-turn-2"]:has([data-message-author-role="assistant"]) [data-message-author-role="assistant"]';
  const promptText = "approved [GRASSEYE:checkpoint]";
  const prompt = new FakeElement(promptText, {}, {}, {}, "DIV", [text(promptText)]);
  const user = new FakeElement(promptText, {
    "[data-testid='collapsible-user-message-content']": [prompt],
    "[data-message-author-role='user']": [prompt],
  });
  const userSelector = "[data-testid='conversation-turn-1']:has([data-message-author-role='user'])";
  const input = { kind: "readExactAssistantTurn", assistantTurnId: "conversation-turn-2",
    sourceCheckpoint: { canonicalConversationUrl: "https://chatgpt.com/c/exact",
      expectedPromptHash: hash(promptText), turnMarker: "[GRASSEYE:checkpoint]" } };
  let queryCalls = 0;
  const document = {
    querySelectorAll: (value: string) => {
      queryCalls += 1;
      return value === selector ? [assistant] : value === userSelector ? [user] : [];
    },
    elementFromPoint: () => assistant,
  };
  const observed = await execute(
    source, document, input, "https://chatgpt.com/c/exact?query=discarded#fragment",
  ) as Readonly<{
    rawCount: number; eligibleCount: number; rawDomHtml: string; semanticText: string;
    currentUrl: string; nativeStage: string;
  }>;
  assert.equal(queryCalls, 3,
    "the assistant, exact predecessor, and generating state must share one async Runtime call");
  assert.equal(observed.rawCount, 1);
  assert.equal(observed.eligibleCount, 1);
  assert.match(observed.rawDomHtml, /<strong>bold<\/strong>/u);
  assert.equal(observed.semanticText, "**bold**\n- item\n");
  assert.equal(observed.currentUrl, "https://chatgpt.com/c/exact");
  assert.equal(observed.nativeStage, "runtime-call-function-on");
  const hidden = new FakeElement("hidden", { "pre code": [] }, { display: "none" }, {}, "DIV", [text("hidden")]);
  const hiddenObserved = await execute(source, {
    querySelectorAll: (value: string) => value === selector ? [hidden]
      : value === userSelector ? [user] : [], elementFromPoint: () => null,
  }, input, "https://chatgpt.com/c/exact") as Readonly<{ rawCount: number; eligibleCount: number; rawDomHtml: string }>;
  assert.deepEqual({ rawCount: hiddenObserved.rawCount, eligibleCount: hiddenObserved.eligibleCount,
    rawDomHtml: hiddenObserved.rawDomHtml }, { rawCount: 1, eligibleCount: 0, rawDomHtml: "" });
  const ambiguous = await execute(source, {
    querySelectorAll: (value: string) => value === selector ? [assistant, assistant]
      : value === userSelector ? [user] : [], elementFromPoint: () => assistant,
  }, input, "https://chatgpt.com/c/exact") as Readonly<{ rawCount: number; eligibleCount: number }>;
  assert.deepEqual({ rawCount: ambiguous.rawCount, eligibleCount: ambiguous.eligibleCount },
    { rawCount: 2, eligibleCount: 0 });
  const rich = richSemanticTree();
  const richObserved = await execute(source, {
    querySelectorAll: (value: string) => value === selector ? [rich]
      : value === userSelector ? [user] : [],
    elementFromPoint: () => rich,
  }, input, "https://chatgpt.com/c/exact") as Readonly<{ semanticText: string }>;
  assert.equal(richObserved.semanticText, RICH_SEMANTIC_TEXT,
    "exact assistant read must preserve headings, prose, lists, inline code, the code block, and trailing prose");
};
