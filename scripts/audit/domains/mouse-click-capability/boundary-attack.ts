import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./audit-project.js";
import { PATHS } from "./config.js";

function collectBoundaryLeaks(project: ReturnType<typeof makeProject>, prefix: string, message: string, excludedPath?: string): Finding[] {
  return getExternalImportsWithPrefix(project, prefix)
    .filter((filePath) => filePath !== excludedPath)
    .map((file) => createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V1", file, line: 1, severity: "fatal", message }));
}

function collectWorkbenchFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH_RUNTIME);
  if (!workbenchSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench mouse-click runtime must compose the governed ability group with the primitive adapter at the composition root." })];
  }

  return hasCallExpression(workbenchSource, "createWorkbenchMouseClickAbilityGroup")
    && hasCallExpression(workbenchSource, "createBrowserControllerMouseClickPrimitivePort")
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench mouse-click runtime must compose the governed ability group with the primitive adapter at the composition root." })];
}

function collectPrimitiveAdapterFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Mouse Click primitive adapter is missing." })];
}

export function runBoundaryAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectBoundaryLeaks(project, `${PATHS.ROOT}/runtime/`, "External code must not import mouse-click runtime internals.", PATHS.WORKBENCH_RUNTIME),
    ...collectBoundaryLeaks(project, `${PATHS.ROOT}/children/`, "External code must not import mouse-click child internals."),
    ...collectWorkbenchFindings(project),
    ...collectPrimitiveAdapterFindings(project),
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
