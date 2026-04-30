import { fileExists, listFilesRecursive, listImmediateDirectories, listImmediateFiles } from "../../../core/filesystem.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { getNodeLine, toRelativeSourcePath } from "../../../core/ts-morph.js";
import type { Project } from "ts-morph";

import { codeTopologyShared } from "./topology-shared.js";

const {
  ALLOWED_FEATURE_DIRS,
  ALLOWED_LIB_DIRS,
  ALLOWED_SRC_DIRS,
  FORBIDDEN_FUTURE_DIRS,
  FORBIDDEN_PLATFORM_ROOTS,
  FORBIDDEN_STARTUP_FILENAMES,
  ILLEGAL_LOCAL_RUNTIME_EXECUTION_FILES,
  LAW_ID_001,
  LAW_ID_003,
  STARTUP_ENTRY_PATH,
  STARTUP_HELPER_PATHS,
  createDetail,
  isForbiddenTargetPath,
  path,
  resolveImportTarget,
} = codeTopologyShared;

export async function inspectSourceBoundaryTopology(context: InspectorContext, project: Project): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const sourceTopologyFindings = await collectSourceTopologyFindings(context, project);
  const routeBoundaryFindings = collectRouteBoundaryFindings(project);
  const domainBoundaryFindings = collectDomainBoundaryFindings(project);

  return {
    findings: [...sourceTopologyFindings, ...routeBoundaryFindings, ...domainBoundaryFindings],
    phases: [
      createPhase(
        "source-topology",
        sourceTopologyFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        sourceTopologyFindings.length === 0,
        sourceTopologyFindings.length === 0
          ? "Canonical src, docs, and startup directories stay within the governed topology."
          : "Canonical src, docs, or startup directory topology drift was found.",
      ),
      createPhase(
        "route-boundary",
        routeBoundaryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        routeBoundaryFindings.length === 0,
        routeBoundaryFindings.length === 0
          ? "Route entry stays off browser automation, platform adapter, local AI, and data-store truth imports."
          : "Route entry imported forbidden browser, adapter, AI, or data-store ownership.",
      ),
      createPhase(
        "domain-boundary",
        domainBoundaryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        domainBoundaryFindings.length === 0,
        domainBoundaryFindings.length === 0
          ? "Domain-neutral browser infrastructure and restricted feature domains stay on canonical ownership boundaries."
          : "Platform or browser ownership leaked across canonical domain boundaries.",
      ),
    ],
  };
}

async function collectSourceTopologyFindings(context: InspectorContext, project: Project): Promise<Finding[]> {
  return [
    ...await collectTopLevelSrcFindings(),
    ...await collectFeatureRootFindings(),
    ...await collectLibTopologyFindings(),
    ...await collectIllegalRuntimeSliceFindings(project),
    ...await collectStartupTopologyFindings(),
  ];
}

async function collectTopLevelSrcFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const srcDirNames = (await listImmediateDirectories(pathFromRepoRoot("src"))).map((dirPath) => path.basename(dirPath));
  for (const srcDirName of srcDirNames) {
    if (!ALLOWED_SRC_DIRS.has(srcDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `src/${srcDirName}`, line: 1, severity: "error", message: "Unexpected top-level src directory violates canonical ownership." }));
    }
    if (FORBIDDEN_PLATFORM_ROOTS.has(srcDirName) || FORBIDDEN_FUTURE_DIRS.has(srcDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `src/${srcDirName}`, line: 1, severity: "fatal", message: "Forbidden platform or future-capability root bucket found under src." }));
    }
  }
  return findings;
}

async function collectFeatureRootFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const featuresRoot = pathFromRepoRoot("src/features");
  const featureDirectories = (await fileExists(featuresRoot)) ? await listImmediateDirectories(featuresRoot) : [];
  for (const featureDirName of featureDirectories.map((dirPath) => path.basename(dirPath))) {
    if (featureDirName === "local-data" || featureDirName === "platform-action") {
      findings.push(createFinding({ lawId: LAW_ID_003, file: `src/features/${featureDirName}`, line: 1, severity: "fatal", message: "Retired feature root still exists and must be physically removed." }));
      continue;
    }
    if (!ALLOWED_FEATURE_DIRS.has(featureDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `src/features/${featureDirName}`, line: 1, severity: "error", message: "Unexpected feature domain folder found under src/features." }));
    }
    if (FORBIDDEN_PLATFORM_ROOTS.has(featureDirName) || FORBIDDEN_FUTURE_DIRS.has(featureDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `src/features/${featureDirName}`, line: 1, severity: "fatal", message: "Forbidden platform or future-capability feature folder found." }));
    }
  }
  return findings;
}

