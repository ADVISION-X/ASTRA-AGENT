import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  MAC_SHELL_PATH,
  PAGE_RENDER_PATH,
  SHELL_CLIENT_PATH,
  STYLES_PATH,
  TASK_TEMPLATE_LAUNCHER_PATH,
  createCommanderConsoleMacShellProject,
  getMacShellSourceFile,
  getUiFeatureSourceFiles,
  hasForbiddenImport,
  hasImportModuleSpecifier,
  hasLiteralTextFragment,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

function collectUiFeatureFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_ID, file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf("src/features/commander-console")), line: 1, severity: "fatal", message: "Commander Console Mac shell imported a forbidden runtime or child path." }));
    }
  }
  return findings;
}

function collectRenderEntryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const renderEntrySource = getMacShellSourceFile(project, PAGE_RENDER_PATH);
  for (const forbiddenFragment of ["renderCommanderAppShell", "renderCommanderConsoleShell"]) {
    if (hasLiteralTextFragment(renderEntrySource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: PAGE_RENDER_PATH, line: 1, severity: "fatal", message: "Local app shell render entry still points at an obsolete shell.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectMacShellFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const macShellSource = getMacShellSourceFile(project, MAC_SHELL_PATH);
  for (const forbiddenImport of ["/layout/BottomNav", "/layout/CompactStatusBar", "/layout/InspectModal", "/CommanderAppShell"]) {
    if (hasImportModuleSpecifier(macShellSource, forbiddenImport)) {
      findings.push(createFinding({ lawId: LAW_ID, file: MAC_SHELL_PATH, line: 1, severity: "fatal", message: "CommanderMacShell still imports a legacy phone-shell artifact.", detail: forbiddenImport }));
    }
  }
  return findings;
}

function collectClientFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const clientSource = getMacShellSourceFile(project, SHELL_CLIENT_PATH);
  for (const forbiddenFragment of ["[data-bottom-nav]", "function syncBottomNav", "bottomNav.querySelectorAll"]) {
    if (hasLiteralTextFragment(clientSource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: SHELL_CLIENT_PATH, line: 1, severity: "fatal", message: "Mac shell client still carries bottom-nav routing residue.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectStyleFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const stylesSource = getMacShellSourceFile(project, STYLES_PATH);
  for (const forbiddenFragment of [".cc-bottom-nav", ".cc-theme-compact-app", "--cc-frame-max"]) {
    if (hasLiteralTextFragment(stylesSource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_ID, file: STYLES_PATH, line: 1, severity: "fatal", message: "Desktop shell styles still expose compact phone-shell residue.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectTaskLauncherFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const taskLauncherSource = getMacShellSourceFile(project, TASK_TEMPLATE_LAUNCHER_PATH);
  return hasLiteralTextFragment(taskLauncherSource, "template.taskCategory")
    ? [createFinding({ lawId: LAW_ID, file: TASK_TEMPLATE_LAUNCHER_PATH, line: 1, severity: "fatal", message: "Normal-mode task launcher must not show raw taskCategory anymore." })]
    : [];
}

export async function runForbiddenShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createCommanderConsoleMacShellProject();
  const findings = [
    ...collectUiFeatureFindings(project),
    ...collectRenderEntryFindings(project),
    ...collectMacShellFindings(project),
    ...collectClientFindings(project),
    ...collectStyleFindings(project),
    ...collectTaskLauncherFindings(project),
  ];

  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Mac shell path is free of active phone-shell residues and forbidden internal imports."
        : "Phone-shell residue, raw taskCategory leakage, or forbidden internal imports still survive in the Mac shell path.",
    ),
  };
}