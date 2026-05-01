import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";

import { LAW_IDS, PATHS } from "./config.js";
import { createCommanderConsoleMacShellProject, getMacShellSourceFile, getUiFeatureSourceFiles } from "./project-access.js";
import { hasForbiddenImport, hasImportModuleSpecifier } from "./source-rules.js";

function collectUiFeatureFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf(PATHS.ROOT)), line: 1, severity: "fatal", message: "Commander Console Mac shell imported a forbidden runtime or child path." }));
    }
  }
  return findings;
}

function collectRenderEntryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const renderEntrySource = getMacShellSourceFile(project, PATHS.PAGE_RENDER);
  for (const forbiddenFragment of ["renderCommanderAppShell", "renderCommanderConsoleShell"]) {
    if (hasLiteralTextFragment(renderEntrySource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.PAGE_RENDER, line: 1, severity: "fatal", message: "Local app shell render entry still points at an obsolete shell.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectMacShellFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const macShellSource = getMacShellSourceFile(project, PATHS.MAC_SHELL);
  for (const forbiddenImport of ["/layout/BottomNav", "/layout/CompactStatusBar", "/layout/InspectModal", "/CommanderAppShell"]) {
    if (hasImportModuleSpecifier(macShellSource, forbiddenImport)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.MAC_SHELL, line: 1, severity: "fatal", message: "CommanderMacShell still imports a legacy phone-shell artifact.", detail: forbiddenImport }));
    }
  }
  return findings;
}

function collectClientFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const clientSource = getMacShellSourceFile(project, PATHS.SHELL_CLIENT);
  for (const forbiddenFragment of ["[data-bottom-nav]", "function syncBottomNav", "bottomNav.querySelectorAll"]) {
    if (hasLiteralTextFragment(clientSource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.SHELL_CLIENT, line: 1, severity: "fatal", message: "Mac shell client still carries bottom-nav routing residue.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectStyleFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  const stylesSource = getMacShellSourceFile(project, PATHS.STYLES);
  for (const forbiddenFragment of [".cc-bottom-nav", ".cc-theme-compact-app", "--cc-frame-max"]) {
    if (hasLiteralTextFragment(stylesSource, forbiddenFragment)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.STYLES, line: 1, severity: "fatal", message: "Desktop shell styles still expose compact phone-shell residue.", detail: forbiddenFragment }));
    }
  }
  return findings;
}

function collectTaskLauncherFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const taskLauncherSource = getMacShellSourceFile(project, PATHS.TASK_TEMPLATE_LAUNCHER);
  return hasLiteralTextFragment(taskLauncherSource, "template.taskCategory")
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.TASK_TEMPLATE_LAUNCHER, line: 1, severity: "fatal", message: "Normal-mode task launcher must not show raw taskCategory anymore." })]
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