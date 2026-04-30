import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_TYPES_PATH,
  APP_VIEW_MODEL_PATH,
  ATOMIC_QUALITY_ITEMS,
  COPY_PATH,
  HOME_PAGE_PATH,
  LEFT_SIDEBAR_PATH,
  MAC_SHELL_PATH,
  PAGE_RENDER_PATH,
  REQUIRED_EXPORTS,
  RIGHT_INSPECTOR_PATH,
  SCORECARD_ITEMS,
  SHELL_CLIENT_PATH,
  STYLES_PATH,
  TASK_TEMPLATE_LAUNCHER_PATH,
  createCommanderConsoleMacShellProject,
  getExportedNames,
  getMacShellSourceFile,
  hasSourceTextFragment,
  getTypeAliasPropertyNames,
  hasLiteralTextFragment,
  hasNamedImport,
  pathExists,
  readAtomicQualityData,
  readScorecardData,
} from "./ast-utils.js";
import { LAW_ID, MISSING_BLUEPRINT_PATH } from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleMacShellProject();
  const findings: Finding[] = [];
  const scorecard = await readScorecardData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Mac app shell scorecard cannot be parsed." }));
    return null;
  });
  const atomicQuality = await readAtomicQualityData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Atomic quality document cannot be parsed." }));
    return null;
  });

  for (const required of REQUIRED_EXPORTS) {
    if (!(await pathExists(required.path))) {
      findings.push(createFinding({ lawId: LAW_ID, file: required.path, line: 1, severity: "fatal", message: "Required Mac shell file is missing.", detail: required.exportName }));
      continue;
    }

    const sourceFile = getMacShellSourceFile(project, required.path);
    if (!getExportedNames(sourceFile).has(required.exportName)) {
      findings.push(createFinding({ lawId: LAW_ID, file: required.path, line: 1, severity: "error", message: "Required Mac shell export is missing.", detail: required.exportName }));
    }
  }

  const appViewModelTypeProperties = getTypeAliasPropertyNames(getMacShellSourceFile(project, APP_TYPES_PATH), "CommanderAppViewModel");
  for (const propertyName of ["initialPageId", "navItems", "tabGroups", "viewportGate", "actionableErrors"]) {
    if (!appViewModelTypeProperties.has(propertyName)) {
      findings.push(createFinding({ lawId: LAW_ID, file: APP_TYPES_PATH, line: 1, severity: "error", message: "CommanderAppViewModel is missing a required Mac shell field.", detail: propertyName }));
    }
  }

  const appViewModelSource = getMacShellSourceFile(project, APP_VIEW_MODEL_PATH);
  for (const requiredFragment of [
    'initialPageId: "home"',
    'requiresDeveloperMode: true',
    'width: 900, height: 675',
    'width: 960, height: 720',
    'width: 1024, height: 768',
    'width: 1100, height: 825',
    'width: 1280, height: 900',
    'width: 1366, height: 900',
  ]) {
    if (!hasSourceTextFragment(appViewModelSource, requiredFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: APP_VIEW_MODEL_PATH, line: 1, severity: "error", message: "App view model is missing a required desktop viewport or developer gate fragment.", detail: requiredFragment }));
    }
  }

  const renderEntrySource = getMacShellSourceFile(project, PAGE_RENDER_PATH);
  if (!hasNamedImport(renderEntrySource, "/CommanderMacShell", "renderCommanderMacShell") || !hasSourceTextFragment(renderEntrySource, "renderCommanderMacShell")) {
    findings.push(createFinding({ lawId: LAW_ID, file: PAGE_RENDER_PATH, line: 1, severity: "error", message: "Local app shell render entry must delegate to renderCommanderMacShell." }));
  }

  const macShellSource = getMacShellSourceFile(project, MAC_SHELL_PATH);
  for (const requiredImport of [
    ["/layout/MacTitleBar", "renderMacTitleBar"],
    ["/layout/MacToolbar", "renderMacToolbar"],
    ["/layout/LeftSidebar", "renderLeftSidebar"],
    ["/layout/MainWorkspace", "renderMainWorkspace"],
    ["/layout/RightInspector", "renderRightInspector"],
    ["/layout/RuntimeStatusStrip", "renderRuntimeStatusStrip"],
  ] as const) {
    if (!hasNamedImport(macShellSource, requiredImport[0], requiredImport[1])) {
      findings.push(createFinding({ lawId: LAW_ID, file: MAC_SHELL_PATH, line: 1, severity: "error", message: "CommanderMacShell is missing a required layout import.", detail: `${requiredImport[0]}:${requiredImport[1]}` }));
    }
  }

  for (const requiredFragment of [
    'class="cc-mac-shell"',
    'window.__grasseyeCommanderConsolePageHtml',
    'window.__grasseyeCommanderConsoleInspectHtml',
    'renderMacToolbar',
    'renderLeftSidebar',
    'renderMainWorkspace',
  ]) {
    if (!hasSourceTextFragment(macShellSource, requiredFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: MAC_SHELL_PATH, line: 1, severity: "error", message: "CommanderMacShell is missing a required composition fragment.", detail: requiredFragment }));
    }
  }

  const clientSource = getMacShellSourceFile(project, SHELL_CLIENT_PATH);
  for (const requiredFragment of [
    '[data-primary-nav]',
    'function syncPrimaryNav',
    'window.commanderConsoleUi = handlers',
    'button.hidden = !state.developerModeOpen',
  ]) {
    if (!hasSourceTextFragment(clientSource, requiredFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: SHELL_CLIENT_PATH, line: 1, severity: "error", message: "Mac shell client is missing a required navigation or gating fragment.", detail: requiredFragment }));
    }
  }

  const stylesSource = getMacShellSourceFile(project, STYLES_PATH);
  for (const requiredFragment of ['.cc-mac-shell', '.cc-left-sidebar', '.cc-main-workspace', '.cc-right-inspector', '.cc-home-grid']) {
    if (!hasLiteralTextFragment(stylesSource, requiredFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: STYLES_PATH, line: 1, severity: "error", message: "Mac shell styles are missing a required desktop fragment.", detail: requiredFragment }));
    }
  }

  const homePageSource = getMacShellSourceFile(project, HOME_PAGE_PATH);
  for (const requiredFragment of ['cc-home-grid', 'cc-home-sidebar-stack', 'renderRunLimitMiniForm', 'renderSafetyControls', 'data-start-mission-form']) {
    if (!hasSourceTextFragment(homePageSource, requiredFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: HOME_PAGE_PATH, line: 1, severity: "error", message: "Home page is missing a required desktop start-surface fragment.", detail: requiredFragment }));
    }
  }

  const taskLauncherSource = getMacShellSourceFile(project, TASK_TEMPLATE_LAUNCHER_PATH);
  if (!hasSourceTextFragment(taskLauncherSource, 'template.safetyLevel')) {
    findings.push(createFinding({ lawId: LAW_ID, file: TASK_TEMPLATE_LAUNCHER_PATH, line: 1, severity: "error", message: "Task template launcher must expose safetyLevel instead of raw system category in normal mode." }));
  }

  for (const filePath of [COPY_PATH, LEFT_SIDEBAR_PATH, RIGHT_INSPECTOR_PATH]) {
    if (!(await pathExists(filePath))) {
      findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: 1, severity: "fatal", message: "Required Mac shell file is missing." }));
    }
  }

  if (scorecard) {
    const itemNames = new Set(scorecard.items.map((item) => item.name));
    for (const itemName of SCORECARD_ITEMS) {
      if (!itemNames.has(itemName)) {
        findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-mac-app-shell-scorecard.md", line: 1, severity: "error", message: "Mac app shell scorecard is missing a required scoring item.", detail: itemName }));
      }
    }
  }

  if (atomicQuality) {
    const itemNames = new Set(atomicQuality.items.map((item) => item.name));
    for (const itemName of ATOMIC_QUALITY_ITEMS) {
      if (!itemNames.has(itemName)) {
        findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality document is missing a required item.", detail: itemName }));
      }
    }
    if (!atomicQuality.missingReferences.includes(MISSING_BLUEPRINT_PATH)) {
      findings.push(createFinding({ lawId: LAW_ID, file: "docs/audit/commander-console-ui-atomic-quality.md", line: 1, severity: "error", message: "Atomic quality document must record the missing Commander page blueprint as MISSING_REFERENCE." }));
    }
  }

  return {
    findings,
    phase: createPhase(
      "required-shape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console Mac shell contains the required desktop shell, sidebar navigation, right inspector, desktop viewport gate, and documented scorecards."
        : "Commander Console Mac shell is missing required desktop structure, scorecard items, or blueprint recording.",
    ),
  };
}