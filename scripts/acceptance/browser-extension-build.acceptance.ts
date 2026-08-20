import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildChromeExtension } from "../../src/lib/browser/chrome-extension/build.mjs";

const outputDirectory = resolve(process.cwd(), ".grasseye-local/browser-build/extension-acceptance");
const result = await buildChromeExtension(["--out", outputDirectory]);
const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.json"), "utf8")) as Record<string, unknown>;
const worker = await readFile(resolve(outputDirectory, "service-worker.js"), "utf8");
const receipt = JSON.parse(await readFile(resolve(outputDirectory, "extension-build-manifest.json"), "utf8")) as Record<string, unknown>;

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.background, { service_worker: "service-worker.js", type: "module" });
assert.equal(typeof result.extensionTreeHash, "string");
assert.equal(receipt.extensionTreeHash, result.extensionTreeHash);
assert.ok(Array.isArray(receipt.inputs) && receipt.inputs.length > 0, "The build receipt must bind every bundled source input.");
assert.ok(Array.isArray(receipt.files) && receipt.files.length === 2, "The extension output must contain only its manifest and one bundled worker.");
assert.equal(/from\s+["']node:/u.test(worker), false, "The MV3 bundle must not retain a Node runtime import.");
assert.equal(/\beval\s*\(/u.test(worker), false, "The MV3 bundle must not create an eval surface.");

console.log("BROWSER_EXTENSION_BUILD_ACCEPTANCE_PASS");
