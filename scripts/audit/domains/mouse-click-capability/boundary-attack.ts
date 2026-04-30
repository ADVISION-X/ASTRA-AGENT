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
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-click runtime internals." }));
  }

  const childLeaks = getExternalImportsWithPrefix(project, `${ROOT}/children/`);
  for (const importerPath of childLeaks) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-click child internals." }));
  }

  const workbenchSource = getSourceFile(project, WORKBENCH_PATH);
  if (!workbenchSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose mouse-click clock and idempotency at the composition root." }));
  } else {
    const runtimeImports = workbenchSource.getImportDeclarations().filter((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/"));
    const hasClockImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/mouse-click-clock"));
    const hasIdempotencyImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/mouse-click-idempotency"));

    if (!hasClockImport || !hasIdempotencyImport) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose mouse-click clock and idempotency at the composition root." }));
    }

    for (const declaration of runtimeImports) {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      const allowed = specifier.includes("mouse-click/runtime/mouse-click-clock") || specifier.includes("mouse-click/runtime/mouse-click-idempotency");
      if (!allowed) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must not import mouse-click runtime internals beyond clock and idempotency composition." }));
      }
    }
  }

  const primitiveAdapterSource = getSourceFile(project, PRIMITIVE_ADAPTER_PATH);
  if (!primitiveAdapterSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PRIMITIVE_ADAPTER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive adapter is missing." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Mouse Click runtime and child internals stay behind the owning boundary and composition root."
        : "Mouse Click still leaks private runtime or child boundaries.",
    ),
  };
}
