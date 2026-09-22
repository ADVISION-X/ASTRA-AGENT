import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeRegisteredDomIntent } from
  "../../src/lib/browser/chrome-extension/dom-intent-runtime.js";
import { FakeElement, FakeTextNode, execute, hash } from "./local-browser-dom-function-fixture.js";
import { mutationInfrastructureReply } from "./local-browser-dom-runtime-fixture.js";

const noPageReadBarrier = async (): Promise<void> => undefined;

type PointerClickIntent = Extract<Parameters<typeof executeRegisteredDomIntent>[2], {
  kind: "click" | "doubleClick";
}>;

const exercisePointerQualification = async (source: string): Promise<void> => {
  const target = new FakeElement("Run", {}, {}, {}, "BUTTON");
  const scope = new FakeElement("Container text is deliberately not equal to Run", { button: [target] });
  target.parentElement = scope;
  const document = { documentElement: scope,
    querySelectorAll: (selector: string) => selector === "main" ? [scope] : [], elementFromPoint: () => target };
  assert.equal(await execute(source, document, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), target, "scope text must not be mistaken for target exact text");
  const pointerInput = { selector: "button", scope: { selector: "main" },
    text: { value: "Run", exact: true }, output: "pointer" } as const;
  assert.equal(JSON.stringify(await execute(source, document, pointerInput)), JSON.stringify({ x: 5, y: 5 }),
    "the captured function must derive the pointer point from the same unique candidate and hit-test");
  for (const [candidate, expected] of [
    [new FakeElement("Run", {}, {}, { disabled: "" }, "BUTTON"), "BROWSER_DOM_ACTION_DISABLED"],
    [new FakeElement("Run", {}, { pointerEvents: "none" }, {}, "BUTTON"),
      "BROWSER_DOM_ACTION_POINTER_EVENTS_NONE"],
  ] as const) {
    const candidateScope = new FakeElement("scope", { button: [candidate] });
    candidate.parentElement = candidateScope;
    assert.equal(await execute(source, { documentElement: candidateScope,
      querySelectorAll: () => [candidateScope], elementFromPoint: () => candidate }, pointerInput), expected);
  }
  assert.equal(await execute(source, { ...document, elementFromPoint: () => new FakeElement("overlay") }, pointerInput),
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  const wrongText = new FakeElement("Wrong", {}, {}, {}, "BUTTON");
  const wrongTextScope = new FakeElement("scope", { button: [wrongText] });
  wrongText.parentElement = wrongTextScope;
  assert.equal(await execute(source, { documentElement: wrongTextScope,
    querySelectorAll: () => [wrongTextScope], elementFromPoint: () => wrongText }, pointerInput),
  "BROWSER_DOM_ACTION_NOT_QUALIFIED",
  "a present selector with the wrong stable text must hard-fail instead of entering redraw confirmation");
  const excessiveScopes = Array.from({ length: 257 }, () => new FakeElement("scope"));
  assert.equal(await execute(source, { ...document, querySelectorAll: () => excessiveScopes }, {
    selector: "button", scope: { selector: "main" },
  }), "BROWSER_DOM_READ_INVALID", "257 scope candidates must fail the whole call");
  const excessiveTargets = Array.from({ length: 256 }, () => new FakeElement("Run"));
  const oneScope = new FakeElement("scope", { button: excessiveTargets });
  assert.equal(await execute(source, { ...document, querySelectorAll: () => [oneScope] }, {
    selector: "button", scope: { selector: "main" }, text: { value: "Run", exact: true },
  }), "BROWSER_DOM_READ_INVALID", "scope plus target candidates must share the 256 budget");
};

const exerciseRequiredClickPoint = async (source: string): Promise<void> => {
  const thumb = new FakeElement("", {}, { pointerEvents: "none" }, { "aria-hidden": "true" });
  thumb.getBoundingClientRect = () => ({ left: 7, top: 2, right: 9, bottom: 4, width: 2, height: 2 });
  const slider = new FakeElement("", { thumb: [thumb] }, {}, {}, "DIV", [thumb]);
  const root = new FakeElement("", { slider: [slider] }, {}, {}, "MAIN", [slider]);
  const document = { documentElement: root, elementFromPoint: () => thumb };
  const request = { selector: "slider", clickPointSelector: "thumb", output: "pointer" };
  assert.equal(JSON.stringify(await execute(source, document, request)), JSON.stringify({ x: 8, y: 3 }),
    "a hidden non-interactive thumb may locate one click inside its actionable slider ancestor");
  const missing = new FakeElement("", { thumb: [] }, {}, {}, "DIV");
  const missingRoot = new FakeElement("", { slider: [missing] }, {}, {}, "MAIN", [missing]);
  assert.equal(await execute(source, { documentElement: missingRoot, elementFromPoint: () => missing }, request),
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  assert.equal(await execute(source, { ...document, elementFromPoint: () => new FakeElement("overlay") }, request),
    "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
};

const outgoingFixture = () => {
  const prompt = "approved prompt";
  const composer = new FakeElement(prompt, {}, {}, { contenteditable: "true" }, "DIV", [new FakeTextNode(prompt)]);
  const attachment = new FakeElement("approved.pdf", {}, {}, { "aria-label": "approved.pdf" });
  const send = new FakeElement("Send", {}, {}, {}, "BUTTON");
  const form = new FakeElement(prompt, { attachment: [attachment] }, {}, {}, "FORM", [composer, attachment, send]);
  const guardedDocument = {
    documentElement: new FakeElement("root", { button: [send] }, {}, {}, "MAIN", [form]),
    querySelectorAll: (selector: string) => selector === "composer" ? [composer]
      : selector === "form" ? [form] : [], elementFromPoint: () => send,
  };
  const guardedInput = { selector: "button", output: "pointer", exactOutgoingTurn: {
    composerSelector: "composer", composerFormSelector: "form", attachmentSelector: "attachment",
    userTurnSelector: "user-turn", expectedPromptHash: hash(prompt), expectedAttachmentLabels: ["approved.pdf"],
  } } as const;
  return { prompt, composer, attachment, send, form, guardedDocument, guardedInput };
};

const exerciseOutgoingAttachmentIdentity = async (source: string): Promise<void> => {
  const fixture = outgoingFixture();
  assert.equal(JSON.stringify(await execute(source, fixture.guardedDocument, fixture.guardedInput)),
    JSON.stringify({ x: 5, y: 5 }));
  const retried = new FakeElement("approved(5).pdf", {}, {}, { "aria-label": "approved(5).pdf" });
  const retriedForm = new FakeElement(fixture.prompt, { attachment: [retried] }, {}, {},
    "FORM", [fixture.composer, retried, fixture.send]);
  const documentFor = (form: FakeElement) => ({
    documentElement: new FakeElement("root", { button: [fixture.send] }, {}, {}, "MAIN", [form]),
    querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
      : selector === "form" ? [form] : [], elementFromPoint: () => fixture.send,
  });
  assert.equal(JSON.stringify(await execute(source, documentFor(retriedForm), fixture.guardedInput)),
    JSON.stringify({ x: 5, y: 5 }),
    "a Provider-only final numeric duplicate suffix must preserve the approved attachment identity");
  const dateTimeSuffixed = new FakeElement("approved(20260920-014044).pdf", {}, {}, {
    "aria-label": "approved(20260920-014044).pdf",
  });
  const dateTimeSuffixedForm = new FakeElement(fixture.prompt, { attachment: [dateTimeSuffixed] }, {}, {},
    "FORM", [fixture.composer, dateTimeSuffixed, fixture.send]);
  assert.equal(JSON.stringify(await execute(source, documentFor(dateTimeSuffixedForm), fixture.guardedInput)),
    JSON.stringify({ x: 5, y: 5 }),
    "a Provider-only final date-time suffix must preserve the approved attachment identity");
  const twoApproved = new FakeElement(fixture.prompt, { attachment: [fixture.attachment, retried] }, {}, {},
    "FORM", [fixture.composer, fixture.attachment, retried, fixture.send]);
  const explicitNames = { ...fixture.guardedInput, exactOutgoingTurn: {
    ...fixture.guardedInput.exactOutgoingTurn, expectedAttachmentLabels: ["approved.pdf", "approved(5).pdf"] } };
  assert.equal(JSON.stringify(await execute(source, documentFor(twoApproved), explicitNames)),
    JSON.stringify({ x: 5, y: 5 }),
    "an explicitly approved numeric-parenthetical name must win before Provider suffix normalization");
  const exactDateTimeNames = { ...fixture.guardedInput, exactOutgoingTurn: {
    ...fixture.guardedInput.exactOutgoingTurn,
    expectedAttachmentLabels: ["approved.pdf", "approved(20260920-014044).pdf"],
  } };
  const twoDateTimeApproved = new FakeElement(fixture.prompt,
    { attachment: [fixture.attachment, dateTimeSuffixed] }, {}, {},
    "FORM", [fixture.composer, fixture.attachment, dateTimeSuffixed, fixture.send]);
  assert.equal(JSON.stringify(await execute(source, documentFor(twoDateTimeApproved), exactDateTimeNames)),
    JSON.stringify({ x: 5, y: 5 }),
    "an explicitly approved date-time-parenthetical name must win before Provider suffix normalization");
  const noAttachment = new FakeElement(fixture.prompt, { attachment: [] }, {}, {},
    "FORM", [fixture.composer, fixture.send]);
  assert.equal(JSON.stringify(await execute(source, documentFor(noAttachment), { ...fixture.guardedInput,
    exactOutgoingTurn: { ...fixture.guardedInput.exactOutgoingTurn, expectedAttachmentLabels: [] } })),
  JSON.stringify({ x: 5, y: 5 }),
  "a Product that approves zero attachments must still authorize its exact prompt click");
};

const exerciseOutgoingRejections = async (source: string): Promise<void> => {
  const fixture = outgoingFixture();
  const renamed = new FakeElement("approved(copy).pdf", {}, {}, { "aria-label": "approved(copy).pdf" });
  const renamedForm = new FakeElement(fixture.prompt, { attachment: [renamed] }, {}, {},
    "FORM", [fixture.composer, renamed, fixture.send]);
  const renamedDocument = { ...fixture.guardedDocument,
    documentElement: new FakeElement("root", { button: [fixture.send] }, {}, {}, "MAIN", [renamedForm]),
    querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
      : selector === "form" ? [renamedForm] : [] };
  assert.equal(await execute(source, renamedDocument, fixture.guardedInput),
    "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  for (const invalidLabel of [
    "approved (20260920-014044).pdf",
    "approved(2026092-014044).pdf",
    "approved(20260920-01404).pdf",
    "approved(20260920_014044).pdf",
    "approved(5)(20260920-014044).pdf",
  ]) {
    const invalid = new FakeElement(invalidLabel, {}, {}, { "aria-label": invalidLabel });
    const invalidForm = new FakeElement(fixture.prompt, { attachment: [invalid] }, {}, {},
      "FORM", [fixture.composer, invalid, fixture.send]);
    const invalidDocument = { ...fixture.guardedDocument,
      documentElement: new FakeElement("root", { button: [fixture.send] }, {}, {}, "MAIN", [invalidForm]),
      querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
        : selector === "form" ? [invalidForm] : [] };
    assert.equal(await execute(source, invalidDocument, fixture.guardedInput),
      "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
      `the Browser submit guard must reject an unapproved Provider suffix shape: ${invalidLabel}`);
  }
  for (const [invalidLabel, approvedLabel] of [
    ["approved(5)(20260920-014044).pdf", "approved(5).pdf"],
    ["approved(20260920-014044)(7).pdf", "approved(20260920-014044).pdf"],
  ] as const) {
    const invalid = new FakeElement(invalidLabel, {}, {}, { "aria-label": invalidLabel });
    const invalidForm = new FakeElement(fixture.prompt, { attachment: [invalid] }, {}, {},
      "FORM", [fixture.composer, invalid, fixture.send]);
    const invalidDocument = { ...fixture.guardedDocument,
      documentElement: new FakeElement("root", { button: [fixture.send] }, {}, {}, "MAIN", [invalidForm]),
      querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
        : selector === "form" ? [invalidForm] : [] };
    assert.equal(await execute(source, invalidDocument, { ...fixture.guardedInput, exactOutgoingTurn: {
      ...fixture.guardedInput.exactOutgoingTurn, expectedAttachmentLabels: [approvedLabel],
    } }), "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH",
    `the Browser submit guard must reject a second Provider suffix: ${invalidLabel}`);
  }
  const historicalTurns = [1, 7, 3].map((ordinal) => new FakeElement("turn", {}, {}, {
    "data-testid": `conversation-turn-${ordinal}` }));
  const historyDocument = { ...fixture.guardedDocument,
    querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
      : selector === "form" ? [fixture.form] : selector === "user-turn"
        ? [...historicalTurns, new FakeElement("turn", {}, {}, { "data-testid": "conversation-turn-bad" })] : [] };
  assert.equal(JSON.stringify(await execute(source, historyDocument, fixture.guardedInput)), JSON.stringify({ x: 5, y: 5 }));
  assert.equal(await execute(source, fixture.guardedDocument, { ...fixture.guardedInput, exactOutgoingTurn: {
    ...fixture.guardedInput.exactOutgoingTurn, expectedAttachmentLabels: [] } }),
  "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(await execute(source, fixture.guardedDocument, { ...fixture.guardedInput, exactOutgoingTurn: {
    ...fixture.guardedInput.exactOutgoingTurn, expectedPromptHash: hash("different prompt") } }),
  "BROWSER_DOM_ACTION_OUTGOING_PROMPT_HASH_MISMATCH");
  const unrelated = new FakeElement(fixture.prompt, { attachment: [] }, {}, {}, "FORM", [fixture.composer]);
  assert.equal(await execute(source, { ...fixture.guardedDocument,
    querySelectorAll: (selector: string) => selector === "composer" ? [fixture.composer]
      : selector === "form" ? [unrelated] : [] }, fixture.guardedInput),
  "BROWSER_DOM_ACTION_OUTGOING_STRUCTURE_MISMATCH");
};

