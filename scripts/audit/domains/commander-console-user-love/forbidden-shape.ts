import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_PATH,
  FORBIDDEN_FIELD_LITERALS,
  HOME_PAGE_PATH,
  HOME_SURFACE_FILES,
  LEGACY_SHELL_PATH,
  PAGE_RENDER_PATH,
  STYLES_PATH,
  TASK_HANDLER_PATH,
  VIEW_MODEL_PATH,
  createCommanderConsoleUserLoveProject,
  getUiFeatureSourceFiles,
  getUserLoveSourceFile,
  hasForbiddenImport,
  hasImportModuleSpecifier,
  hasLiteralTextFragment,
  hasNullishCoalescingLiteral,
  pathExists,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

export async function runForbiddenShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleUserLoveProject();
  const findings: Finding[] = [];

  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf("src/features/commander-console")),
        line: 1,
        severity: "fatal",
        message: "Commander Console user-love UI imported a forbidden runtime or child path.",
      }));
    }
  }

  for (const filePath of HOME_SURFACE_FILES) {
    const sourceFile = getUserLoveSourceFile(project, filePath);
    for (const forbiddenField of FORBIDDEN_FIELD_LITERALS) {
      if (hasLiteralTextFragment(sourceFile, forbiddenField)) {
        findings.push(createFinding({
          lawId: LAW_ID,
          file: filePath,
          line: 1,
          severity: "fatal",
          message: "Home or launch surface still exposes a forbidden system field literal.",
          detail: forbiddenField,
        }));
      }
    }
  }

  const appShellSource = getUserLoveSourceFile(project, APP_SHELL_PATH);
  for (const forbiddenImport of ["/CommanderConsoleShell", "/layout/InspectDrawer", "/layout/GlobalStatusBar", "/modules/modes/NormalMode", "/modules/modes/DeveloperMode"]) {
    if (hasImportModuleSpecifier(appShellSource, forbiddenImport)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: APP_SHELL_PATH,
        line: 1,
        severity: "fatal",
        message: "Legacy long-dashboard import survived the compact-shell rebuild.",
        detail: forbiddenImport,
      }));
    }
  }

  const renderEntrySource = getUserLoveSourceFile(project, PAGE_RENDER_PATH);
  if (hasLiteralTextFragment(renderEntrySource, "renderCommanderConsoleShell")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: PAGE_RENDER_PATH,
      line: 1,
      severity: "fatal",
      message: "Local app shell render entry still points at the legacy long dashboard shell.",
    }));
  }

  const taskHandlerSource = getUserLoveSourceFile(project, TASK_HANDLER_PATH);
  if (hasNullishCoalescingLiteral(taskHandlerSource, "tiktok-web")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TASK_HANDLER_PATH,
      line: 1,
      severity: "fatal",
      message: "Task handler must not silently default the platform to tiktok-web.",
    }));
  }

  const viewModelSource = getUserLoveSourceFile(project, VIEW_MODEL_PATH);
  if (hasNullishCoalescingLiteral(viewModelSource, "tiktok-web")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: VIEW_MODEL_PATH,
      line: 1,
      severity: "fatal",
      message: "View model must not silently default the platform to tiktok-web.",
    }));
  }

  const homePageSource = getUserLoveSourceFile(project, HOME_PAGE_PATH);
  for (const forbiddenFragment of [
    "renderCapabilityHealthList",
    "renderStructuredLogList",
    "renderReviewSummaryCard",
    "selectedMapId",
    "requestedPlatformId",
    "targetProfileRef",
    "runtimeProof",
    "proofRef",
    "stepId",
  ]) {
    if (hasLiteralTextFragment(homePageSource, forbiddenFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: HOME_PAGE_PATH,
        line: 1,
        severity: "fatal",
        message: "Home page still carries forbidden high-density or developer-only content.",
        detail: forbiddenFragment,
      }));
    }
  }

  const stylesSource = getUserLoveSourceFile(project, STYLES_PATH);
  if (hasLiteralTextFragment(stylesSource, "min-width: 600px")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: STYLES_PATH,
      line: 1,
      severity: "fatal",
      message: "Compact shell core styles must not require a 600px minimum width.",
    }));
  }

  if (hasLiteralTextFragment(stylesSource, "grid-template-columns: repeat(3, minmax(0, 1fr));")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: STYLES_PATH,
      line: 1,
      severity: "fatal",
      message: "Compact shell core layout must not fall back to a three-column compact grid.",
    }));
  }

  if (await pathExists(LEGACY_SHELL_PATH)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: LEGACY_SHELL_PATH,
      line: 1,
      severity: "fatal",
      message: "Legacy CommanderConsoleShell compat bridge must remain removed.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Compact shell Home stays free of system fields and high-density debug content, while the new shell avoids legacy compat bridges and private runtime imports."
        : "Forbidden system field exposure, legacy dashboard residue, or compact-shell width drift still exists in the user-love shell.",
    ),
  };
}