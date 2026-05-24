import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Project } from "ts-morph";

import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../audit/shared/paths.js";
import {
  resolveCodePurityBudget,
  resolveCodePurityOwner,
  resolveCodePurityRole,
} from "../audit/domains/code-purity/components/code-purity-owner-model.js";
import type { GovernedFile } from "../audit/domains/code-purity/components/code-purity-governed-files.js";
import { scanOwnerBoundaries } from "../audit/domains/code-purity/components/scan-owner-boundaries.js";
import { scanZombieSurfaces } from "../audit/domains/code-purity/components/scan-zombie-surfaces.js";
import type { ZombieExemptionManifest } from "../audit/domains/code-purity/components/zombie-exemption-manifest.js";

type FixtureManifestConfig = {
  externalEntryExports?: Array<{ exportName: string; filePath: string }>;
  externalEntryFiles?: string[];
  lawfulDynamicImports?: Array<{ consumerFilePath: string; targetFilePath: string }>;
  lawfulDynamicRegistryConsumers?: Array<{
    consumerFilePath: string;
    registryExportName: string;
    registryFilePath: string;
  }>;
  lawfulDynamicNamespaceConsumers?: Array<{ consumerFilePath: string; targetFilePath: string }>;
  lawfulSideEffectImports?: Array<{ consumerFilePath: string; targetFilePath: string }>;
};

type FixtureConfig = {
  entryScripts: string[];
  manifest?: FixtureManifestConfig;
};

const LAW_IDS = [
  "APEX-CODE-PURITY-004-V1",
  "APEX-CODE-PURITY-005-V1",
  "APEX-CODE-PURITY-006-V1",
  "APEX-CODE-PURITY-007-V1",
  "APEX-CODE-PURITY-011-V1",
  "APEX-CODE-PURITY-017-V1",
  "APEX-CODE-PURITY-018-V1",
  "APEX-CODE-PURITY-019-V1",
  "APEX-CODE-PURITY-020-V1",
  "APEX-CODE-PURITY-021-V1",
];
const FIXTURE_ROOT = resolveFromRepo("scripts/acceptance/fixtures/code-purity-zombie-deep");
const RUNTIME_ROOT = resolveFromRepo("tmp/code-purity-zombie-deep-runtime");

const readFixtureConfig = (caseName: string): FixtureConfig =>
  JSON.parse(readFileSync(path.join(FIXTURE_ROOT, caseName, "fixture.json"), "utf8")) as FixtureConfig;

