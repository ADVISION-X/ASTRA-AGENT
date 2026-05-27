import assert from "node:assert/strict";
import { basename } from "node:path";
import { execFileSync } from "node:child_process";

import { buildAmazonProductMiningPackageFixtureZip } from "./amazon-product-mining-package-fixture.js";

const fixture = await buildAmazonProductMiningPackageFixtureZip();
const archiveEntries = execFileSync(
  "unzip",
  ["-Z", "-1", fixture.packageZipPath],
  { encoding: "utf8" },
)
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

assert.equal(
  basename(fixture.packageZipPath),
  `amazon-product-mining-package-${fixture.taskId}.zip`,
);
assert.equal(
  archiveEntries.includes(`amazon-product-mining-package-${fixture.taskId}/amazon-product-mining-package.json`),
  true,
);
assert.equal(
  archiveEntries.includes(`amazon-product-mining-package-${fixture.taskId}/00-master-report/Amazon-Product-Mining-Master-Evidence-Report.pdf`),
  true,
);
assert.equal(
  archiveEntries.includes(`amazon-product-mining-package-${fixture.taskId}/05-ai-handoff/handoff-record.json`),
  true,
);

console.log("amazon-product-mining-package-zip.acceptance: ok");