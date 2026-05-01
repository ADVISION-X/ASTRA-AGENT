import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";

function collectLeakFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const runtimeLeaks = getExternalImportsWithPrefix(project, `${PATHS.ROOT}/runtime/`).filter((importerPath) => importerPath !== PATHS.WORKBENCH);
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
  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH);
  if (!workbenchSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must compose text-input clock at the composition root." })];
  }
  const runtimeImports = workbenchSource.getImportDeclarations().filter((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("text-input/runtime/"));
  const hasClockImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("text-input/runtime/text-input-clock"));
  if (!hasClockImport) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must compose text-input clock at the composition root." }));
  }
  for (const declaration of runtimeImports) {
    if (!(declaration.getModuleSpecifierValue() ?? "").includes("text-input/runtime/text-input-clock")) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must not import text-input runtime internals beyond clock composition." }));
    }
  }
  return findings;
}

function collectAdapterFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return !getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
    ? [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Text Input primitive adapter is missing." })]
    : [];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
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