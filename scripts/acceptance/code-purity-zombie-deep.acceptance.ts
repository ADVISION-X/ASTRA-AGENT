import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Project } from "ts-morph";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { resolveFromRepo, toRepoPath } from "../audit/shared/paths.js";
import {
  resolveCodePurityBudget,
  resolveCodePurityOwner,
  resolveCodePurityRole,
} from "../audit/domains/code-purity/components/code-purity-owner-model.js";
import type { GovernedFile } from "../audit/domains/code-purity/components/code-purity-governed-files.js";
import { scanOwnerBoundaries } from "../audit/domains/code-purity/components/scan-owner-boundaries.js";
import { scanZombieSurfaces } from "../audit/domains/code-purity/components/scan-zombie-surfaces.js";
import { createInspectorContextFixture } from "../audit/shared/inspector-context-acceptance-support.js";

type FixtureConfig = { entryScripts: string[] };
type ExpectedFinding = { checkId: string; fileIncludes?: string; symbolName?: string };

const LAW_IDS = ["LAW-CODE-PURITY-001-V4", "LAW-CODE-PURITY-002-V1", "LAW-CODE-PURITY-003-V1"];
const FIXTURE_ROOT = resolveFromRepo("scripts/acceptance/fixtures/code-purity-zombie-deep");
const RUNTIME_ROOT = resolveFromRepo("tmp/code-purity-zombie-deep-runtime");

const activateSources = (directory: string): void => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) activateSources(absolute);
    else if (entry.isFile() && entry.name.endsWith(".ts.txt")) renameSync(absolute, absolute.slice(0, -4));
  }
};

const createRuntimeProject = (runtimeDirectory: string): Project => {
  writeFileSync(path.join(runtimeDirectory, "tsconfig.json"), `${JSON.stringify({
    compilerOptions: { module: "ESNext", moduleResolution: "Bundler", strict: true, target: "ES2022" },
    include: ["src/**/*.ts"],
  }, null, 2)}\n`);
  return new Project({ tsConfigFilePath: path.join(runtimeDirectory, "tsconfig.json") });
};

const buildGovernedFiles = (project: Project, runtimeRepoPath: string): GovernedFile[] =>
  project.getSourceFiles().filter((sourceFile) => !sourceFile.isDeclarationFile()).map((sourceFile) => {
    const repoPath = toRepoPath(sourceFile.getFilePath());
    const role = resolveCodePurityRole(repoPath);
    return {
      budget: resolveCodePurityBudget(repoPath, role),
      lineCount: sourceFile.getEndLineNumber(),
      owner: resolveCodePurityOwner(repoPath),
      repoPath,
      role,
      sourceFile,
    };
  }).filter((file) => file.repoPath.startsWith(`${runtimeRepoPath}/src/`))
    .sort((left, right) => left.repoPath.localeCompare(right.repoPath));

const prefix = (root: string, value: string): string => `${root}/${value}`;
const parseEvidence = (evidence: string | undefined): Record<string, unknown> => {
  if (!evidence) return {};
  try { return JSON.parse(evidence) as Record<string, unknown>; } catch { return {}; }
};

const runCase = (caseName: string) => {
  const fixtureDirectory = path.join(FIXTURE_ROOT, caseName);
  const runtimeDirectory = path.join(RUNTIME_ROOT, caseName);
  rmSync(runtimeDirectory, { force: true, recursive: true });
  mkdirSync(path.dirname(runtimeDirectory), { recursive: true });
  cpSync(fixtureDirectory, runtimeDirectory, { recursive: true });
  activateSources(runtimeDirectory);
  const config = JSON.parse(readFileSync(path.join(runtimeDirectory, "fixture.json"), "utf8")) as FixtureConfig;
  const project = createRuntimeProject(runtimeDirectory);
  const runtimeRepoPath = toRepoPath(runtimeDirectory);
  const governedFiles = buildGovernedFiles(project, runtimeRepoPath);
  const context = createInspectorContextFixture(project, "code-purity", LAW_IDS);
  const packageScripts = Object.fromEntries(config.entryScripts.map((entry, index) => [
    `fixture:${index + 1}`, `node --import tsx ${prefix(runtimeRepoPath, entry)}`,
  ]));
  const zombie = scanZombieSurfaces(context, governedFiles, LAW_IDS, { packageScripts });
  return [...zombie.findings, ...scanOwnerBoundaries(governedFiles, LAW_IDS).findings];
};

