import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_ROUTER_PATH,
  APP_SHELL_PATH,
  APP_TYPES_PATH,
  APP_VIEW_MODEL_PATH,
  BOTTOM_NAV_PATH,
  COMPACT_STATUS_BAR_PATH,
  HOME_PAGE_PATH,
  INSPECT_MODAL_PATH,
  PAGE_RENDER_PATH,
  REQUIRED_EXPORTS,
  SCORECARD_ITEMS,
  SHELL_CLIENT_PATH,
  TYPES_PATH,
  VIEW_MODEL_PATH,
  createCommanderConsoleUserLoveProject,
  getExportedNames,
  getTypeAliasPropertyNames,
  getUserLoveSourceFile,
  hasLiteralTextFragment,
  pathExists,
  readScorecardData,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleUserLoveProject();
  const findings: Finding[] = [];
  const scorecard = await readScorecardData().catch((error) => {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "docs/audit/commander-console-user-love-scorecard.md",
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Scorecard cannot be parsed.",
    }));
    return null;
  });

  for (const required of REQUIRED_EXPORTS) {
    if (!(await pathExists(required.path))) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: required.path,
        line: 1,
        severity: "fatal",
        message: "Required compact-shell file is missing.",
        detail: required.exportName,
      }));
      continue;
    }

    const sourceFile = getUserLoveSourceFile(project, required.path);
    if (!getExportedNames(sourceFile).has(required.exportName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: required.path,
        line: 1,
        severity: "error",
        message: "Required compact-shell export is missing.",
        detail: required.exportName,
      }));
    }
  }

  const appViewModelTypeProperties = getTypeAliasPropertyNames(getUserLoveSourceFile(project, APP_TYPES_PATH), "CommanderAppViewModel");
  for (const propertyName of ["initialPageId", "navItems", "tabGroups", "viewportGate", "actionableErrors"]) {
    if (!appViewModelTypeProperties.has(propertyName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: APP_TYPES_PATH,
        line: 1,
        severity: "error",
        message: "CommanderAppViewModel is missing a required compact-shell field.",
        detail: propertyName,
      }));
    }
  }

  const taskTemplateTypeProperties = getTypeAliasPropertyNames(getUserLoveSourceFile(project, TYPES_PATH), "CommanderConsoleTaskTemplate");
  for (const propertyName of ["defaultRunLimit", "maxAllowedRunLimit", "developerBinding", "userVisibleCapabilities"]) {
    if (!taskTemplateTypeProperties.has(propertyName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: "CommanderConsoleTaskTemplate is missing a required launch field.",
        detail: propertyName,
      }));
    }
  }

  const appViewModelSource = getUserLoveSourceFile(project, APP_VIEW_MODEL_PATH);
  for (const requiredFragment of [
    'initialPageId: "home"',
    'pageId: "home"',
    'pageId: "mission"',
    'pageId: "results"',
    'pageId: "review"',
    'pageId: "health"',
    'pageId: "developer"',
    'requiresDeveloperMode: true',
    'width: 390, height: 740',
    'width: 420, height: 800',
    'width: 520, height: 860',
    'width: 768, height: 900',
  ]) {
    if (!hasLiteralTextFragment(appViewModelSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: APP_VIEW_MODEL_PATH,
        line: 1,
        severity: "error",
        message: "App view model is missing a required compact viewport or navigation fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const appRouterSource = getUserLoveSourceFile(project, APP_ROUTER_PATH);
  for (const requiredFragment of [
    'home: renderHomeStartPage',
    'mission: renderMissionPage',
    'results: renderResultsPage',
    'review: renderReviewPage',
    'health: renderHealthPage',
    'developer: renderDeveloperPage',
    'data-app-router',
    'data-app-page-host',
  ]) {
    if (!hasLiteralTextFragment(appRouterSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: APP_ROUTER_PATH,
        line: 1,
        severity: "error",
        message: "App router is missing a required single-active-page fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const appShellSource = getUserLoveSourceFile(project, APP_SHELL_PATH);
  for (const requiredFragment of [
    'renderCompactStatusBar',
    'renderCommanderAppRouter',
    'renderBottomNav',
    'renderInspectModal',
    'commanderConsoleShellClient',
    'window.__grasseyeCommanderConsolePageHtml',
    'window.__grasseyeCommanderConsoleInspectHtml',
  ]) {
    if (!hasLiteralTextFragment(appShellSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: APP_SHELL_PATH,
        line: 1,
        severity: "error",
        message: "App shell is missing a required compact-shell composition fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const renderEntrySource = getUserLoveSourceFile(project, PAGE_RENDER_PATH);
  if (!hasLiteralTextFragment(renderEntrySource, "renderCommanderAppShell")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: PAGE_RENDER_PATH,
      line: 1,
      severity: "error",
      message: "Local app shell render entry must delegate to renderCommanderAppShell.",
    }));
  }

  const bottomNavSource = getUserLoveSourceFile(project, BOTTOM_NAV_PATH);
  for (const requiredFragment of ['data-bottom-nav', 'data-nav-page', 'data-developer-nav="hidden"', 'hidden="hidden"']) {
    if (!hasLiteralTextFragment(bottomNavSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: BOTTOM_NAV_PATH,
        line: 1,
        severity: "error",
        message: "Bottom navigation is missing a required compact-shell gate.",
        detail: requiredFragment,
      }));
    }
  }

  const inspectModalSource = getUserLoveSourceFile(project, INSPECT_MODAL_PATH);
  for (const requiredFragment of ['data-inspect-modal', 'hidden="hidden"', 'aria-hidden="true"', 'data-close-inspect']) {
    if (!hasLiteralTextFragment(inspectModalSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: INSPECT_MODAL_PATH,
        line: 1,
        severity: "error",
        message: "Inspect modal is missing a required default-closed fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const clientSource = getUserLoveSourceFile(project, SHELL_CLIENT_PATH);
  for (const requiredFragment of [
    'function renderActivePage()',
    "pageHost.innerHTML = pageHtml[nextPage] || pageHtml.home || ''",
    'pageHost.setAttribute(\'data-active-page\', nextPage)',
    'window.commanderConsoleUi = handlers',
    'button.hidden = !state.developerModeOpen',
  ]) {
    if (!hasLiteralTextFragment(clientSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SHELL_CLIENT_PATH,
        line: 1,
        severity: "error",
        message: "Compact-shell client is missing a required routing or gating fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const homePageSource = getUserLoveSourceFile(project, HOME_PAGE_PATH);
  for (const requiredFragment of ['data-home-page', 'data-start-mission-form', 'Start Task', 'data-nav-page="mission"', 'renderCurrentMissionCard']) {
    if (!hasLiteralTextFragment(homePageSource, requiredFragment)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: HOME_PAGE_PATH,
        line: 1,
        severity: "error",
        message: "Home page is missing a required compact start-flow fragment.",
        detail: requiredFragment,
      }));
    }
  }

  const statusBarSource = getUserLoveSourceFile(project, COMPACT_STATUS_BAR_PATH);
  if (!hasLiteralTextFragment(statusBarSource, 'data-command-action="emergency-stop"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: COMPACT_STATUS_BAR_PATH,
      line: 1,
      severity: "error",
      message: "Compact status bar must expose the global emergency stop.",
    }));
  }

  const viewModelSource = getUserLoveSourceFile(project, VIEW_MODEL_PATH);
  if (!viewModelSource.getFullText().includes("developerBinding")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: VIEW_MODEL_PATH,
      line: 1,
      severity: "error",
      message: "View model must still consume TaskTemplate developerBinding for developer-only inspection.",
    }));
  }

  if (!scorecard) {
    return {
      findings,
      phase: createPhase("required-shape", "CODE VIOLATION", false, "Compact-shell scorecard is missing or unreadable."),
    };
  }

  const itemNames = new Set(scorecard.items.map((item) => item.name));
  for (const itemName of SCORECARD_ITEMS) {
    if (!itemNames.has(itemName)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: "docs/audit/commander-console-user-love-scorecard.md",
        line: 1,
        severity: "error",
        message: "Scorecard is missing a required scoring item.",
        detail: itemName,
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
        ? "Commander Console compact shell contains the required app shell, single-page router, bottom navigation, default-closed inspect modal, start-flow home page, and compact viewport scorecard item."
        : "Commander Console compact shell is missing required app-shell structure, launch controls, or compact viewport scorecard coverage.",
    ),
  };
}