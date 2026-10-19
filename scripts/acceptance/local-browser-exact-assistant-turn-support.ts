import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFixedDocument, FixedDocumentReadFailure } from "../../src/lib/browser/chrome-extension/dom-fixed-document-read.js";
import { observeKnownGptRateLimitDialog } from "../../src/lib/browser/chrome-extension/gpt-rate-limit-dialog.js";
import { exactAssistantRuntimeFor, exactAssistantTarget as target, successfulAssistantObservation as observation,
  executeExactAssistantFixture as execute, exactConversationFixtureUrl } from "./local-browser-dom-runtime-fixture.js";
import { withSyntheticDom } from "./local-browser-dom-function-fixture.js";
import type { Page } from "playwright";

export { exactConversationFixtureUrl } from "./local-browser-dom-runtime-fixture.js";

const userId = observation.precedingUserTurnId, assistantId = observation.assistantTurnId;
const body = `<h1>Title</h1><p>Body <code>inline</code></p><ul><li>item</li></ul>`
  + `<pre><code>{"ok":true}</code></pre><p>end</p>`;
const turn = (content = body, ids = `${assistantId} ${assistantId}`, outerId = userId) => `
  <section data-turn-key="${outerId}">
    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="${outerId}">
      <div data-user-message-bubble="true">folded fixture-marker</div>
    </div>
    <div data-chatgpt-search-unit-key="fallback-turn-0:1:assistant" data-chatgpt-search-message-ids="${ids}">
      <h4 data-conversation-role="assistant">assistant</h4>
      <div data-markdown-text-style="assistant-message">${content}</div>
    </div>
  </section>`;

const runPage = (page: Page, deadline = Date.now() + 20_000) => {
  const fixture = exactAssistantRuntimeFor(observation, ["loader-current"], {
    evaluate: (expression) => page.evaluate(expression), releaseFailure: new Error("release must be unreachable on success"),
  });
  return { fixture, result: execute(fixture, deadline) as Promise<Record<string, unknown>> };
};

const expectStage = (code: string, stage: string) => (error: unknown): boolean => {
  assert.ok(error instanceof FixedDocumentReadFailure);
  assert.equal(error.message, code); assert.equal(error.commandStage, stage);
  return true;
};

const exerciseRealAtomicBody = async (page: Page): Promise<void> => {
  await page.goto(exactConversationFixtureUrl + "?discard=query#fragment");
  await page.setContent(turn());
  const baseline = runPage(page), result = await baseline.result;
  assert.equal(result.semanticText, "Title\nBody `inline`\n- item\n\n{\"ok\":true}\nend");
  assert.match(String(result.rawDomHtml), /<pre><code>\{"ok":true\}<\/code><\/pre>/u);
  assert.deepEqual(baseline.fixture.released, []);
  assert.equal(baseline.fixture.scanCalls(), 1);
  for (const attribute of ["hidden", 'aria-hidden="true"', "inert", 'style="display:none"']) {
    for (const unit of ['data-markdown-text-style="assistant-message"', 'data-user-message-bubble="true"',
      `data-turn-key="${userId}"`]) {
      await page.setContent(turn().replace(unit, `${unit} ${attribute}`));
      assert.equal((await runPage(page).result).semanticText, result.semanticText);
    }
  }
  await page.setContent(turn() + `<section data-turn-key="00000000-0000-4000-8000-000000000003"></section>
    <form data-chatgpt-composer><button aria-label="停止"></button></form>`);
  const generating = await runPage(page).result;
  assert.equal(generating.semanticText, result.semanticText); assert.equal(generating.generatingRaw, 1);
  await page.setContent(turn('<pre><code>{"schema_version":"target-language-candidate.v3","items":[]}</code></pre>'));
  assert.equal(JSON.parse(String((await runPage(page).result).semanticText).trim()).schema_version,
    "target-language-candidate.v3", "JSON code blocks retain complete parseable content");
};

const exerciseRealPending = async (page: Page): Promise<void> => {
  await page.setContent("");
  assert.equal((await runPage(page).result).pendingCause, "exact-user-turn-unavailable");
  await page.setContent(turn());
  await page.locator("[data-chatgpt-search-unit-key$=':assistant']").evaluate(node => node.remove());
  assert.equal((await runPage(page).result).pendingCause, "adjacent-assistant-missing");
};

