import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

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

const runtime = await readFile("src/lib/browser/exact-target/browser-command-runtime.ts", "utf8");
const worker = await readFile("src/lib/browser/chrome-extension/service-worker.ts", "utf8");
assert.equal(runtime.includes("toBrowserEvaluationExpression(input.script)"), true, "exact-target runtime must own evaluation normalization");
assert.equal(worker.includes("new Function"), false, "MV3 worker must not add a private evaluator");
assert.equal(worker.includes("eval("), false, "MV3 worker must execute the normalized expression directly");
for (const command of ["evaluate_target", "click_target", "scroll_target", "text_target", "set_file_input_files"]) {
  assert.equal(worker.includes(command), true, command);
}
assert.equal(worker.includes("Input.insertText"), false, "component text entry must not bypass ordered keyboard events");
for (const keyboardEvent of ["dispatchTypedCharacter", "rawKeyDown", 'type: "char"', 'type: "keyUp"']) {
  assert.equal(worker.includes(keyboardEvent), true, `ordered keyboard event missing: ${keyboardEvent}`);
}
assert.equal(worker.includes("real file receiver did not retain the approved file"), false, "input.files retention is not component attachment truth");
assert.equal(worker.includes("active: false"), true, "background target acquisition must not steal focus");
process.stdout.write("[local-browser-target-actions] PASS\n");
