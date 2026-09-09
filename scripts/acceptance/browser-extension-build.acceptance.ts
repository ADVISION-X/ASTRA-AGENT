import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
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
assert.match(worker, /DOM\.setFileInputFiles/u, "The registered exact-target file-input command must reach the Chrome DevTools file-input primitive.");
assert.match(worker, /Page\.setInterceptFileChooserDialog/u,
  "The one file-input command must arm and close the Provider-native chooser interception.");
assert.match(worker, /Page\.fileChooserOpened/u,
  "The one file-input command must bind the Provider chooser event before setting files.");
assert.match(worker, /Input\.dispatchMouseEvent/u,
  "The exact visible Provider upload leaf must be physically clicked inside the one file-input command.");
assert.match(worker, /#upload-files/u, "The file-input executor must remain pinned to the observed ChatGPT document input.");
assert.match(worker, /browser\.authenticated-media\.v1/u, "The registered authenticated media observation must remain on the one encrypted Browser chain.");
assert.match(worker, /gpt-generated-image-main/u, "Authenticated media retrieval must remain pinned to the fixed generated-image semantic identity.");
assert.match(worker, /Runtime\.evaluate/u, "The fixed authenticated media observation must execute inside the signed-in exact page session.");
assert.equal("externally_connectable" in manifest, false, "The MV3 manifest cannot retain page relay connectivity.");
assert.equal("storage" in manifest, false, "Automatic pairing and reload must remain memory-only.");
assert.deepEqual(manifest.permissions, ["debugger", "alarms"], "The fixed extension must not retain active-tab authority.");
assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1/*"], "The MV3 manifest may reach only the fixed loopback authority endpoint.");
assert.match(pairingPage, /lang="zh-CN"/u, "The fixed operator pairing page must default to Chinese.");
assert.match(popup, /GRASSEYE_BROWSER_STATUS/u, "Reopening the popup must recover current in-memory authentication status.");
assert.match(worker, /TargetClaimAwaiter/u, "A job-bound target claim must wait for the Workbench encrypted acknowledgement before success.");
assert.match(worker, /failedFrameKind/u, "The production extension must report the failed authenticated frame kind to the Workbench.");
assert.match(worker, /failedFrameSequence/u, "The production extension must report the failed authenticated frame sequence to the Workbench.");
assert.match(worker, /getPlatformInfo/u, "The bundled MV3 worker must retain its immediate and 20-second Chrome API liveness pulse.");
assert.match(worker, /close\(4e3,/u, "The bundled worker must retain explicit programmatic close diagnostics.");
assert.doesNotMatch(worker, /BROWSER_PAIRING_ALREADY_AUTHENTICATED/u, "Repeating pair after authentication must not create a Chrome extension error.");
assert.match(worker, /failedFrameKind/u, "The bundled worker must retain authenticated frame diagnostics after production rebuild.");
assert.doesNotMatch(pairingPage, /type="password"|pairing-secret/u, "The popup must not ask the operator to copy or paste a secret.");
assert.doesNotMatch(pairingPage, /id="claim"|认领当前 HTTPS/u, "The popup must not retain the manual target-claim path.");
assert.doesNotMatch(popup, /GRASSEYE_CLAIM_ACTIVE_TARGET/u, "The popup must not retain a manual target-claim message.");
assert.match(popupSource, /readWorkbenchPairingState/u, "The popup reconnect action must use the governed automatic bootstrap.");
assert.match(worker, /GRASSEYE_AUTO_PAIRING_ALARM/u, "The service worker must retain the governed automatic pairing wake path.");
assert.match(worker, /runtime\.reload/u, "A stale unpacked extension must reload itself after exact build-identity comparison.");
assert.match(worker, /releaseBuildId/u, "Automatic reload must compare the AGENT and loaded extension build identities.");
assert.match(worker, /TARGET_ACQUIRE/u, "The authenticated channel must retain the sole job-bound target acquisition frame.");
assert.match(worker, /acquireJobBoundChatGptTarget/u, "The job-bound frame must trigger the fixed extension's exact ChatGPT claim.");
assert.match(worker, /tabs\.create/u, "The fixed extension must create the one governed production Tab without activeTab permission.");
assert.match(worker, /active:\s*false/u, "The one governed production Tab must be created without changing the operator's active Tab.");
assert.match(worker, /tabs\.update/u, "The mutation-only interaction gate must be able to activate the exact system Tab.");
assert.match(worker, /onActivated/u, "The mutation-only interaction gate must recheck the active-tab generation before Provider input.");
assert.match(worker, /BROWSER_TARGET_NOT_INTERACTIVE/u, "The interaction gate must fail closed when the system Tab is no longer active.");
assert.doesNotMatch(worker, /Page\.bringToFront|windows\.update/u,
  "The production extension must not focus a window or retain a second foregrounding path.");
assert.match(worker, /debugger\.getTargets/u, "MV3 recovery must verify the exact prior debugger-owned tabId.");
assert.match(worker, /https:\/\/chatgpt\.com\//u, "Zero matching targets must use the one fixed ChatGPT start URL.");
assert.doesNotMatch(worker, /tabs\.query|GRASSEYE_CLAIM_ACTIVE_TARGET/u, "The retired active-tab claim path must be physically absent.");

console.log("BROWSER_EXTENSION_BUILD_ACCEPTANCE_PASS");
