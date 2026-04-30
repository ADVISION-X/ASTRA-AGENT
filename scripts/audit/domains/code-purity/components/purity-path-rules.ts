import path from "node:path";

const GENERIC_BUCKET_BASENAMES = new Set([
  "utils.ts",
  "utils.js",
  "utils.mjs",
  "helpers.ts",
  "helpers.js",
  "helpers.mjs",
  "service.ts",
  "service.js",
  "service.mjs",
  "manager.ts",
  "manager.js",
  "manager.mjs",
  "common.ts",
  "common.js",
  "common.mjs",
  "workbench.ts",
]);

const FAKE_PATH_NAMES = new Set(["mock", "mocks", "fake", "fixture", "fixtures", "demo", "placeholder"]);

const splitRelativePath = (relativePath: string): string[] =>
  relativePath.split("/").filter((segment) => segment.length > 0);

const hasFakePathToken = (segment: string): boolean => {
  const normalized = path.parse(segment).name.toLowerCase();
  return FAKE_PATH_NAMES.has(normalized);
};

export const isGenericBucketSourceFile = (relativePath: string): boolean =>
  GENERIC_BUCKET_BASENAMES.has(path.basename(relativePath));

export const isProductionFakePath = (relativePath: string): boolean =>
  splitRelativePath(relativePath).some((segment) => hasFakePathToken(segment));

export const hasSpecifierFakePathToken = (specifier: string): boolean =>
  splitRelativePath(specifier).some((segment) => hasFakePathToken(segment));