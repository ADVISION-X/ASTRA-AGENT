import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Project } from "ts-morph";

import { inspectCodePurityInput } from "../audit/domains/code-purity/inspector.js";
import { emptyManifest, type PurityManifest } from "../audit/domains/code-purity/types.js";

type FixtureConfig = { entryScripts: string[]; manifest?: Partial<PurityManifest> };
const fixtureRoot = resolve("scripts/acceptance/fixtures/code-purity-zombie-deep");
const runtimeRoot = mkdtempSync(join(tmpdir(), "code-purity-restoration-"));

const activateSources = (directory: string): void => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) activateSources(path);
    else if (entry.isFile() && entry.name.endsWith(".ts.txt")) renameSync(path, path.slice(0, -4));
  }
};

const prefixManifest = (manifest: Partial<PurityManifest> | undefined): PurityManifest => ({
  ...emptyManifest(),
  externalEntryExports: manifest?.externalEntryExports ?? [],
  externalEntryFiles: manifest?.externalEntryFiles ?? [],
  lawfulDynamicImports: manifest?.lawfulDynamicImports ?? [],
  lawfulDynamicRegistryConsumers: manifest?.lawfulDynamicRegistryConsumers ?? [],
  lawfulSideEffectImports: manifest?.lawfulSideEffectImports ?? [],
});

const runCase = (name: string) => {
  const root = join(runtimeRoot, name);
  cpSync(join(fixtureRoot, name), root, { recursive: true });
  activateSources(root);
  writeFileSync(join(root, "tsconfig.json"), `${JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", strict: true, target: "ES2022" }, include: ["src/**/*.ts"] }, null, 2)}\n`);
  const config = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8")) as FixtureConfig;
  const project = new Project({ tsConfigFilePath: join(root, "tsconfig.json") });
  const findings = inspectCodePurityInput({
    entryScripts: config.entryScripts,
    manifest: prefixManifest(config.manifest),
    project,
    root,
    sourceFiles: project.getSourceFiles(),
  });
  return findings;
};

const has = (name: string, code: string, symbol?: string): boolean => runCase(name).some((item) => item.code === code && (symbol === undefined || item.symbol === symbol));

assert.equal(has("zombie-file", "CODE_PURITY_ZOMBIE_FILE"), true);
assert.equal(has("zombie-export", "CODE_PURITY_ZOMBIE_EXPORT", "unused"), true);
assert.equal(has("orphan-top-level-declaration", "CODE_PURITY_DEAD_INTERNAL_DECLARATION_SUBGRAPH", "dead"), true);
assert.equal(has("const-folded-dead-branch", "CODE_PURITY_LITERAL_DEAD_BRANCH"), true);
assert.equal(has("literal-mode-dead-branch", "CODE_PURITY_LITERAL_DEAD_BRANCH"), true);
assert.equal(has("commented-out-code", "CODE_PURITY_COMMENTED_OUT_CODE"), true);
assert.equal(has("dynamic-import-nonliteral", "CODE_PURITY_DYNAMIC_IMPORT_NONLITERAL"), true);
assert.equal(has("side-effect-import-laundering", "CODE_PURITY_SIDE_EFFECT_IMPORT_UNPROVEN"), true);
assert.equal(has("lawful-side-effect-import", "CODE_PURITY_SIDE_EFFECT_IMPORT_UNPROVEN"), false);
assert.equal(has("lawful-side-effect-import", "CODE_PURITY_ZOMBIE_FILE"), false);
assert.equal(has("dynamic-import-owner-boundary-violation", "CODE_PURITY_OWNER_BOUNDARY_VIOLATION"), true);
assert.equal(has("object-bag-unused-property", "CODE_PURITY_OBJECT_BAG_UNUSED_PROPERTY", "oldFlow"), true);
assert.equal(has("lawful-dynamic-registry-consumer", "CODE_PURITY_OBJECT_BAG_DYNAMIC_USAGE"), false);
assert.equal(has("reexport-barrel-laundering", "CODE_PURITY_EXPORT_STAR_FORBIDDEN"), true);

rmSync(runtimeRoot, { force: true, recursive: true });
console.log("code-purity-zombie-deep-acceptance-ok");
