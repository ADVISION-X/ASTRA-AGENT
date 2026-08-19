import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { chromium } from "playwright";

import {
  atomicDomExpression,
  atomicDomFillPreparationExpression,
  atomicDomFillVerificationExpression,
} from "../../src/lib/browser/chrome-extension/atomic-dom-command.js";
import { toBrowserEvaluationExpression } from "../../src/lib/browser/exact-target/browser-evaluation-contract.js";

const functionBody = `
const values = [19, 23];
return { answer: values[0] + values[1], marker: "production-function-body" };
`;
const expression = toBrowserEvaluationExpression(functionBody);
assert.equal(
  JSON.stringify(runInNewContext(expression)),
  JSON.stringify({ answer: 42, marker: "production-function-body" }),
  "the production normalizer must make a top-level return executable",
);
assert.equal(expression.match(/\(\(\) => \{/gu)?.length, 1, "the function body must be wrapped exactly once");

const targetSession = await readFile("src/lib/browser/exact-target/exact-browser-target-session.ts", "utf8");
const worker = await readFile("src/lib/browser/chrome-extension/service-worker.ts", "utf8");
const interactionCommands = await readFile("src/lib/browser/chrome-extension/service-worker-interaction-commands.ts", "utf8");
const keyboardCommands = await readFile("src/lib/browser/chrome-extension/service-worker-keyboard.ts", "utf8");
const atomicDom = await readFile("src/lib/browser/chrome-extension/atomic-dom-command.ts", "utf8");
const workerSurface = `${worker}\n${interactionCommands}\n${keyboardCommands}`;
assert.equal(targetSession.includes("toBrowserEvaluationExpression(input.script)"), true, "exact-target session must own evaluation normalization");
assert.equal(worker.includes("new Function"), false, "MV3 worker must not add a private evaluator");
assert.equal(worker.includes("eval("), false, "MV3 worker must execute the normalized expression directly");
for (const command of ["evaluate_target", "click_target", "click_dom_target", "fill_dom_target", "scroll_target", "text_target", "set_file_input_files"]) {
  assert.equal(workerSurface.includes(command), true, command);
}
for (const atomicSignal of ["TARGET_IDENTITY_CHANGED", "TARGET_VALUE_MISMATCH", "TARGET_COMPONENT_REJECTED", "atomicDomExpression", "atomicDomFillPreparationExpression", "atomicDomFillVerificationExpression"]) {
  assert.equal(`${worker}\n${atomicDom}`.includes(atomicSignal), true, `atomic DOM guard missing: ${atomicSignal}`);
}
assert.equal(worker.includes("Input.insertText"), false, "component text entry must not bypass ordered keyboard events");
for (const keyboardEvent of ["dispatchTypedCharacter", "rawKeyDown", 'type: "char"', 'type: "keyUp"']) {
  assert.equal(workerSurface.includes(keyboardEvent), true, `ordered keyboard event missing: ${keyboardEvent}`);
}
assert.equal(workerSurface.includes("real file receiver did not retain the approved file"), false, "input.files retention is not component attachment truth");
assert.equal(worker.includes("active: false"), true, "background target acquisition must not steal focus");

const launched = await chromium.launch({ headless: true });
try {
  const page = await launched.newPage();
  await page.setContent(`<button id="action" onclick="this.dataset.clicked='yes'">action</button>
    <kat-input id="field" type="text" state="error"></kat-input>
    <script>
      customElements.define("kat-input", class extends HTMLElement {
        connectedCallback() {
          const root = this.attachShadow({ mode: "open" });
          root.innerHTML = '<input id="editor" type="text">';
          root.querySelector("input").addEventListener("input", (event) => {
            if (!event.isTrusted) {
              this.setAttribute("state", "error");
              return;
            }
            this.removeAttribute("state");
            this.dataset.committed = event.target.value;
          });
        }
      });
    </script>`);
  await assert.rejects(
    page.evaluate(atomicDomExpression({
      kind: "click_dom_target", tabId: 1, selector: "#action",
      identity: { tagName: "button", id: "different-action" }, expectedText: "action",
    })),
    /TARGET_IDENTITY_CHANGED/u,
  );
  assert.equal(await page.locator("#action").getAttribute("data-clicked"), null);
  await page.evaluate(atomicDomExpression({
    kind: "click_dom_target", tabId: 1, selector: "#action",
    identity: { tagName: "button", type: "button", id: "action", visibleText: "action" }, expectedText: "action",
  }));
  assert.equal(await page.locator("#action").getAttribute("data-clicked"), "yes");
  const fillCommand = {
    kind: "fill_dom_target", tabId: 1, selector: "#field",
    identity: { tagName: "kat-input", type: "text", id: "field" },
    approvedText: "ATOMIC_VALUE", clearBeforeType: true,
  } as const;
  await assert.rejects(page.evaluate(atomicDomExpression(fillCommand)), /governed keyboard lifecycle/u);

  const syntheticMarker = "synthetic-rejection";
  await page.evaluate(atomicDomFillPreparationExpression(fillCommand, syntheticMarker));
  await page.locator("#field").evaluate((host) => {
    const editor = host.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!editor) throw new Error("fixture editor missing");
    editor.value = "ATOMIC_VALUE";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: "ATOMIC_VALUE" }));
  });
  await assert.rejects(
    page.evaluate(atomicDomFillVerificationExpression(fillCommand, syntheticMarker, "ATOMIC_VALUE", true)),
    /TARGET_COMPONENT_REJECTED/u,
  );

  const marker = "trusted-keyboard-acceptance";
  await page.evaluate(atomicDomFillPreparationExpression(fillCommand, marker));
  await page.keyboard.press("Backspace");
  await page.evaluate(atomicDomFillVerificationExpression(fillCommand, marker, "", false));
  let expectedValue = "";
  for (const character of fillCommand.approvedText) {
    await page.evaluate(atomicDomFillVerificationExpression(fillCommand, marker, expectedValue, false));
    await page.keyboard.type(character);
    expectedValue += character;
    await page.evaluate(atomicDomFillVerificationExpression(fillCommand, marker, expectedValue, false));
  }
  await page.evaluate(atomicDomFillVerificationExpression(fillCommand, marker, expectedValue, true));
  assert.equal(await page.locator("#field").getAttribute("data-committed"), "ATOMIC_VALUE");
  assert.equal(await page.locator("#field").getAttribute("state"), null);
  assert.equal(await page.locator("#field").evaluate((host) => host.shadowRoot?.querySelector<HTMLInputElement>("input")?.value), "ATOMIC_VALUE");
} finally {
  await launched.close();
}
process.stdout.write("[local-browser-target-actions] PASS\n");
