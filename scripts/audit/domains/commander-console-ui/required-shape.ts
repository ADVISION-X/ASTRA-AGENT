import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_LAW_ID,
  LEGACY_FILE_PATHS,
  LAW_ID,
  PAGE_RENDER_PATH,
  REQUIRED_CLIENT_ROUTE_MARKERS,
  REQUIRED_FILE_EXPORTS,
  REQUIRED_HANDLER_NAMES,
  REQUIRED_PRIMARY_PAGES,
  REQUIRED_VIEW_MODEL_PROPERTIES,
  SHELL_CLIENT_PATH,
  TYPES_PATH,
  VIEW_MODEL_PATH,
  createCommanderConsoleUiProject,
  getExportedNames,
  getInterfaceMethodNames,
  getObjectArrayLength,
  getTypeAliasPropertyNames,
  getUiSourceFile,
  getUnionLiteralValues,
  hasImportModuleSpecifier,
  hasLiteralFragment,
  pathExists,
} from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleUiProject();
  const findings: Finding[] = [];

  for (const required of REQUIRED_FILE_EXPORTS) {
    if (!(await pathExists(required.path))) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: required.path,
        line: 1,
        severity: "fatal",
        message: "Required commander-console-ui file is missing.",
        detail: required.exportName,
      }));
      continue;
    }

    const sourceFile = getUiSourceFile(project, required.path);
    if (!getExportedNames(sourceFile).has(required.exportName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: required.path,
        line: 1,
        severity: "error",
        message: "Required commander-console-ui export is missing.",
        detail: required.exportName,
      }));
    }
  }

  const typesSource = getUiSourceFile(project, TYPES_PATH);
  const primaryPages = new Set(getUnionLiteralValues(typesSource, "CommanderConsolePrimaryPageId"));
  for (const pageId of REQUIRED_PRIMARY_PAGES) {
    if (!primaryPages.has(pageId)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: "Primary page union is missing a required Commander page id.",
        detail: pageId,
      }));
    }
  }

  const handlerMethods = getInterfaceMethodNames(typesSource, "CommanderConsolePublicHandlers");
  for (const handlerName of REQUIRED_HANDLER_NAMES) {
    if (!handlerMethods.has(handlerName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: "Public handler interface is missing a required handler.",
        detail: handlerName,
      }));
    }
  }

  const viewModelProperties = getTypeAliasPropertyNames(typesSource, "CommanderConsoleViewModel");
  for (const propertyName of REQUIRED_VIEW_MODEL_PROPERTIES) {
    if (!viewModelProperties.has(propertyName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: "CommanderConsoleViewModel is missing a required property.",
        detail: propertyName,
      }));
    }
  }

  const viewModelSource = getUiSourceFile(project, VIEW_MODEL_PATH);
  if (getObjectArrayLength(viewModelSource, "PRIMARY_PAGES") !== REQUIRED_PRIMARY_PAGES.length) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: VIEW_MODEL_PATH,
      line: 1,
      severity: "error",
      message: "PRIMARY_PAGES must enumerate the six mandated Commander primary pages.",
    }));
  }

  const renderPageSource = getUiSourceFile(project, PAGE_RENDER_PATH);
  if (!hasImportModuleSpecifier(renderPageSource, "/features/commander-console/CommanderConsoleShell")) {
    findings.push(createFinding({
      lawId: APP_SHELL_LAW_ID,
      file: PAGE_RENDER_PATH,
      line: 1,
      severity: "fatal",
      message: "Root Commander page renderer must delegate to the new CommanderConsoleShell.",
    }));
  }

  if (hasLiteralFragment(renderPageSource, "commander-console-page-") || hasLiteralFragment(renderPageSource, "buildCommanderConsolePageModel")) {
    findings.push(createFinding({
      lawId: APP_SHELL_LAW_ID,
      file: PAGE_RENDER_PATH,
      line: 1,
      severity: "fatal",
      message: "Legacy single-dashboard renderer markers still exist in the shell entrypoint.",
    }));
  }

  const shellClientSource = getUiSourceFile(project, SHELL_CLIENT_PATH);
  for (const routeMarker of REQUIRED_CLIENT_ROUTE_MARKERS) {
    if (!hasLiteralFragment(shellClientSource, routeMarker)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SHELL_CLIENT_PATH,
        line: 1,
        severity: "error",
        message: "Commander shell client is missing a required public route or action marker.",
        detail: routeMarker,
      }));
    }
  }

  for (const legacyPath of LEGACY_FILE_PATHS) {
    if (await pathExists(legacyPath)) {
      findings.push(createFinding({
        lawId: APP_SHELL_LAW_ID,
        file: legacyPath,
        line: 1,
        severity: "fatal",
        message: "Legacy Commander dashboard file must remain deleted after the shell rebuild.",
      }));
    }
  }

  return {
    findings,
    phase: createPhase(
      "required-shape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console UI is shaped as a six-page shell with tabbed pages, inspect drawer, public handlers, and deleted legacy dashboard files."
        : "Commander Console UI is missing required shell files, page topology, handler names, or legacy deletion guarantees.",
    ),
  };
}