import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildChromeExtension } from "../../src/lib/browser/chrome-extension/build.mjs";

const outputDirectory = resolve(process.cwd(), ".grasseye-local/browser-build/extension");
const result = await buildChromeExtension();
const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.json"), "utf8")) as Record<string, unknown>;
const worker = await readFile(resolve(outputDirectory, "service-worker.js"), "utf8");
const popup = await readFile(resolve(outputDirectory, "pairing-popup.js"), "utf8");
const popupSource = await readFile(
  resolve(process.cwd(), "src/lib/browser/chrome-extension/pairing-popup.ts"),
  "utf8",
);
const pairingPage = await readFile(resolve(outputDirectory, "pairing.html"), "utf8");
const receipt = JSON.parse(await readFile(resolve(outputDirectory, "extension-build-manifest.json"), "utf8")) as Record<string, unknown>;

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.minimum_chrome_version, "120", "The fixed extension must run on a Chrome release with WebSocket service-worker lifetime support.");
assert.deepEqual(manifest.background, { service_worker: "service-worker.js", type: "module" });
assert.equal(typeof result.extensionTreeHash, "string");
assert.equal(receipt.extensionTreeHash, result.extensionTreeHash);
assert.equal(result.outputDirectory, outputDirectory, "The extension build has one fixed unpacked directory.");
assert.ok(Array.isArray(receipt.inputs) && receipt.inputs.length > 0, "The build receipt must bind every bundled source input.");
assert.ok(Array.isArray(receipt.files) && receipt.files.length === 4, "The extension output must contain its manifest, one bundled worker and the local pairing popup.");
assert.deepEqual((receipt.files as Array<{ path: string }>).map((file) => file.path).sort(), ["manifest.json", "pairing-popup.js", "pairing.html", "service-worker.js"], "The extension output must not add a second transport or remote code surface.");
assert.equal(/from\s+["']node:/u.test(worker), false, "The MV3 bundle must not retain a Node runtime import.");
assert.equal(/\beval\s*\(/u.test(worker), false, "The MV3 bundle must not create an eval surface.");
assert.doesNotMatch(worker, /DOMParser/u, "The MV3 service worker must not depend on page-only DOMParser.");
assert.doesNotMatch(worker, /Runtime\.evaluate/u, "The extension executor must not add a script-evaluation command surface.");
assert.match(worker, /DOM\.setFileInputFiles/u, "The registered exact-target file-input command must reach the Chrome DevTools file-input primitive.");
assert.match(worker, /#upload-files/u, "The file-input executor must remain pinned to the observed ChatGPT document input.");
assert.equal("externally_connectable" in manifest, false, "The MV3 manifest cannot retain page relay connectivity.");
assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1/*"], "The MV3 manifest may reach only the fixed loopback authority endpoint.");
assert.match(pairingPage, /lang="zh-CN"/u, "The fixed operator pairing page must default to Chinese.");
assert.match(popup, /GRASSEYE_BROWSER_STATUS/u, "Reopening the popup must recover current in-memory authentication status.");
assert.match(worker, /TargetClaimAwaiter/u, "A target claim must wait for the Workbench encrypted acknowledgement before the popup reports success.");
assert.match(worker, /failedFrameKind/u, "The production extension must report the failed authenticated frame kind to the Workbench.");
assert.match(worker, /failedFrameSequence/u, "The production extension must report the failed authenticated frame sequence to the Workbench.");
assert.match(worker, /getPlatformInfo/u, "The bundled MV3 worker must retain its immediate and 20-second Chrome API liveness pulse.");
assert.match(worker, /close\(4e3,/u, "The bundled worker must retain explicit programmatic close diagnostics.");
assert.doesNotMatch(worker, /BROWSER_PAIRING_ALREADY_AUTHENTICATED/u, "Repeating pair after authentication must not create a Chrome extension error.");
assert.match(worker, /failedFrameKind/u, "The bundled worker must retain authenticated frame diagnostics after production rebuild.");
assert.match(popupSource, /请先在 GrassEye Workbench/u, "The popup must direct the operator to the one legal pairing-secret source.");

console.log("BROWSER_EXTENSION_BUILD_ACCEPTANCE_PASS");
