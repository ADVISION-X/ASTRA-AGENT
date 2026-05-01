import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";
import { localBrowserSessionInspectionUtils as utils } from "./inspection-utils.js";

const { CONTROLLER_PATH, FORBIDDEN_ENV_KEYS, GITIGNORE_PATH, LAW_ID } = config;
const { debug, hasForbiddenApiUsage, hasForbiddenModuleReference, hasScriptExtension, isForbiddenTestPath } = utils;

const REMOVED_CONTROLLER_FILE_NAME = ["playwright", "browser", "controller.ts"].join("-");
const GOVERNED_ROOTS = ["src/lib/browser/", "src/lib/local-runtime/", ["src", "features", "platform-action/"].join("/")];

const getRepoBoundaryPassed = (repoFiles: string[], gitignore: string, forbiddenTests: string[], committedProfiles: string[]): boolean => {
  return forbiddenTests.length === 0
    && committedProfiles.length === 0
    && !repoFiles.includes(`src/lib/browser/${REMOVED_CONTROLLER_FILE_NAME}`)
    && gitignore.includes(".grasseye-local/browser-profiles/");
};

const getAstBoundaryPassed = (findings: Finding[]): boolean => {
  return !findings.some((finding) => finding.message.includes("removed downgrade browser path") || finding.message.includes("forbidden persistence or downgrade APIs"));
};

const pushRepositoryArtifactFindings = (
  findings: Finding[],
  repoFiles: string[],
  gitignore: string,
  removedControllerPath: string,
): { forbiddenTests: string[]; committedProfiles: string[] } => {
  if (repoFiles.includes(removedControllerPath)) {
    findings.push(createFinding({ lawId: LAW_ID, file: removedControllerPath, line: 1, severity: "fatal", message: "The removed Playwright downgrade browser controller must remain physically absent from repository truth." }));
  }
  if (!gitignore.includes(".grasseye-local/browser-profiles/")) {
    findings.push(createFinding({ lawId: LAW_ID, file: GITIGNORE_PATH, line: 1, severity: "fatal", message: ".gitignore must exclude .grasseye-local/browser-profiles/." }));
  }

  const forbiddenTests = repoFiles.filter((file) => hasScriptExtension(file) && isForbiddenTestPath(file));
  if (forbiddenTests.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Local browser session enforcement forbids repository test artifacts." }));
  }

  const committedProfiles = repoFiles.filter((file) => file.startsWith(".grasseye-local/browser-profiles/"));
  if (committedProfiles.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: committedProfiles[0] ?? ".grasseye-local/browser-profiles", line: 1, severity: "fatal", message: "Browser profile directories must not be committed into repository truth." }));
  }

  return { forbiddenTests, committedProfiles };
};

const inspectGovernedRootFile = (findings: Finding[], filePath: string, project: ReturnType<typeof getAuditProject>): void => {
  const sourceFile = project.getSourceFile(pathFromRepoRoot(filePath));
  if (!sourceFile) {
    findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: 1, severity: "error", message: "Governed browser-session code must stay inside the ts-morph audit project; detached files are not enforceable." }));
    return;
  }

  const forbiddenModuleReference = hasForbiddenModuleReference(sourceFile);
  if (forbiddenModuleReference) {
    findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: forbiddenModuleReference.line, severity: "fatal", message: `Governed browser session code must not reintroduce the removed downgrade browser path: ${forbiddenModuleReference.detail}.` }));
    return;
  }

  const forbiddenApiUsage = hasForbiddenApiUsage(sourceFile);
  if (forbiddenApiUsage) {
    findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: forbiddenApiUsage.line, severity: "fatal", message: `Governed browser session code must not use forbidden persistence or downgrade APIs: ${forbiddenApiUsage.detail}.` }));
  }

  for (const forbiddenEnvKey of FORBIDDEN_ENV_KEYS) {
    if (filePath !== CONTROLLER_PATH && sourceFile.getFullText().includes(forbiddenEnvKey)) {
      findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: 1, severity: "fatal", message: `Governed browser session code must not reference ${forbiddenEnvKey}.` }));
    }
  }
};

const scanGovernedRootFiles = (findings: Finding[], repoFiles: string[], project: ReturnType<typeof getAuditProject>): void => {
  for (const filePath of repoFiles) {
    if (hasScriptExtension(filePath) && GOVERNED_ROOTS.some((root) => filePath.startsWith(root))) {
      inspectGovernedRootFile(findings, filePath, project);
    }
  }
};

export async function runLocalBrowserSessionBoundaryChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [gitignore, repoFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(GITIGNORE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data"] }),
  ]);
  const findings: Finding[] = [];
  const project = getAuditProject();

  const removedControllerPath = `src/lib/browser/${REMOVED_CONTROLLER_FILE_NAME}`;
  const { forbiddenTests, committedProfiles } = pushRepositoryArtifactFindings(findings, repoFiles, gitignore, removedControllerPath);
  scanGovernedRootFiles(findings, repoFiles, project);

  debug("completed exclusionary AST scan across local-browser-session governed roots");

  const repoBoundaryPassed = getRepoBoundaryPassed(repoFiles, gitignore, forbiddenTests, committedProfiles);
  const astBoundaryPassed = getAstBoundaryPassed(findings);
  return {
    findings,
    phases: [
      createPhase("local-browser-session-exclusionary-ast-guard", astBoundaryPassed ? "PASS" : "FAKE ENFORCEMENT", astBoundaryPassed, astBoundaryPassed ? "Governed browser session code blocks Playwright downgrade paths, cookie persistence APIs, and forbidden env threading through AST-level checks." : "Governed browser session code still allows a removed downgrade path or forbidden persistence API."),
      createPhase("local-browser-session-repo-boundary", repoBoundaryPassed ? "PASS" : "CODE VIOLATION", repoBoundaryPassed, repoBoundaryPassed ? "Repository excludes test artifacts, committed browser profiles, and the removed Playwright browser controller file." : "Repository still allows forbidden browser session artifacts or deleted downgrade code."),
    ],
  };
}