const hasFinding = (caseName: string, expected: ExpectedFinding): boolean => runCase(caseName).some((finding) =>
  finding.checkId === expected.checkId
  && (!expected.fileIncludes || finding.filePath?.includes(expected.fileIncludes))
  && (!expected.symbolName || parseEvidence(finding.evidence).symbolName === expected.symbolName));

const required: Array<[string, ExpectedFinding]> = [
  ["zombie-file", { checkId: "code-purity/zombie-file", fileIncludes: "/zombie-file/src/orphan.ts" }],
  ["zombie-export", { checkId: "code-purity/zombie-export", symbolName: "unused" }],
  ["namespace-property-usage", { checkId: "code-purity/zombie-export", symbolName: "unused" }],
  ["namespace-dynamic-evasion", { checkId: "code-purity/namespace-dynamic-usage" }],
  ["reexport-barrel-laundering", { checkId: "code-purity/barrel-reexport-laundering", symbolName: "unused" }],
  ["type-only-runtime-separation", { checkId: "code-purity/zombie-export", symbolName: "Foo" }],
  ["orphan-top-level-declaration", { checkId: "code-purity/zombie-top-level-declaration", symbolName: "dead" }],
  ["dead-export-internal-helper", { checkId: "code-purity/dead-export-helper-subgraph", symbolName: "deadHelper" }],
  ["reachable-file-dead-internal-subgraph", { checkId: "code-purity/dead-internal-declaration-subgraph", symbolName: "deadHelper" }],
  ["dead-export-nested-helper-chain", { checkId: "code-purity/dead-internal-declaration-subgraph", symbolName: "deadLeaf" }],
  ["dead-class-used-only-by-dead-export", { checkId: "code-purity/dead-export-helper-subgraph", symbolName: "DeadClass" }],
  ["dead-type-used-only-by-dead-type-export", { checkId: "code-purity/dead-export-helper-subgraph", symbolName: "DeadShape" }],
  ["handler-map-unused-entry", { checkId: "code-purity/handler-map-unused-entry", symbolName: "oldFlow" }],
  ["object-bag-unused-property", { checkId: "code-purity/object-bag-unused-property", symbolName: "oldFlow" }],
  ["object-bag-dynamic-usage", { checkId: "code-purity/object-bag-dynamic-usage" }],
  ["registry-bag-laundering", { checkId: "code-purity/registry-bag-laundering" }],
  ["lawful-dynamic-registry-consumer", { checkId: "code-purity/registry-bag-laundering" }],
  ["lawful-dynamic-registry-consumer", { checkId: "code-purity/object-bag-unused-property" }],
  ["identifier-count-false-proof", { checkId: "code-purity/zombie-top-level-declaration", symbolName: "dead" }],
  ["const-folded-dead-branch", { checkId: "code-purity/zombie-dead-branch" }],
  ["literal-mode-dead-branch", { checkId: "code-purity/zombie-dead-branch" }],
  ["commented-out-code", { checkId: "code-purity/commented-out-executable-code" }],
  ["dynamic-import-nonliteral", { checkId: "code-purity/dynamic-import-nonliteral" }],
  ["dynamic-import-owner-boundary-violation", { checkId: "code-purity/plugin-non-facade-capability-import" }],
  ["side-effect-import-owner-boundary-violation", { checkId: "code-purity/plugin-non-facade-capability-import" }],
];
const forbidden: Array<[string, ExpectedFinding]> = [
  ["default-import-alias", { checkId: "code-purity/zombie-export", symbolName: "default" }],
  ["named-import-alias", { checkId: "code-purity/zombie-export", symbolName: "foo" }],
  ["lawful-manifest-entry", { checkId: "code-purity/zombie-file" }],
  ["lawful-manifest-entry", { checkId: "code-purity/zombie-export" }],
  ["lawful-side-effect-import", { checkId: "code-purity/zombie-file", fileIncludes: "/lawful-side-effect-import/src/side-effect.ts" }],
];

for (const [caseName, expected] of required) assert.equal(hasFinding(caseName, expected), true, `${caseName} must emit ${expected.checkId}`);
for (const [caseName, expected] of forbidden) assert.equal(hasFinding(caseName, expected), false, `${caseName} must not emit ${expected.checkId}`);
assert.ok(runCase("zombie-to-zombie-chain").filter((finding) => finding.checkId === "code-purity/zombie-file").length >= 3);
rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("code-purity-zombie-deep-acceptance-ok");
emitQualityProofObservation({ lawId: "LAW-CODE-PURITY-003-V1", evidenceMode: "exam.golden", locator: "acceptance:code-purity:zombie-mutant-matrix", observedValue: "required zombie mutants rejected and allowed ownership cases retained" });
