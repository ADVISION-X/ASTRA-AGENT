import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createAmazonProductMiningPackageZip } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-zip.js";

const FIXTURE_DIR_PREFIX = "amazon-mining-package-";
const FIXTURE_TASK_ID = "task-acceptance";

const listFixtureDirs = (): string[] =>
  readdirSync(tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(FIXTURE_DIR_PREFIX))
    .map((entry) => join(tmpdir(), entry.name));

const selectNewestDir = (paths: readonly string[]): string | null => {
  const [latest] = [...paths].sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return latest ?? null;
};

const runAcceptanceFixture = async (): Promise<string> => {
  const before = new Set(listFixtureDirs());
  await import("./amazon-product-mining-package.acceptance.ts");
  const after = listFixtureDirs();
  const created = after.filter((dirPath) => !before.has(dirPath));
  const dataDir = selectNewestDir(created) ?? selectNewestDir(after);
  assert.ok(dataDir, "fixture_data_dir_missing");
  return dataDir;
};

export const buildAmazonProductMiningPackageFixtureZip = async (): Promise<{
  dataDir: string;
  taskId: string;
  packageZipPath: string;
}> => {
  const dataDir = await runAcceptanceFixture();
  const { packageZipPath } = createAmazonProductMiningPackageZip({
    dataDir,
    taskId: FIXTURE_TASK_ID,
  });
  assert.equal(existsSync(packageZipPath), true);
  return {
    dataDir,
    taskId: FIXTURE_TASK_ID,
    packageZipPath,
  };
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  const fixture = await buildAmazonProductMiningPackageFixtureZip();
  process.stdout.write(`${fixture.packageZipPath}\n`);
}