export const exerciseCapturedCandidateFunction = async (source: string): Promise<void> => {
  await exercisePointerQualification(source);
  await exerciseRequiredClickPoint(source);
  await exerciseOutgoingAttachmentIdentity(source);
  await exerciseOutgoingRejections(source);
};

export const exerciseNativePointerSequences = async (): Promise<void> => {
  const run = async (intent: PointerClickIntent): Promise<readonly Readonly<Record<string, unknown>>[]> => {
    const events: Readonly<Record<string, unknown>>[] = [];
    let postconditionReads = 0;
    const runtime = { awaitPageReadPermission: noPageReadBarrier,
      async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      const infrastructure = mutationInfrastructureReply(method, parameters);
      if (infrastructure !== undefined) return infrastructure;
      if (method === "DOM.querySelectorAll") {
        if (parameters?.selector !== "hydrated") return { nodeIds: [7] };
        if (events.length === 0) return { nodeIds: [] };
        postconditionReads += 1;
        return { nodeIds: postconditionReads < 2 ? [] : [7] };
      }
      if (method === "Input.dispatchMouseEvent") { events.push(parameters ?? {}); return {}; }
      throw new Error(`UNEXPECTED_POINTER_SEQUENCE_METHOD:${method}`);
    } } as ExtensionDebuggerRuntime;
    const result = await executeRegisteredDomIntent(runtime, { tabId: 121 } as never, intent,
      () => undefined) as Readonly<{ postconditionVerified: boolean }>;
    assert.equal(result.postconditionVerified, true,
      "pointer mutation must wait through shell-only rendering until its direct postcondition is ready");
    assert.equal(postconditionReads, 2);
    return events;
  };
  const point = { x: 5, y: 5 };
  const move = { type: "mouseMoved", ...point, button: "none", buttons: 0 };
  const press = (clickCount: 1 | 2) =>
    ({ type: "mousePressed", ...point, button: "left", buttons: 1, clickCount });
  const release = (clickCount: 1 | 2) =>
    ({ type: "mouseReleased", ...point, button: "left", buttons: 0, clickCount });
  assert.deepEqual(await run({ kind: "click", selector: "button", expectedMatches: 1,
    postClickMatch: { selector: "hydrated", expectedMatches: 1, timeoutMs: 4_500 } }),
  [move, press(1), release(1)]);
  assert.deepEqual(await run({ kind: "doubleClick", selector: "button", expectedMatches: 1,
    postDoubleClickMatch: { selector: "hydrated", expectedMatches: 1, timeoutMs: 4_500 } }),
  [move, press(1), release(1), press(2), release(2)]);
};
