import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { retiredBrowserPaths } from "../audit/domains/local-browser-session/inspector-old-path-zero.js";

for (const filePath of retiredBrowserPaths) assert.equal(existsSync(filePath), false, `${filePath} must be physically deleted`);
process.stdout.write("[local-browser-atomic-cutover] PASS\n");
