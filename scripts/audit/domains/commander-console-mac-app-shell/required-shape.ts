import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { getTypeAliasPropertyNames } from "../_shared/ast-schema-queries.js";

import {
  ATOMIC_QUALITY_ITEMS,
  LAW_IDS,
  PATHS,
  REQUIRED_EXPORTS,
  SCORECARD_ITEMS,
} from "./config.js";
import { pathExists, readAtomicQualityData, readScorecardData } from "./audit-docs.js";
import { createCommanderConsoleMacShellProject, getExportedNames, getMacShellSourceFile } from "./project-access.js";
import { hasNamedImport, hasSourceTextFragment } from "./source-rules.js";

function collectRequiredExportFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>, findings: Finding[]): Promise<void[]> {
  return Promise.all(REQUIRED_EXPORTS.map(async (required) => {
    if (!(await pathExists(required.path))) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: required.path, line: 1, severity: "fatal", message: "Required Mac shell file is missing.", detail: required.exportName }));
      return;
    }
    const sourceFile = getMacShellSourceFile(project, required.path);
    if (!getExportedNames(sourceFile).has(required.exportName)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: required.path, line: 1, severity: "error", message: "Required Mac shell export is missing.", detail: required.exportName }));
    }
  }));
}

function collectViewModelTypeFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const properties = getTypeAliasPropertyNames(getMacShellSourceFile(project, PATHS.APP_TYPES), "CommanderAppViewModel");
  return ["initialPageId", "navItems", "tabGroups", "viewportGate", "actionableErrors"]
    .filter((propertyName) => !properties.has(propertyName))
    .map((propertyName) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.APP_TYPES, line: 1, severity: "error", message: "CommanderAppViewModel is missing a required Mac shell field.", detail: propertyName }));
}

function collectAppViewModelFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const appViewModelSource = getMacShellSourceFile(project, PATHS.APP_VIEW_MODEL);
  return [
    'initialPageId: "home"',
    'requiresDeveloperMode: true',
    'width: 900, height: 675',
    'width: 960, height: 720',
    'width: 1024, height: 768',
    'width: 1100, height: 825',
    'width: 1280, height: 900',
    'width: 1366, height: 900',
  ]
    .filter((fragment) => !hasSourceTextFragment(appViewModelSource, fragment))
    .map((fragment) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.APP_VIEW_MODEL, line: 1, severity: "error", message: "App view model is missing a required desktop viewport or developer gate fragment.", detail: fragment }));
}

function collectRenderEntryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const renderEntrySource = getMacShellSourceFile(project, PATHS.PAGE_RENDER);
  return !hasNamedImport(renderEntrySource, "/CommanderMacShell", "renderCommanderMacShell") || !hasSourceTextFragment(renderEntrySource, "renderCommanderMacShell")
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.PAGE_RENDER, line: 1, severity: "error", message: "Local app shell render entry must delegate to renderCommanderMacShell." })]
    : [];
}

function collectMacShellFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const macShellSource = getMacShellSourceFile(project, PATHS.MAC_SHELL);
  const requiredLayoutImports: ReadonlyArray<readonly [string, string]> = [
    ["/layout/MacTitleBar", "renderMacTitleBar"],
    ["/layout/MacToolbar", "renderMacToolbar"],
    ["/layout/LeftSidebar", "renderLeftSidebar"],
    ["/layout/MainWorkspace", "renderMainWorkspace"],
    ["/layout/RightInspector", "renderRightInspector"],
    ["/layout/RuntimeStatusStrip", "renderRuntimeStatusStrip"],
  ];
  const findings = requiredLayoutImports.filter(([marker, importName]) => !hasNamedImport(macShellSource, marker, importName))
    .map(([marker, importName]) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.MAC_SHELL, line: 1, severity: "error", message: "CommanderMacShell is missing a required layout import.", detail: `${marker}:${importName}` }));
  return findings.concat(
    ['class="cc-mac-shell"', 'window.__grasseyeCommanderConsolePageHtml', 'window.__grasseyeCommanderConsoleInspectHtml', 'renderMacToolbar', 'renderLeftSidebar', 'renderMainWorkspace']
      .filter((fragment) => !hasSourceTextFragment(macShellSource, fragment))
      .map((fragment) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.MAC_SHELL, line: 1, severity: "error", message: "CommanderMacShell is missing a required composition fragment.", detail: fragment })),
  );
}

function collectClientFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const clientSource = getMacShellSourceFile(project, PATHS.SHELL_CLIENT);
  return ['[data-primary-nav]', 'function syncPrimaryNav', 'window.commanderConsoleUi = handlers', 'button.hidden = !state.developerModeOpen']
    .filter((fragment) => !hasSourceTextFragment(clientSource, fragment))
    .map((fragment) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SHELL_CLIENT, line: 1, severity: "error", message: "Mac shell client is missing a required navigation or gating fragment.", detail: fragment }));
}

function collectStylesFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const stylesSource = getMacShellSourceFile(project, PATHS.STYLES);
  return ['.cc-mac-shell', '.cc-left-sidebar', '.cc-main-workspace', '.cc-right-inspector', '.cc-home-grid']
    .filter((fragment) => !hasLiteralTextFragment(stylesSource, fragment))
    .map((fragment) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.STYLES, line: 1, severity: "error", message: "Mac shell styles are missing a required desktop fragment.", detail: fragment }));
}

function collectHomePageFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const homePageSource = getMacShellSourceFile(project, PATHS.HOME_PAGE);
  return ['cc-home-grid', 'cc-home-sidebar-stack', 'renderRunLimitMiniForm', 'renderSafetyControls', 'data-start-mission-form']
    .filter((fragment) => !hasSourceTextFragment(homePageSource, fragment))
    .map((fragment) => createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.HOME_PAGE, line: 1, severity: "error", message: "Home page is missing a required desktop start-surface fragment.", detail: fragment }));
}

function collectTaskLauncherFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const taskLauncherSource = getMacShellSourceFile(project, PATHS.TASK_TEMPLATE_LAUNCHER);
  return hasSourceTextFragment(taskLauncherSource, "template.safetyLevel")
    ? []
    : [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.TASK_TEMPLATE_LAUNCHER, line: 1, severity: "error", message: "Task template launcher must expose safetyLevel instead of raw system category in normal mode." })];
}

async function collectRequiredFileFindings(filePaths: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const filePath of filePaths) {
    if (!(await pathExists(filePath))) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: filePath, line: 1, severity: "fatal", message: "Required Mac shell file is missing." }));
    }
  }
  return findings;
}

function collectScorecardFindings(scorecard: NonNullable<Awaited<ReturnType<typeof readScorecardData>>>): Finding[] {
  const itemNames = new Set(scorecard.items.map((item) => item.name));
  return SCORECARD_ITEMS.filter((itemName) => !itemNames.has(itemName)).map((itemName) =>
    createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SCORECARD, line: 1, severity: "error", message: "Mac app shell scorecard is missing a required scoring item.", detail: itemName }),
  );
}

function collectAtomicQualityFindings(atomicQuality: NonNullable<Awaited<ReturnType<typeof readAtomicQualityData>>>): Finding[] {
  const itemNames = new Set(atomicQuality.items.map((item) => item.name));
  const findings = ATOMIC_QUALITY_ITEMS.filter((itemName) => !itemNames.has(itemName)).map((itemName) =>
    createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.ATOMIC_QUALITY, line: 1, severity: "error", message: "Atomic quality document is missing a required item.", detail: itemName }),
  );
  return atomicQuality.missingReferences.includes(PATHS.MISSING_BLUEPRINT)
    ? findings
    : findings.concat(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.ATOMIC_QUALITY, line: 1, severity: "error", message: "Atomic quality document must record the missing Commander page blueprint as MISSING_REFERENCE." }));
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleMacShellProject();
  const findings: Finding[] = [];
  const scorecard = await readScorecardData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SCORECARD, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Mac app shell scorecard cannot be parsed." }));
    return null;
  });
  const atomicQuality = await readAtomicQualityData().catch((error) => {
    findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.ATOMIC_QUALITY, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Atomic quality document cannot be parsed." }));
    return null;
  });
  await collectRequiredExportFindings(project, findings);
  findings.push(...collectViewModelTypeFindings(project));
  findings.push(...collectAppViewModelFindings(project));
  findings.push(...collectRenderEntryFindings(project));
  findings.push(...collectMacShellFindings(project));
  findings.push(...collectClientFindings(project));
  findings.push(...collectStylesFindings(project));
  findings.push(...collectHomePageFindings(project));
  findings.push(...collectTaskLauncherFindings(project));
  findings.push(...(await collectRequiredFileFindings([PATHS.COPY, PATHS.LEFT_SIDEBAR, PATHS.RIGHT_INSPECTOR])));
  if (scorecard) {
    findings.push(...collectScorecardFindings(scorecard));
  }
  if (atomicQuality) {
    findings.push(...collectAtomicQualityFindings(atomicQuality));
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