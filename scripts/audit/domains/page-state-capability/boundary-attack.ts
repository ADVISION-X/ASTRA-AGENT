import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createPageStateAuditProject, getPageStateSources, getSource } from "./audit-project.js";
import { ROOT } from "./constants.js";
import { leaksPrivatePageStatePath } from "./source-boundaries.js";
import type { Project } from "ts-morph";

export async function runBoundaryAttack(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const allSources = createPageStateAuditProject().getSourceFiles();

  for (const sourceFile of allSources) {
    if (leaksPrivatePageStatePath(sourceFile)) {
      const repoPath = sourceFile.getFilePath().split("/Users/nexgen/Documents/GrassEye -AI-AGENT/").pop() ?? sourceFile.getBaseName();
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "External code must not import page-state runtime or child internals." }));
    }
  }

  const pageStateSources = getPageStateSources(project);
  for (const sourceFile of pageStateSources) {
    const repoPath = sourceFile.getFilePath().split("/Users/nexgen/Documents/GrassEye -AI-AGENT/").pop() ?? sourceFile.getBaseName();
    const forbiddenMarkers = [
      "capabilities/ai",
      "capabilities/screenshot",
      "capabilities/visual-target",
      "capabilities/mouse-click",
      "capabilities/mouse-scroll",
      "capabilities/post-action-verification",
      "capabilities/forensics-persistence",
    ];
    if (sourceFile.getImportDeclarations().some((declaration) => forbiddenMarkers.some((marker) => declaration.getModuleSpecifierValue().includes(marker)))) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State boundary must not import action, screenshot, AI, or forensics owners." }));
    }
  }

  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  if (!contractSource.getInterface("PageStateAbilityGroup")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: `${ROOT}/contract.ts`, line: 1, severity: "fatal", message: "Page State public boundary must expose only the ability-group contract." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-boundary-attack", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State owner boundary is isolated." : "Page State owner boundary still leaks private or forbidden paths."),
  };
}