async function collectLibTopologyFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const libDirNames = (await listImmediateDirectories(pathFromRepoRoot("src/lib"))).map((dirPath) => path.basename(dirPath));
  for (const libDirName of libDirNames) {
    if (!ALLOWED_LIB_DIRS.has(libDirName)) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `src/lib/${libDirName}`, line: 1, severity: "error", message: "Unexpected shared infrastructure folder found under src/lib." }));
    }
  }
  return findings;
}

async function collectIllegalRuntimeSliceFindings(project: Project): Promise<Finding[]> {
  const findings: Finding[] = [];
  const illegalMissionRuntimeFiles = (await listFilesRecursive(pathFromRepoRoot("src/lib/local-runtime"), { extensions: [".ts"] }))
    .map((filePath) => toRelativeSourcePath(project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath)))
    .filter((relativePath) => ILLEGAL_LOCAL_RUNTIME_EXECUTION_FILES.has(path.basename(relativePath)));
  for (const illegalMissionRuntimeFile of illegalMissionRuntimeFiles) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: illegalMissionRuntimeFile, line: 1, severity: "fatal", message: "Illegal shell-side runtime execution slice found under src/lib/local-runtime; this file must be physically removed." }));
  }
  return findings;
}

async function collectStartupTopologyFindings(): Promise<Finding[]> {
  return [
    ...await collectScatteredStartupEntrypointFindings(),
    ...await collectMissingStartupPathFindings(),
  ];
}

async function collectScatteredStartupEntrypointFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const scriptRootFiles = (await listImmediateFiles(pathFromRepoRoot("scripts"))).map((filePath) => path.basename(filePath));
  for (const fileName of scriptRootFiles) {
    if (fileName !== ".DS_Store" && (FORBIDDEN_STARTUP_FILENAMES.has(fileName) || fileName.startsWith("start") || fileName.startsWith("launch") || fileName.startsWith("run"))) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: `scripts/${fileName}`, line: 1, severity: "error", message: "Startup entrypoint exists outside scripts/startup." }));
    }
  }
  return findings;
}

async function collectMissingStartupPathFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const requiredPath of [STARTUP_ENTRY_PATH, ...STARTUP_HELPER_PATHS]) {
    if (!(await fileExists(pathFromRepoRoot(requiredPath)))) {
      findings.push(createFinding({ lawId: LAW_ID_001, file: requiredPath, line: 1, severity: "error", message: "Governed startup path is missing a required script file." }));
    }
  }
  return findings;
}

function collectRouteBoundaryFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const forbiddenAppImportPrefixes = ["src/lib/browser/", "src/lib/local-ai/", "src/lib/storage/", "src/features/" + "platform-action/", "src/features/" + "local-data/"];
  for (const appFile of project.getSourceFiles().filter((sourceFile) => toRelativeSourcePath(sourceFile).startsWith("src/app/"))) {
    for (const importDeclaration of appFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, forbiddenAppImportPrefixes)) {
        continue;
      }
      findings.push(createFinding({ lawId: LAW_ID_001, file: toRelativeSourcePath(appFile), line: getNodeLine(importDeclaration), severity: "error", message: "Route entry must not directly import browser automation, local AI, platform adapter, or data-store truth.", ...createDetail(targetPath) }));
    }
  }
  return findings;
}

function collectDomainBoundaryFindings(project: Project): Finding[] {
  return [
    ...collectBrowserBoundaryFindings(project),
    ...collectRestrictedFeatureBoundaryFindings(project),
  ];
}

function collectBrowserBoundaryFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const browserFile of project.getSourceFiles().filter((sourceFile) => toRelativeSourcePath(sourceFile).startsWith("src/lib/browser/"))) {
    for (const importDeclaration of browserFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, ["src/features/", "src/app/"])) {
        continue;
      }
      findings.push(createFinding({ lawId: LAW_ID_001, file: toRelativeSourcePath(browserFile), line: getNodeLine(importDeclaration), severity: "error", message: "src/lib/browser must remain domain-neutral and may not import app or feature owners.", ...createDetail(targetPath) }));
    }
  }
  return findings;
}

function collectRestrictedFeatureBoundaryFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const restrictedFeaturePrefixes = [
    "src/lib/local-runtime/runtime-executor",
    "src/lib/local-runtime/runtime-bootstrap",
    "src/lib/local-runtime/runtime-state",
    "src/lib/local-runtime/runtime-step-support",
    "src/features/vision/",
    "src/features/comments/",
    "src/features/product-signal/",
    "src/features/" + "local-data/",
  ];
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!restrictedFeaturePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
      if (!isForbiddenTargetPath(targetPath, ["src/features/" + "platform-action/"])) {
        continue;
      }
      findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(importDeclaration), severity: "error", message: "Platform-specific adapter imports must not leak into restricted feature domains.", ...createDetail(targetPath) }));
    }
  }
  return findings;
}