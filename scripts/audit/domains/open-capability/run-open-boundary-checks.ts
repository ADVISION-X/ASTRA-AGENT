import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasAnyKeyword, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  FORBIDDEN_EXTERNAL_IMPORTS,
  FORBIDDEN_IMPORT_MARKERS,
  INDEX_PATH,
  LAW_BOUNDARY,
  LAW_LOCAL_PROGRAM,
  LAW_PACKAGE_SHAPE,
  LAW_PRIVATE_LEAK,
  LAW_RUNTIME_GOVERNANCE,
  OPEN_ROOT,
  WORKBENCH_PATH,
} = openInspectionConstants;
const {
  getOpenSourceOrThrow,
  getOpenSources,
  hasCommentDirective,
  hasDynamicImport,
  hasForbiddenResolvedImport,
  hasRequireCall,
  hasUnknownAsChain,
  resolveModuleSourcePath,
} = openInspectionUtils;

type OpenBoundaryCheckResult = {
  boundaryFindings: Finding[];
  antiEscapeFindings: Finding[];
};

const collectBoundaryFindings = (project: import("ts-morph").Project): Finding[] =>
  collectOpenImportBoundaryFindings(project)
    .concat(collectOpenPublicSurfaceFindings(project))
    .concat(collectLocalProgramBoundaryFindings(project))
    .concat(collectMapEscapeFindings(project))
    .concat(collectBuiltinJsonBoundaryFindings());

const isPrivateOpenLeak = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  return !repoPath.startsWith(`${OPEN_ROOT}/`)
    && !repoPath.startsWith("scripts/audit/")
    && sourceFile.getImportDeclarations().some((declaration) => {
      const target = resolveModuleSourcePath(declaration);
      return target !== null && FORBIDDEN_EXTERNAL_IMPORTS.some((marker) => target.includes(marker));
    });
};

const collectOpenImportBoundaryFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const forbiddenImportFile = getOpenSources(project).find((sourceFile) =>
    FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)) || hasForbiddenResolvedImport(sourceFile));
  const privateLeakFile = project.getSourceFiles().find((sourceFile) => isPrivateOpenLeak(sourceFile));
  if (forbiddenImportFile) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Open root must not import AI, Screenshot, Mouse, Scroll, Geometry, or Forensics implementations." }));
  }
  if (privateLeakFile) {
    findings.push(createFinding({ lawId: LAW_PRIVATE_LEAK, file: toRepoRelativePath(privateLeakFile.getFilePath()), line: 1, severity: "fatal", message: "External modules must not import Open children, runtime internals, or mutable registry paths." }));
  }
  return findings;
};

const collectOpenPublicSurfaceFindings = (project: import("ts-morph").Project): Finding[] => {
  const workbenchSource = getOpenSourceOrThrow(project, WORKBENCH_PATH);
  const indexSource = getOpenSourceOrThrow(project, INDEX_PATH);
  const findings: Finding[] = [];
  if (!workbenchSource.getImportDeclarations().some((declaration) => resolveModuleSourcePath(declaration) === `${OPEN_ROOT}/index.ts`)) {
    findings.push(createFinding({ lawId: LAW_BOUNDARY, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose Open through the public index only." }));
  }
  if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
    findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: INDEX_PATH, line: 1, severity: "fatal", message: "Open public index must not use export-star barrels." }));
  }
  if (indexSource.getExportDeclarations().some((declaration) => declaration.getNamedExports().some((specifier) => specifier.getName() === "listOpenChildren"))) {
    findings.push(createFinding({ lawId: LAW_BOUNDARY, file: INDEX_PATH, line: 1, severity: "fatal", message: "Open public index must not leak child-registry listing helpers." }));
  }
  return findings;
};

const collectLocalProgramBoundaryFindings = (project: import("ts-morph").Project): Finding[] => {
  const localProgramChildPath = `${OPEN_ROOT}/children/open-local-program/implementation.ts`;
  const localProgramChildSource = getOpenSourceOrThrow(project, localProgramChildPath);
  const findings: Finding[] = [];
  if (localProgramChildSource.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes("open-browser-port"))) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: localProgramChildPath, line: 1, severity: "fatal", message: "open-local-program must not import OpenBrowserPort as the local program execution channel." }));
  }
  if (["child_process", "node:child_process"].some((specifier) => hasImportModuleSpecifier(localProgramChildSource, specifier)) || localProgramChildSource.getText().includes("osascript")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: localProgramChildPath, line: 1, severity: "fatal", message: "open-local-program child must not shell out or run AppleScript directly." }));
  }
  return findings;
};

const collectMapEscapeFindings = (project: import("ts-morph").Project): Finding[] => {
  return project.getSourceFiles().flatMap((sourceFile) => collectSourceEscapeFindings(sourceFile));
};

const collectSourceEscapeFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] =>
  collectMapSourceEscapeFindings(sourceFile);

const collectMapSourceEscapeFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  const text = sourceFile.getText();
  return repoPath.startsWith("src/map-plugins/") && text.includes('"open-local-workbench"') && text.includes('"local-program"')
    ? [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: repoPath, line: 1, severity: "fatal", message: "Map packages must not use open-local-workbench for targetKind=local-program." })]
    : [];
};

const collectBuiltinJsonBoundaryFindings = (): Finding[] => {
  const findings: Finding[] = [];
  for (const fileName of readdirSync("src/map-plugins/builtins").filter((file) => file.endsWith(".json"))) {
    const filePath = join("src/map-plugins/builtins", fileName);
    const text = readFileSync(filePath, "utf8");
    if (text.includes('"childCapabilityId": "open-local-workbench"') && text.includes('"targetKind": "local-program"')) {
      findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: filePath, line: 1, severity: "fatal", message: "Builtin map packages must not use open-local-workbench for targetKind=local-program." }));
    }
  }
  return findings;
};
const collectAntiEscapeFindings = (project: import("ts-morph").Project): Finding[] => {
  const antiEscapeFile = getOpenSources(project).find((sourceFile) => {
    return hasAnyKeyword(sourceFile)
      || hasUnknownAsChain(sourceFile)
      || hasCommentDirective(sourceFile)
      || hasDynamicImport(sourceFile)
      || hasRequireCall(sourceFile);
  });

  return antiEscapeFile
    ? [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: toRepoRelativePath(antiEscapeFile.getFilePath()), line: 1, severity: "fatal", message: "Open root must not use any, unknown-as chains, comment directives, dynamic import, or require." })]
    : [];
};

export function runOpenBoundaryChecks(project: import("ts-morph").Project): OpenBoundaryCheckResult {
  return {
    boundaryFindings: collectBoundaryFindings(project),
    antiEscapeFindings: collectAntiEscapeFindings(project),
  };
}
