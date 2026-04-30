import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_ROUTER_PATH,
  APP_VIEW_MODEL_PATH,
  BOTTOM_NAV_PATH,
  INSPECT_MODAL_PATH,
  ROOT,
  SHELL_CLIENT_PATH,
  createCommanderConsoleUserLoveProject,
  getUiFeatureSourceFiles,
  getUserLoveSourceFile,
  hasUnsafeEscape,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleUserLoveProject();
  const findings: Finding[] = [];

  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasUnsafeEscape(sourceFile)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf(ROOT)),
        line: 1,
        severity: "fatal",
        message: "Commander Console user-love UI contains a forbidden escape hatch.",
      }));
    }
  }

  const inspectModalSource = getUserLoveSourceFile(project, INSPECT_MODAL_PATH);
  if (!inspectModalSource.getFullText().includes('hidden="hidden"') || !inspectModalSource.getFullText().includes('aria-hidden="true"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: INSPECT_MODAL_PATH,
      line: 1,
      severity: "fatal",
      message: "Inspect modal must default to hidden instead of opening on boot.",
    }));
  }

  const bottomNavSource = getUserLoveSourceFile(project, BOTTOM_NAV_PATH);
  if (!bottomNavSource.getFullText().includes('hidden="hidden"') || !bottomNavSource.getFullText().includes('data-developer-nav="hidden"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: BOTTOM_NAV_PATH,
      line: 1,
      severity: "fatal",
      message: "Developer navigation must stay hidden until the operator explicitly opens developer mode.",
    }));
  }

  const shellClientSource = getUserLoveSourceFile(project, SHELL_CLIENT_PATH);
  if (shellClientSource.getFullText().includes("developerModeOpen: true") || shellClientSource.getFullText().includes("setDeveloperMode(true)")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: SHELL_CLIENT_PATH,
      line: 1,
      severity: "fatal",
      message: "Developer mode must not auto-open on shell boot.",
    }));
  }

  if (shellClientSource.getFullText().includes("inspectModal.hidden = false") && !shellClientSource.getFullText().includes("function updateInspectModal")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: SHELL_CLIENT_PATH,
      line: 1,
      severity: "fatal",
      message: "Inspect must only open inside the explicit inspect update flow.",
    }));
  }

  if (shellClientSource.getFullText().includes("Object.values(pageHtml).join")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: SHELL_CLIENT_PATH,
      line: 1,
      severity: "fatal",
      message: "Compact shell must not render every page at once and hide them with client-side tricks.",
    }));
  }

  const routerSource = getUserLoveSourceFile(project, APP_ROUTER_PATH);
  if (routerSource.getFullText().includes("Object.values(") || routerSource.getFullText().includes("pageHtmlMap.home + pageHtmlMap.mission")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: APP_ROUTER_PATH,
      line: 1,
      severity: "fatal",
      message: "App router must only mount one active page host, not concatenate all pages into one long scroll.",
    }));
  }

  const appViewModelSource = getUserLoveSourceFile(project, APP_VIEW_MODEL_PATH);
  if (appViewModelSource.getFullText().includes('initialPageId: "developer"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: APP_VIEW_MODEL_PATH,
      line: 1,
      severity: "fatal",
      message: "Compact shell must boot into Home, not Developer.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "anti-escape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console compact shell rejects any-casts, default-open developer or inspect drift, and fake multi-page hiding strategies."
        : "Commander Console compact shell still carries an escape hatch or default-open drift.",
    ),
  };
}