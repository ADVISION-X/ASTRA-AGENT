import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  PRIMITIVE_ADAPTER_PATH,
  ROOT,
  WORKBENCH_PATH,
  getExternalImportsWithPrefix,
  getSourceFile,
  makeProject,
} from "./ast-utils.js";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();

  const runtimeLeaks = getExternalImportsWithPrefix(project, `${ROOT}/runtime/`).filter((importerPath) => importerPath !== WORKBENCH_PATH);
  for (const importerPath of runtimeLeaks) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import text-input runtime internals." }));
  }

  const childLeaks = getExternalImportsWithPrefix(project, `${ROOT}/children/`);
  for (const importerPath of childLeaks) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import text-input child internals." }));
  }

  const workbenchSource = getSourceFile(project, WORKBENCH_PATH);
  if (!workbenchSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose text-input clock at the composition root." }));
  } else {
    const runtimeImports = workbenchSource.getImportDeclarations().filter((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("text-input/runtime/"));
    const hasClockImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("text-input/runtime/text-input-clock"));
    if (!hasClockImport) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose text-input clock at the composition root." }));
    }

    for (const declaration of runtimeImports) {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      if (!specifier.includes("text-input/runtime/text-input-clock")) {
        findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must not import text-input runtime internals beyond clock composition." }));
      }
    }
  }

  const primitiveAdapterSource = getSourceFile(project, PRIMITIVE_ADAPTER_PATH);
  if (!primitiveAdapterSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: PRIMITIVE_ADAPTER_PATH, line: 1, severity: "fatal", message: "Text Input primitive adapter is missing." }));
  }

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