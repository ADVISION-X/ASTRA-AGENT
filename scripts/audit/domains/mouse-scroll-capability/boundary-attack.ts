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

  for (const importerPath of getExternalImportsWithPrefix(project, `${ROOT}/runtime/`)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-scroll runtime internals." }));
  }

  for (const importerPath of getExternalImportsWithPrefix(project, `${ROOT}/children/`)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: "External code must not import mouse-scroll child internals." }));
  }

  const workbenchSource = getSourceFile(project, WORKBENCH_PATH);
  if (!workbenchSource || !workbenchSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("mouse-scroll/runtime/mouse-scroll-execution-context"))) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose mouse-scroll execution context at the composition root." }));
  }

  if (!getSourceFile(project, PRIMITIVE_ADAPTER_PATH)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: PRIMITIVE_ADAPTER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive adapter is missing." }));
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