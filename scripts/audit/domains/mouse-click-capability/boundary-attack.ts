import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./audit-project.js";
import { PATHS } from "./config.js";

function collectBoundaryLeaks(prefix: string, message: string, excludedPath?: string): Finding[] {
  const project = makeProject();
  return getExternalImportsWithPrefix(project, prefix)
    .filter((filePath) => filePath !== excludedPath)
    .map((file) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file, line: 1, severity: "fatal", message }));
}

function collectWorkbenchFindings(): Finding[] {
  const project = makeProject();
  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH);
  if (!workbenchSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must compose mouse-click clock and idempotency at the composition root." })];
  }

  const runtimeImports = workbenchSource.getImportDeclarations().filter((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/"));
  const hasClockImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/mouse-click-clock"));
  const hasIdempotencyImport = runtimeImports.some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-click/runtime/mouse-click-idempotency"));
  return hasClockImport && hasIdempotencyImport
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must compose mouse-click clock and idempotency at the composition root." })];
}

function collectPrimitiveAdapterFindings(): Finding[] {
  return getSourceFile(makeProject(), PATHS.PRIMITIVE_ADAPTER)
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Mouse Click primitive adapter is missing." })];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectBoundaryLeaks(`${PATHS.ROOT}/runtime/`, "External code must not import mouse-click runtime internals.", PATHS.WORKBENCH),
    ...collectBoundaryLeaks(`${PATHS.ROOT}/children/`, "External code must not import mouse-click child internals."),
    ...collectWorkbenchFindings(),
    ...collectPrimitiveAdapterFindings(),
  ];

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