const exerciseRealIdentityChanges = async (page: Page): Promise<void> => {
  await page.setContent(turn());
  await page.locator("[data-chatgpt-search-unit-key$=':assistant']").evaluate(node => node.after(node.cloneNode(true)));
  await assert.rejects(runPage(page).result, expectStage("BROWSER_DOM_CANDIDATE_AMBIGUOUS", "exact-assistant-observation"));
  await page.setContent(turn());
  let reads = 0;
  const rerendered = exactAssistantRuntimeFor(observation, ["loader-current"], { evaluate: async expression => {
    if (++reads === 2) await page.locator("[data-turn-key]").evaluate(node => {
      const id = "00000000-0000-4000-8000-000000000003";
      node.setAttribute("data-turn-key", id);
      node.querySelector("[data-chatgpt-search-unit-key$=':user']")!.setAttribute("data-chatgpt-search-message-ids", id);
    });
    return page.evaluate(expression);
  } });
  await assert.rejects(execute(rerendered), expectStage("BROWSER_DOCUMENT_INVALID", "exact-assistant-observation"));
};

const exerciseRealIdentity = async (page: Page): Promise<void> => {
  await exerciseRealIdentityChanges(page);
  await page.setContent(turn() + turn());
  await assert.rejects(runPage(page).result, expectStage("BROWSER_DOM_CANDIDATE_AMBIGUOUS", "exact-user-materialization"));
  await page.setContent(turn(body, `${assistantId} 00000000-0000-4000-8000-000000000003`));
  await assert.rejects(runPage(page).result, expectStage("BROWSER_DOCUMENT_INVALID", "exact-assistant-observation"));
  await page.setContent(turn().replace(`data-chatgpt-search-message-ids="${userId}"`,
    'data-chatgpt-search-message-ids="00000000-0000-4000-8000-000000000003"'));
  await assert.rejects(runPage(page).result, expectStage("BROWSER_DOCUMENT_INVALID", "exact-user-materialization"));
  await page.goto("https://chatgpt.com/c/wrong"); await page.setContent(turn());
  await assert.rejects(runPage(page).result, expectStage("BROWSER_DOCUMENT_INVALID", "exact-user-materialization"));
};

