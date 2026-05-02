import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";

function collectBoundaryLeaks(project: ReturnType<typeof makeProject>, prefix: string, message: string): Finding[] {
  return getExternalImportsWithPrefix(project, prefix)
    .map((file) => createFinding({ lawId: LAW_IDS.EXECUTION, file, line: 1, severity: "fatal", message }));
}

function collectWorkbenchFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const workbenchRuntimeSource = getSourceFile(project, PATHS.WORKBENCH_RUNTIME);
  if (!workbenchRuntimeSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench mouse-scroll runtime must compose the governed ability group with the primitive adapter at the composition root." })];
  }

  return hasCallExpression(workbenchRuntimeSource, "createWorkbenchMouseScrollAbilityGroup")
    && hasCallExpression(workbenchRuntimeSource, "createBrowserControllerMouseScrollPrimitivePort")
    ? []
    : [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_RUNTIME, line: 1, severity: "fatal", message: "Workbench mouse-scroll runtime must compose the governed ability group with the primitive adapter at the composition root." })];
}

function collectWorkbenchAbilityGroupFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const workbenchAbilityGroupSource = getSourceFile(project, PATHS.WORKBENCH_ABILITY_GROUP);
  if (!workbenchAbilityGroupSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_ABILITY_GROUP, line: 1, severity: "fatal", message: "Workbench mouse-scroll wrapper must route through the public mouse-scroll factory." })];
  }

  return hasCallExpression(workbenchAbilityGroupSource, "createMouseScrollAbilityGroupWithPrimitivePort")
    ? []
    : [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_ABILITY_GROUP, line: 1, severity: "fatal", message: "Workbench mouse-scroll wrapper must route through the public mouse-scroll factory." })];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectBoundaryLeaks(project, `${PATHS.ROOT}/runtime/`, "External code must not import mouse-scroll runtime internals."),
    ...collectBoundaryLeaks(project, `${PATHS.ROOT}/children/`, "External code must not import mouse-scroll child internals."),
    ...collectWorkbenchFindings(project),
    ...collectWorkbenchAbilityGroupFindings(project),
    ...(getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)
      ? []
      : [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Mouse Scroll primitive adapter is missing." })]),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll runtime and child internals stay behind the owning boundary and composition root."
        : "Mouse Scroll still leaks private runtime or child boundaries.",
    ),
  };
}