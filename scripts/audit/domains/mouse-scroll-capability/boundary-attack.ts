import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();

  for (const importerPath of getExternalImportsWithPrefix(project, `${PATHS.ROOT}/runtime/`)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-scroll runtime internals." }));
  }

  for (const importerPath of getExternalImportsWithPrefix(project, `${PATHS.ROOT}/children/`)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-scroll child internals." }));
  }

  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH);
  if (!workbenchSource || !workbenchSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-scroll/runtime/mouse-scroll-execution-context"))) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must compose mouse-scroll execution context at the composition root." }));
  }

  if (!getSourceFile(project, PATHS.PRIMITIVE_ADAPTER)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.PRIMITIVE_ADAPTER, line: 1, severity: "fatal", message: "Mouse Scroll primitive adapter is missing." }));
  }

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