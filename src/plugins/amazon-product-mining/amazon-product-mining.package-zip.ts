import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  AMAZON_PACKAGE_FILE_NAMES,
  resolveAmazonPackageRootPath,
  resolveAmazonPackageZipPath,
} from "./amazon-product-mining.package-layout.js";

export type AmazonPackageZipResult = {
  packageRootPath: string;
  packageZipPath: string;
};

const assertPackageRootReady = (packageRootPath: string): void => {
  if (!existsSync(packageRootPath)) {
    throw new Error(`amazon_package_root_missing:${packageRootPath}`);
  }
  const packageJsonPath = join(packageRootPath, AMAZON_PACKAGE_FILE_NAMES.packageJson);
  if (!existsSync(packageJsonPath)) {
    throw new Error(`amazon_package_manifest_missing:${packageJsonPath}`);
  }
};

export const createAmazonProductMiningPackageZip = (input: {
  dataDir: string;
  taskId: string;
}): AmazonPackageZipResult => {
  const packageRootPath = resolveAmazonPackageRootPath(input);
  const packageZipPath = resolveAmazonPackageZipPath(input);
  assertPackageRootReady(packageRootPath);
  rmSync(packageZipPath, { force: true });
  execFileSync(
    "zip",
    ["-qr", packageZipPath, basename(packageRootPath)],
    { cwd: dirname(packageRootPath) },
  );
  return {
    packageRootPath,
    packageZipPath,
  };
};