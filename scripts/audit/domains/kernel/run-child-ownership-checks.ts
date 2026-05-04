import path from "node:path";

import { listImmediateDirectories, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

const {
  ACTIVE_ABILITY_GROUPS,
  CAPABILITY_ROOT,
  REQUIREMENT_ID_002,
} = kernelInspectionConstants;

const collectNestedChildrenRoots = async (rootRelativePath: string): Promise<string[]> => {
  const absoluteRoot = pathFromRepoRoot(rootRelativePath);
  const results: string[] = [];

  const walk = async (absolutePath: string): Promise<void> => {
    const directories = await listImmediateDirectories(absolutePath);
    for (const directory of directories) {
      const relativePath = toRepoRelativePath(directory);
      if (path.basename(directory) === "children") {
        results.push(relativePath);
      }
      await walk(directory);
    }
  };

  await walk(absoluteRoot);
  return results.sort();
};

const collectExpectedChildrenRoots = (): string[] => {
  return ACTIVE_ABILITY_GROUPS.map((abilityGroupId) => `${CAPABILITY_ROOT}/${abilityGroupId}/children`).sort();
};

const collectListDiffDetails = (actual: readonly string[], expected: readonly string[]): string[] => {
  const details: string[] = [];
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  if (missing.length > 0) {
    details.push(`missing: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    details.push(`unexpected: ${unexpected.join(", ")}`);
  }
  return details;
};

const collectChildCapabilityIds = async (): Promise<string[]> => {
  const childIds = new Set<string>();

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const childrenRoot = pathFromRepoRoot(`${CAPABILITY_ROOT}/${abilityGroupId}/children`);
    const childDirectories = await listImmediateDirectories(childrenRoot);
    for (const childDirectory of childDirectories) {
      childIds.add(path.basename(childDirectory));
    }
  }

  return [...childIds].sort();
};

export async function runChildOwnershipChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings: Finding[] = [];
  const childrenRoots = await collectNestedChildrenRoots("src");
  const expectedChildrenRoots = collectExpectedChildrenRoots();
  const childrenRootDetails = collectListDiffDetails(childrenRoots, expectedChildrenRoots);
  if (childrenRootDetails.length > 0) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_002,
      file: "src",
      line: 1,
      severity: "fatal",
      message: `Children roots must live only under src/capabilities/<ability-group>/children. Details: ${childrenRootDetails.join("; ")}`,
    }));
  }

  const childCapabilityIds = await collectChildCapabilityIds();
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const childAuditEntryViolations = Object.keys(packageJson.scripts ?? {})
    .filter((scriptName) => scriptName.startsWith("audit:"))
    .filter((scriptName) => childCapabilityIds.includes(scriptName.slice("audit:".length)));
  for (const scriptName of childAuditEntryViolations) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_002,
      file: "package.json",
      line: 1,
      severity: "fatal",
      message: `package.json must not expose ${scriptName}; child abilities may exist only under one parent ability group.`,
    }));
  }

  return {
    findings,
    phases: [
      createPhase(
        "child-root-placement",
        childrenRootDetails.length === 0 ? "PASS" : "CODE VIOLATION",
        childrenRootDetails.length === 0,
        childrenRootDetails.length === 0
          ? "Every children root stays under exactly one active ability-group root."
          : "Some children roots escaped the active ability-group parent boundary.",
      ),
      createPhase(
        "child-audit-entrypoints",
        childAuditEntryViolations.length === 0 ? "PASS" : "CODE VIOLATION",
        childAuditEntryViolations.length === 0,
        childAuditEntryViolations.length === 0
          ? "No child capability is exposed as an independent audit owner."
          : "A child capability is exposed as an independent audit owner.",
      ),
    ],
  };
}