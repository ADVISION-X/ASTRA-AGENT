import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const { INSPECTOR_PATH, LAW_BOUNDARY, LAW_ENFORCEMENT, ROOT } = forensicsPersistenceInspectionConstants;
const {
  hasCommentDirective,
  hasDynamicImportOrRequire,
  hasForbiddenCast,
  pathHasForbiddenSegment,
  sourceUsesAnyKeyword,
  sourceUsesForbiddenImports,
} = forensicsPersistenceInspectionUtils;

const getForensicsSources = (project: import("ts-morph").Project) => {
  return project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`));
};

const collectBoundaryFinding = (project: import("ts-morph").Project): Finding[] => {
  const boundaryViolation = getForensicsSources(project).find((sourceFile) => sourceUsesForbiddenImports(sourceFile));
  return boundaryViolation
    ? [createFinding({ lawId: LAW_BOUNDARY, file: toRepoRelativePath(boundaryViolation.getFilePath()), line: 1, severity: "fatal", message: "Forensics Persistence cannot import AI, browser, screenshot, mouse, page-state, or geometry capability internals." })]
    : [];
};

const collectAntiEscapeFinding = (project: import("ts-morph").Project): Finding[] => {
  const antiEscapeViolation = getForensicsSources(project).find((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    return hasCommentDirective(sourceFile)
      || hasDynamicImportOrRequire(sourceFile)
      || hasForbiddenCast(sourceFile)
      || sourceUsesAnyKeyword(sourceFile)
      || pathHasForbiddenSegment(relativePath);
  });
  const inspectorSource = getSourceFileOrThrow(project, INSPECTOR_PATH);
  const inspectorViolation = hasCommentDirective(inspectorSource)
    || hasDynamicImportOrRequire(inspectorSource)
    || hasForbiddenCast(inspectorSource);

  return antiEscapeViolation || inspectorViolation
    ? [createFinding({ lawId: LAW_ENFORCEMENT, file: antiEscapeViolation ? toRepoRelativePath(antiEscapeViolation.getFilePath()) : INSPECTOR_PATH, line: 1, severity: "fatal", message: "Forensics capability or its inspector still exposes anti-escape loopholes." })]
    : [];
};

export function runForensicsBoundaryChecks(project: import("ts-morph").Project): Finding[] {
  return [...collectBoundaryFinding(project), ...collectAntiEscapeFinding(project)];
}