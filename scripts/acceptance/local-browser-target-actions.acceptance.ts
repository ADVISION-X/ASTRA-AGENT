import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const controller = await readFile("src/lib/browser/browser-controller.ts", "utf8");
const worker = await readFile("src/lib/browser/chrome-extension/service-worker.ts", "utf8");
for (const required of ["createTargetSession", "BrowserTargetRef", "BrowserDocumentRef", "evaluate<T>", "closeTarget"]) assert.equal(controller.includes(required), true, required);
for (const forbidden of ["evaluateActiveTab", "closeActiveTab", "desktopScreen", "reuse-active-tab"]) assert.equal(controller.includes(forbidden), false, forbidden);
for (const command of ["navigate_target", "evaluate_target", "click_target", "scroll_target", "text_target", "screenshot_target", "set_file_input_files"]) assert.equal(worker.includes(command), true, command);
assert.equal(worker.includes("active: false"), true, "background target acquisition must not steal focus");
process.stdout.write("[local-browser-target-actions] PASS\n");
