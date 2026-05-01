import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { createCommanderConsoleMacShellProject, getMacShellSourceFile, getUiFeatureSourceFiles } from "./project-access.js";
import { hasUnsafeEscape } from "./source-rules.js";

function collectUiFeatureFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasUnsafeEscape(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf(PATHS.ROOT)), line: 1, severity: "fatal", message: "Commander Console Mac shell contains a forbidden escape hatch." }));
    }
  }
  return findings;
}

function collectInspectorVisibilityFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const inspectorSource = getMacShellSourceFile(project, PATHS.RIGHT_INSPECTOR);
  return !inspectorSource.getFullText().includes('hidden="hidden"') || !inspectorSource.getFullText().includes('aria-hidden="true"')
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.RIGHT_INSPECTOR, line: 1, severity: "fatal", message: "Right inspector must default to hidden instead of opening on boot." })]
    : [];
}

function collectShellClientFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const shellClientSource = getMacShellSourceFile(project, PATHS.SHELL_CLIENT);
  if (shellClientSource.getFullText().includes("developerModeOpen: true") || shellClientSource.getFullText().includes("setDeveloperMode(true)")) {
    findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SHELL_CLIENT, line: 1, severity: "fatal", message: "Developer mode must not auto-open on shell boot." }));
  }
  if (shellClientSource.getFullText().includes("Object.values(pageHtml).join")) {
    findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SHELL_CLIENT, line: 1, severity: "fatal", message: "Mac shell must not render every page at once and hide them with client-side tricks." }));
  }
  return findings;
}

function collectRouterFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const routerSource = getMacShellSourceFile(project, PATHS.APP_ROUTER);
  return routerSource.getFullText().includes("Object.values(") || routerSource.getFullText().includes("pageHtmlMap.home + pageHtmlMap.mission")
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.APP_ROUTER, line: 1, severity: "fatal", message: "App router must mount one active page host, not concatenate all pages into one long scroll." })]
    : [];
}

function collectViewModelFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const appViewModelSource = getMacShellSourceFile(project, PATHS.APP_VIEW_MODEL);
  return appViewModelSource.getFullText().includes('initialPageId: "developer"')
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.APP_VIEW_MODEL, line: 1, severity: "fatal", message: "Mac shell must boot into Home, not Developer." })]
    : [];
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleMacShellProject();
  const findings = [
    ...collectUiFeatureFindings(project),
    ...collectInspectorVisibilityFindings(project),
    ...collectShellClientFindings(project),
    ...collectRouterFindings(project),
    ...collectViewModelFindings(project),
  ];

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