const exerciseDecoderAndLoader = async (): Promise<void> => {
  for (const patch of [{ rawCount: 2 }, { rawDomHtml: "" }, { extra: true }, { nativeStage: "runtime-call-function-on" }]) {
    await assert.rejects(execute(exactAssistantRuntimeFor({ ...observation, ...patch })),
      expectStage("rawCount" in patch ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" : "BROWSER_DOM_READ_INVALID", "exact-assistant-observation"));
  }
  for (let driftAt = 0; driftAt < 4; driftAt += 1) {
    const loaders = Array.from({ length: 4 }, (_, index) => index < driftAt ? "loader-current" : "loader-next");
    const fixture = exactAssistantRuntimeFor(observation, loaders);
    await assert.rejects(execute(fixture), expectStage("BROWSER_DOCUMENT_INVALID",
      driftAt < 2 ? "exact-user-materialization" : "exact-assistant-observation"));
  }
  for (const pendingCause of ["exact-user-turn-unavailable", "adjacent-assistant-missing"]) {
    const reply = await execute(exactAssistantRuntimeFor({ ...observation, rawCount: 0,
      rawDomHtml: "", semanticText: "", pendingCause,
      ...(pendingCause === "exact-user-turn-unavailable" ? { precedingUserTurnId: "", assistantTurnId: "" } : {}),
    })) as Record<string, unknown>;
    assert.equal(reply.pendingCause, pendingCause); assert.match(String(reply.observationRevisionHash), /^sha256:[a-f0-9]{64}$/u);
  }
};

const fixed = (fixture: ReturnType<typeof exactAssistantRuntimeFor>, assertCurrent: () => void = () => undefined) => readFixedDocument({
  runtime: fixture.runtime, target, expectedMainFrameLoaderId: "loader-current", assertCurrent,
  stage: "exact-assistant-observation", script: "function () { return 1; }", argument: {},
  decode: (value) => { if (value !== 1) throw new Error("BROWSER_DOM_READ_INVALID"); return value; },
});

const exerciseFailureClassification = async (page: Page): Promise<void> => {
  await page.goto(exactConversationFixtureUrl);
  const fixture = exactAssistantRuntimeFor(observation, ["loader-current"], { evaluate: source => page.evaluate(source) });
  const binding = { runtime: fixture.runtime, target, expectedMainFrameLoaderId: "loader-current",
    stage: "exact-assistant-observation" as const, assertCurrent: () => undefined,
    argument: {}, decode: (value: unknown) => value };
  for (const [script, code] of [["function () { throw new Error('page secret'); }", "BROWSER_DOM_SCRIPT_FAILED"],
    ["function () { throw new Error('BROWSER_DOCUMENT_INVALID'); }", "BROWSER_DOCUMENT_INVALID"]]) {
    await assert.rejects(readFixedDocument({ ...binding, script: script! }), expectStage(code!, "exact-assistant-observation"));
  }
  for (const raw of [{ result: { value: { kind: "mystery", value: 1 } } },
    { result: { value: { kind: "failure", code: "BROWSER_UNKNOWN" } } },
    { result: { value: { kind: "value", value: 1, extra: true } } }, { result: { value: { kind: "value", value: 2 } } }]) {
    await assert.rejects(fixed(exactAssistantRuntimeFor(observation, ["loader-current"], { response: () => raw })),
      expectStage("BROWSER_DOM_READ_INVALID", "exact-assistant-observation"));
  }
  for (const [failure, code] of [[new Error("native secret"), "BROWSER_DOM_EXECUTION_FAILED"],
    [new Error("BROWSER_COMMAND_PERMIT_EXPIRED"), "BROWSER_COMMAND_PERMIT_EXPIRED"]] as const) {
    await assert.rejects(fixed(exactAssistantRuntimeFor(observation, ["loader-current"], { response: () => { throw failure; } })),
      expectStage(code, "exact-assistant-observation"));
  }
  await assert.rejects(fixed(fixture, () => { throw new Error("BROWSER_DOCUMENT_INVALID"); }),
    expectStage("BROWSER_DOCUMENT_INVALID", "exact-assistant-observation"));
};

const exerciseExceptionalResources = async (): Promise<void> => {
  for (const [raw, ids, code] of [
    [{ exceptionDetails: {} }, [], "BROWSER_DOM_SCRIPT_FAILED"],
    [{ result: { objectId: "a" }, exceptionDetails: { exception: { objectId: "a" } } }, ["a"], "BROWSER_DOM_SCRIPT_FAILED"],
    [{ result: { objectId: "a" }, exceptionDetails: { exception: { objectId: "b" } } }, ["a", "b"], "BROWSER_DOM_SCRIPT_FAILED"],
    [{ result: { objectId: "a" } }, ["a"], "BROWSER_DOM_READ_INVALID"],
  ] as const) {
    for (const cleanupFailure of [false, true]) {
      const fixture = exactAssistantRuntimeFor(observation, ["loader-current"], {
        response: () => raw, ...(cleanupFailure ? { releaseFailure: new Error("cleanup failure") } : {}),
      });
      await assert.rejects(fixed(fixture), (error: unknown) => {
        expectStage(code, "exact-assistant-observation")(error);
        assert.ok((error as Error).cause instanceof AggregateError);
        assert.equal(((error as Error).cause as AggregateError).errors.length, 1 + (cleanupFailure ? ids.length : 0));
        return true;
      });
      assert.deepEqual(fixture.released, [...ids]);
    }
  }
  const canceled = exactAssistantRuntimeFor(observation, ["loader-current"], {
    response: () => ({ result: { objectId: "a" }, exceptionDetails: { exception: { objectId: "b" } } }),
  });
  const guard = () => { if (canceled.callCount()) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED"); };
  await assert.rejects(fixed(canceled, guard), (error: unknown) => {
    expectStage("BROWSER_DOM_SCRIPT_FAILED", "exact-assistant-observation")(error);
    assert.equal(((error as Error).cause as AggregateError).errors.length, 2); return true;
  });
  assert.deepEqual(canceled.released, [], "cancellation cannot release into a new binding");
  const navigated = exactAssistantRuntimeFor(observation, ["loader-current", "loader-next"], {
    response: () => ({ result: { objectId: "a" }, exceptionDetails: { exception: { objectId: "b" } } }),
  });
  await assert.rejects(fixed(navigated), (error: unknown) => {
    expectStage("BROWSER_DOM_SCRIPT_FAILED", "exact-assistant-observation")(error);
    const causes = ((error as Error).cause as AggregateError).errors;
    assert.equal(causes.length, 2); assert.equal(causes[1].message, "BROWSER_DOCUMENT_INVALID"); return true;
  });
  assert.deepEqual(navigated.released, [], "post-read Document drift prohibits all resource sends");
};

const exercisePreflightBoundary = async (page: Page): Promise<void> => {
  await page.goto(exactConversationFixtureUrl); await page.setContent("");
  const fixture = exactAssistantRuntimeFor(observation, ["loader-current"], { evaluate: source => page.evaluate(source) });
  const fact = await observeKnownGptRateLimitDialog(fixture.runtime, target, `sha256:${"1".repeat(64)}`, () => undefined);
  assert.equal(fact.state, "absent"); assert.deepEqual(fixture.released, []);
  for (const [response, code] of [
    [() => ({ exceptionDetails: {} }), "BROWSER_DOM_SCRIPT_FAILED"],
    [() => { throw new Error("native failure"); }, "BROWSER_DOM_EXECUTION_FAILED"],
    [() => ({ result: { value: { kind: "value", value: { ...fact, observationHash: `sha256:${"f".repeat(64)}` } } } }), "BROWSER_DOM_READ_INVALID"],
  ] as const) {
    const broken = exactAssistantRuntimeFor(observation, ["loader-current"], { response });
    await assert.rejects(observeKnownGptRateLimitDialog(broken.runtime, target, `sha256:${"1".repeat(64)}`, () => undefined),
      expectStage(code, "rate-limit-preflight"));
  }
};

const exerciseScanLimits = async (): Promise<void> => {
  const empty = { ids: [], containerFound: true, atTop: false, scrollTop: 0, nextScrollTop: 0 };
  const unavailable = { ...observation, rawCount: 0, rawDomHtml: "", semanticText: "",
    precedingUserTurnId: "", assistantTurnId: "", pendingCause: "exact-user-turn-unavailable" };
  for (const samples of [[empty, empty, { ...empty, atTop: true }],
    [empty, empty, empty, empty],
    [empty, empty, empty, { ...empty, scrollTop: -100 }, { ...empty, ids: [userId] }]]) {
    const found = samples.at(-1)!.ids.length > 0;
    const fixture = exactAssistantRuntimeFor(found ? observation : unavailable, ["loader-current"], {
      response: async (phase, _source, index) => {
        await Promise.resolve();
        return { result: { value: { kind: "value", value: phase === "answer"
          ? found ? observation : unavailable : samples[index] } } };
      },
    });
    assert.equal((await execute(fixture) as Record<string, unknown>).semanticText,
      found ? observation.semanticText : "");
    assert.equal(fixture.scanCalls(), samples.length, "scan waits for delayed progress and stops on true absence/stall");
  }
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const fixture = exactAssistantRuntimeFor(unavailable, ["loader-current"], {
      response: (phase, _source, index) => {
        if (phase === "scan") now += 4_000;
        return { result: { value: { kind: "value", value: phase === "answer" ? unavailable
          : { ...empty, scrollTop: -index * 100, nextScrollTop: -(index + 1) * 100 } } } };
      },
    });
    await execute(fixture, now + 100_000);
    assert.equal(fixture.scanCalls(), 3, "materialization keeps the original 12 second budget");
    assert.equal(fixture.answerCalls(), 1, "the final observation follows the fully settled bounded scan");
  } finally { Date.now = originalNow; }
};

export const exerciseExactAssistantMaterialization = async (): Promise<void> => {
  await exerciseScanLimits();
  await withSyntheticDom(async page => {
    await page.goto(exactConversationFixtureUrl);
    for (const reverse of [false, true]) {
      await page.setContent(`<style>#scroll {height:100px;overflow:auto;display:flex;flex-direction:${reverse ? "column-reverse" : "column"}} .spacer{height:10000px;flex-shrink:0}</style>
        <div id="scroll"><div data-turn-key="00000000-0000-4000-8000-000000000003"></div><div class="spacer"></div></div>`);
      await page.evaluate(`(() => {
        const reverse = ${JSON.stringify(reverse)}, html = ${JSON.stringify(turn())};
        const scroll = document.querySelector("#scroll");
        scroll.scrollTop = reverse ? 0 : scroll.scrollHeight;
        const mount = () => {
          if (scroll.scrollTop <= (reverse ? -9500 : 100)) {
            scroll.removeEventListener("scroll", mount); scroll.insertAdjacentHTML("afterbegin", html);
          }
        };
        scroll.addEventListener("scroll", mount);
      })()`);
      const sample = runPage(page), result = await sample.result;
      assert.equal(result.semanticText, "Title\nBody `inline`\n- item\n\n{\"ok\":true}\nend");
      assert.ok(sample.fixture.scanCalls() > 80, "live long-page geometry has no fixed 80-step cap");
      assert.equal(sample.fixture.answerCalls(), 1);
    }
    await page.setContent(`<div style="height:100px;overflow:auto"><div style="height:2000px"></div></div>`);
    const short = runPage(page, Date.now() + 3_100);
    assert.equal((await short.result).pendingCause, "exact-user-turn-unavailable");
    assert.equal(short.fixture.scanCalls(), 1);
  });
};

export const exerciseExactAssistantTurnRead = async (): Promise<void> => {
  await exerciseDecoderAndLoader();
  await exerciseExceptionalResources();
  await withSyntheticDom(async page => {
    await exerciseRealAtomicBody(page); await exerciseRealPending(page); await exerciseRealIdentity(page);
    await exerciseFailureClassification(page); await exercisePreflightBoundary(page);
  });
  await exerciseExactAssistantMaterialization();
};
