import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_ROUTER_PATH,
  APP_VIEW_MODEL_PATH,
  RIGHT_INSPECTOR_PATH,
  ROOT,
  SHELL_CLIENT_PATH,
  createCommanderConsoleMacShellProject,
  getMacShellSourceFile,
  getUiFeatureSourceFiles,
  hasUnsafeEscape,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleMacShellProject();
  const findings: Finding[] = [];

  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasUnsafeEscape(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_ID, file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf(ROOT)), line: 1, severity: "fatal", message: "Commander Console Mac shell contains a forbidden escape hatch." }));
    }
  }

  const inspectorSource = getMacShellSourceFile(project, RIGHT_INSPECTOR_PATH);
  if (!inspectorSource.getFullText().includes('hidden="hidden"') || !inspectorSource.getFullText().includes('aria-hidden="true"')) {
    findings.push(createFinding({ lawId: LAW_ID, file: RIGHT_INSPECTOR_PATH, line: 1, severity: "fatal", message: "Right inspector must default to hidden instead of opening on boot." }));
  }

  const shellClientSource = getMacShellSourceFile(project, SHELL_CLIENT_PATH);
  if (shellClientSource.getFullText().includes("developerModeOpen: true") || shellClientSource.getFullText().includes("setDeveloperMode(true)")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SHELL_CLIENT_PATH, line: 1, severity: "fatal", message: "Developer mode must not auto-open on shell boot." }));
  }
  if (shellClientSource.getFullText().includes("Object.values(pageHtml).join")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SHELL_CLIENT_PATH, line: 1, severity: "fatal", message: "Mac shell must not render every page at once and hide them with client-side tricks." }));
  }

  const routerSource = getMacShellSourceFile(project, APP_ROUTER_PATH);
  if (routerSource.getFullText().includes("Object.values(") || routerSource.getFullText().includes("pageHtmlMap.home + pageHtmlMap.mission")) {
    findings.push(createFinding({ lawId: LAW_ID, file: APP_ROUTER_PATH, line: 1, severity: "fatal", message: "App router must mount one active page host, not concatenate all pages into one long scroll." }));
  }

  const appViewModelSource = getMacShellSourceFile(project, APP_VIEW_MODEL_PATH);
  if (appViewModelSource.getFullText().includes('initialPageId: "developer"')) {
    findings.push(createFinding({ lawId: LAW_ID, file: APP_VIEW_MODEL_PATH, line: 1, severity: "fatal", message: "Mac shell must boot into Home, not Developer." }));
  }

  return {
    findings,
    phase: createPhase(
      "anti-escape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Mac shell rejects any-casts, auto-open developer drift, default-open inspector drift, and fake multi-page hiding strategies."
        : "Mac shell still carries an escape hatch or default-open drift.",
    ),
  };
}