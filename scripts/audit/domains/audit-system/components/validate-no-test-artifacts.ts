import path from "node:path";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { fileExists, listFilesRecursive, readJsonFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const FORBIDDEN_TEST_DIRS = ["tests", "__tests__"];
const FORBIDDEN_TEST_PATTERN = /(?:^|\/)(?:__tests__|tests)\//;
const FORBIDDEN_TEST_FILE_PATTERN = /(?:^|\/)[^/]+\.(?:test|spec)\.[^.\/]+$/;
const FORBIDDEN_SCRIPT_NAMES = ["test", "test:unit", "test:integration", "test:e2e"];

const collectForbiddenTestDirectoryFindings = async (
  allRepoFiles: string[],
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const forbiddenDir of FORBIDDEN_TEST_DIRS) {
    const forbiddenDirPath = pathFromRepoRoot(forbiddenDir);
    if (
      !(await fileExists(forbiddenDirPath))
      && !allRepoFiles.some((filePath) => filePath.startsWith(`${forbiddenDirPath}${path.sep}`))
    ) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: forbiddenDir,
        line: 1,
        severity: "fatal",
        message: "Audit authority forbids repository test directories; quality truth must stay inside scripts/audit.",
      }),
    );
  }

  return findings;
};

const collectForbiddenTestFileFindings = (
  context: InspectorContext,
  allRepoFiles: string[],
): Finding[] => {
  const findings: Finding[] = [];

  for (const filePath of allRepoFiles) {
    const relativePath = path.relative(context.repoRoot, filePath).replace(/\\/g, "/");
    if (!FORBIDDEN_TEST_PATTERN.test(relativePath) && !FORBIDDEN_TEST_FILE_PATTERN.test(relativePath)) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativePath,
        line: 1,
        severity: "fatal",
        message: "Audit authority forbids repository test files and mock-first quality paths.",
      }),
    );
  }

  return findings;
};

const collectForbiddenScriptFindings = (
  packageJson: { scripts?: Record<string, string> },
): Finding[] => {
  const findings: Finding[] = [];

  for (const scriptName of FORBIDDEN_SCRIPT_NAMES) {
    if (!packageJson.scripts?.[scriptName]) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: "package.json",
        line: 1,
        severity: "fatal",
        message: `package.json must not expose ${scriptName}; audit is the only quality gate authority.`,
      }),
    );
  }

  const forbiddenScriptBodies = ["npm run test", "npm test", "tsx --test"];
  for (const [scriptName, scriptBody] of Object.entries(packageJson.scripts ?? {})) {
    if (!forbiddenScriptBodies.some((marker) => scriptBody.includes(marker))) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: "package.json",
        line: 1,
        severity: "fatal",
        message: `package.json script ${scriptName} must not depend on test-file execution as a quality gate.`,
      }),
    );
  }

  return findings;
};

const createNoTestArtifactsPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "audit-quality-authority",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Audit system remains the only repository quality gate authority."
      : "Repository test files or npm test-based quality gates were found.",
  );

export const validateNoTestArtifacts = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const allRepoFiles = await listFilesRecursive(context.repoRoot, {
    ignoreDirs: [".grasseye-data"],
  });
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));
  const findings = [
    ...(await collectForbiddenTestDirectoryFindings(allRepoFiles)),
    ...collectForbiddenTestFileFindings(context, allRepoFiles),
    ...collectForbiddenScriptFindings(packageJson),
  ];

  return {
    findings,
    phases: [createNoTestArtifactsPhase(findings)],
  };
};