import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { hashExtensionDirectoryV1 } from "../../src/lib/browser/release/extension-directory-hash-v1.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID, readUnpackedExtensionReleaseIdentity } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";

const GRASSEYE_UNPACKED_EXTENSION_DIRECTORY = ".grasseye-local/browser-build/extension";

const record = await readUnpackedExtensionReleaseIdentity(resolve(process.cwd(), ".grasseye-local/browser-release/release-record.json"));
assert.equal(record.extensionId, GRASSEYE_UNPACKED_EXTENSION_ID);
assert.equal(record.extensionDirectoryHashV1, await hashExtensionDirectoryV1(resolve(process.cwd(), GRASSEYE_UNPACKED_EXTENSION_DIRECTORY)));
assert.ok(record.releaseBuildId.startsWith("build-"));
const loadedServiceWorker = await readFile(resolve(process.cwd(), GRASSEYE_UNPACKED_EXTENSION_DIRECTORY, "service-worker.js"), "utf8");
assert.equal(loadedServiceWorker.includes(record.releaseBuildId), true, "the loaded service worker must carry the exact releaseBuildId admitted by Workbench");
assert.equal(loadedServiceWorker.includes("__GRASSEYE_RELEASE_BUILD_ID__"), false, "the extension build must replace the build identity token before release");
console.log("BROWSER_EXTENSION_RELEASE_IDENTITY_ACCEPTANCE_PASS");
