import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";

function collectLeakFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const runtimeLeaks = getExternalImportsWithPrefix(project, `${PATHS.ROOT}/runtime/`).filter((importerPath) => importerPath !== PATHS.WORKBENCH_RUNTIME);
  for (const importerPath of runtimeLeaks) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: importerPath, line: 1, severity: "fatal", message: "External code must not import text-input runtime internals." }));
  }
  for (const importerPath of getExternalImportsWithPrefix(project, `${PATHS.ROOT}/children/`)) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: importerPath, line: 1, severity: "fatal", message: "External code must not import text-input child internals." }));
  }
  return findings;
}

function collectWorkbenchFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH_RUNTIME);
  if (!workbenchSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench text-input runtime must compose the governed ability group with runtime ports at the composition root." })];
  }
  if (!hasCallExpression(workbenchSource, "createWorkbenchTextInputAbilityGroup") || !hasCallExpression(workbenchSource, "createBrowserControllerTextInputRuntimePorts")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench text-input runtime must compose the governed ability group with runtime ports at the composition root." }));
  }
  return findings;
}

function collectAdapterFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return !getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
    ? [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Text Input primitive adapter is missing." })]
    : [];
}

export function runBoundaryAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectLeakFindings(project),
    ...collectWorkbenchFindings(project),
    ...collectAdapterFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Text Input runtime and child internals stay behind the owning boundary and composition root."
        : "Text Input still leaks private runtime or child boundaries.",
    ),
  };
}