const createRuntimeProject = (runtimeDir: string): Project => {
  writeFileSync(
    path.join(runtimeDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          target: "ES2022",
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  return new Project({ tsConfigFilePath: path.join(runtimeDir, "tsconfig.json") });
};

const buildFixtureGovernedFiles = (project: Project, runtimeRepoPath: string): GovernedFile[] =>
  project.getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile())
    .map((sourceFile) => {
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
    })
    .filter((governedFile) => governedFile.repoPath.startsWith(`${runtimeRepoPath}/src/`))
    .sort((left, right) => left.repoPath.localeCompare(right.repoPath));

const prefixRuntimePath = (runtimeRepoPath: string, relativePath: string): string => `${runtimeRepoPath}/${relativePath}`;

const buildPackageScripts = (entryScripts: readonly string[], runtimeRepoPath: string): Record<string, string> =>
  Object.fromEntries(
    entryScripts.map((entryScript, index) => [
      `fixture:${index + 1}`,
      `node --import tsx ${prefixRuntimePath(runtimeRepoPath, entryScript)}`,
    ]),
  );

const buildManifest = (runtimeRepoPath: string, manifest: FixtureManifestConfig | undefined): ZombieExemptionManifest => ({
  externalEntryExports: (manifest?.externalEntryExports ?? []).map((entry) => ({
    exportName: entry.exportName,
    filePath: prefixRuntimePath(runtimeRepoPath, entry.filePath),
    reason: "fixture external entry export",
  })),
  externalEntryFiles: (manifest?.externalEntryFiles ?? []).map((filePath) => ({
    filePath: prefixRuntimePath(runtimeRepoPath, filePath),
    reason: "fixture external entry file",
  })),
  lawfulDynamicImports: (manifest?.lawfulDynamicImports ?? []).map((entry) => ({
    consumerFilePath: prefixRuntimePath(runtimeRepoPath, entry.consumerFilePath),
    reason: "fixture dynamic import exemption",
    targetFilePath: prefixRuntimePath(runtimeRepoPath, entry.targetFilePath),
  })),
  lawfulDynamicRegistryConsumers: (manifest?.lawfulDynamicRegistryConsumers ?? []).map((entry) => ({
    consumerFilePath: prefixRuntimePath(runtimeRepoPath, entry.consumerFilePath),
    reason: "fixture dynamic registry exemption",
    registryExportName: entry.registryExportName,
    registryFilePath: prefixRuntimePath(runtimeRepoPath, entry.registryFilePath),
  })),
  lawfulDynamicNamespaceConsumers: (manifest?.lawfulDynamicNamespaceConsumers ?? []).map((entry) => ({
    consumerFilePath: prefixRuntimePath(runtimeRepoPath, entry.consumerFilePath),
    reason: "fixture dynamic namespace exemption",
    targetFilePath: prefixRuntimePath(runtimeRepoPath, entry.targetFilePath),
  })),
  lawfulSideEffectImports: (manifest?.lawfulSideEffectImports ?? []).map((entry) => ({
    consumerFilePath: prefixRuntimePath(runtimeRepoPath, entry.consumerFilePath),
    reason: "fixture side-effect import exemption",
    targetFilePath: prefixRuntimePath(runtimeRepoPath, entry.targetFilePath),
  })),
});

const createFixtureContext = (project: Project): InspectorContext => ({
  completedReports: {},
  generatedPlan: [],
  planEntry: {
    capabilityDomain: "code-purity",
    executionGroup: "foundation",
    lawIds: LAW_IDS,
  } as InspectorContext["planEntry"],
  project,
});

const parseInventoryEvidence = (finding: { evidence?: string | undefined }): Record<string, unknown> => {
  if (!finding.evidence) {
    return {};
  }
  try {
    return JSON.parse(finding.evidence) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const hasFinding = (
  findings: ReadonlyArray<{ checkId: string; evidence?: string | undefined; filePath?: string | undefined; message: string }>,
  input: { checkId: string; fileIncludes?: string; symbolName?: string },
): boolean =>
  findings.some((finding) => {
    if (finding.checkId !== input.checkId) {
      return false;
    }
    if (input.fileIncludes && !finding.filePath?.includes(input.fileIncludes)) {
      return false;
    }
    if (input.symbolName) {
      return parseInventoryEvidence(finding).symbolName === input.symbolName;
    }
    return true;
  });

const runFixtureCase = (caseName: string) => {
  const fixtureDir = path.join(FIXTURE_ROOT, caseName);
  const runtimeDir = path.join(RUNTIME_ROOT, caseName);
  rmSync(runtimeDir, { force: true, recursive: true });
  mkdirSync(path.dirname(runtimeDir), { recursive: true });
  cpSync(fixtureDir, runtimeDir, { recursive: true });

  const runtimeRepoPath = toRepoPath(runtimeDir);
  const fixtureConfig = readFixtureConfig(caseName);
  const project = createRuntimeProject(runtimeDir);
  const governedFiles = buildFixtureGovernedFiles(project, runtimeRepoPath);
  const result = scanZombieSurfaces(
    createFixtureContext(project),
    governedFiles,
    LAW_IDS,
    {
      manifest: buildManifest(runtimeRepoPath, fixtureConfig.manifest),
      packageScripts: buildPackageScripts(fixtureConfig.entryScripts, runtimeRepoPath),
    },
  );
  const ownerBoundaryResult = scanOwnerBoundaries(governedFiles, LAW_IDS);

  return {
    governedFiles,
    result: {
      findings: [...result.findings, ...ownerBoundaryResult.findings],
    },
    runtimeRepoPath,
  };
};

const assertHasFinding = (
  caseName: string,
  input: { checkId: string; fileIncludes?: string; symbolName?: string },
): void => {
  const { result } = runFixtureCase(caseName);
  assert.equal(
    hasFinding(result.findings, input),
    true,
    `${caseName} should emit ${input.checkId}${input.symbolName ? ` for ${input.symbolName}` : ""}.`,
  );
};

const assertNoFinding = (
  caseName: string,
  input: { checkId: string; fileIncludes?: string; symbolName?: string },
): void => {
  const { result } = runFixtureCase(caseName);
  assert.equal(
    hasFinding(result.findings, input),
    false,
    `${caseName} should not emit ${input.checkId}${input.symbolName ? ` for ${input.symbolName}` : ""}.`,
  );
};

assertHasFinding("zombie-file", {
  checkId: "code-purity/zombie-file",
  fileIncludes: "/zombie-file/src/orphan.ts",
});
assertHasFinding("zombie-export", {
  checkId: "code-purity/zombie-export",
  symbolName: "unused",
});
assertHasFinding("namespace-property-usage", {
  checkId: "code-purity/zombie-export",
  symbolName: "unused",
});
assertHasFinding("namespace-dynamic-evasion", {
  checkId: "code-purity/namespace-dynamic-usage",
});
assertHasFinding("reexport-barrel-laundering", {
  checkId: "code-purity/zombie-export",
  symbolName: "unused",
});
assertHasFinding("reexport-barrel-laundering", {
  checkId: "code-purity/barrel-reexport-laundering",
  symbolName: "unused",
});
assertHasFinding("type-only-runtime-separation", {
  checkId: "code-purity/zombie-export",
  symbolName: "Foo",
});
assertNoFinding("default-import-alias", {
  checkId: "code-purity/zombie-export",
  symbolName: "default",
});
assertNoFinding("named-import-alias", {
  checkId: "code-purity/zombie-export",
  symbolName: "foo",
});
assertHasFinding("orphan-top-level-declaration", {
  checkId: "code-purity/zombie-top-level-declaration",
  symbolName: "dead",
});
assertHasFinding("dead-export-internal-helper", {
  checkId: "code-purity/dead-export-helper-subgraph",
  symbolName: "deadHelper",
});
assertHasFinding("reachable-file-dead-internal-subgraph", {
  checkId: "code-purity/dead-internal-declaration-subgraph",
  symbolName: "deadHelper",
});
assertHasFinding("dead-export-nested-helper-chain", {
  checkId: "code-purity/dead-export-helper-subgraph",
  symbolName: "deadHelper",
});
assertHasFinding("dead-export-nested-helper-chain", {
  checkId: "code-purity/dead-internal-declaration-subgraph",
  symbolName: "deadLeaf",
});
assertHasFinding("dead-class-used-only-by-dead-export", {
  checkId: "code-purity/dead-export-helper-subgraph",
  symbolName: "DeadClass",
});
assertHasFinding("dead-type-used-only-by-dead-type-export", {
  checkId: "code-purity/dead-export-helper-subgraph",
  symbolName: "DeadShape",
});
assertHasFinding("handler-map-unused-entry", {
  checkId: "code-purity/handler-map-unused-entry",
  symbolName: "oldFlow",
});
assertHasFinding("object-bag-unused-property", {
  checkId: "code-purity/object-bag-unused-property",
  symbolName: "oldFlow",
});
assertHasFinding("object-bag-dynamic-usage", {
  checkId: "code-purity/object-bag-dynamic-usage",
});
assertHasFinding("registry-bag-laundering", {
  checkId: "code-purity/registry-bag-laundering",
});
assertNoFinding("lawful-dynamic-registry-consumer", {
  checkId: "code-purity/registry-bag-laundering",
});
assertNoFinding("lawful-dynamic-registry-consumer", {
  checkId: "code-purity/object-bag-unused-property",
});
assertHasFinding("identifier-count-false-proof", {
  checkId: "code-purity/zombie-top-level-declaration",
  symbolName: "dead",
});
assertHasFinding("const-folded-dead-branch", {
  checkId: "code-purity/zombie-dead-branch",
});
assertHasFinding("literal-mode-dead-branch", {
  checkId: "code-purity/zombie-dead-branch",
});
assertHasFinding("commented-out-code", {
  checkId: "code-purity/commented-out-executable-code",
});
assertNoFinding("lawful-manifest-entry", {
  checkId: "code-purity/zombie-file",
});
assertNoFinding("lawful-manifest-entry", {
  checkId: "code-purity/zombie-export",
});
assertHasFinding("side-effect-import-laundering", {
  checkId: "code-purity/side-effect-import-without-manifest",
});
assertNoFinding("lawful-side-effect-import", {
  checkId: "code-purity/side-effect-import-without-manifest",
});
assertNoFinding("lawful-side-effect-import", {
  checkId: "code-purity/zombie-file",
  fileIncludes: "/lawful-side-effect-import/src/side-effect.ts",
});
assertHasFinding("dynamic-import-nonliteral", {
  checkId: "code-purity/dynamic-import-nonliteral",
});
assertHasFinding("dynamic-import-owner-boundary-violation", {
  checkId: "code-purity/plugin-non-facade-capability-import",
});
assertNoFinding("dynamic-import-owner-boundary-violation", {
  checkId: "code-purity/dynamic-import-without-manifest",
});
assertHasFinding("side-effect-import-owner-boundary-violation", {
  checkId: "code-purity/plugin-non-facade-capability-import",
});
assertNoFinding("side-effect-import-owner-boundary-violation", {
  checkId: "code-purity/side-effect-import-without-manifest",
});

const zombieChainResult = runFixtureCase("zombie-to-zombie-chain").result;
const zombieChainCount = zombieChainResult.findings.filter((finding) => finding.checkId === "code-purity/zombie-file").length;
assert.equal(zombieChainCount >= 3, true, "zombie-to-zombie-chain should flag the unreachable import chain as zombie files.");

rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("code-purity-zombie-deep-acceptance-ok");