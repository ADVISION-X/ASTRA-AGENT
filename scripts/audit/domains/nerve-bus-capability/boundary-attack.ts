import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  CHANNELS_ROOT,
  ORCHESTRATION_PATH,
  ROOT,
  WORKBENCH_PATH,
  getExternalImportsWithPrefix,
  getSourceFile,
  makeProject,
} from "./ast-utils.js";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();

  for (const targetPrefix of [`${ROOT}/runtime/`, `${ROOT}/children/`, `${ROOT}/ports/`]) {
    const leaks = getExternalImportsWithPrefix(project, targetPrefix);
    for (const importerPath of leaks) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: importerPath, line: 1, severity: "fatal", message: `External code must not import ${targetPrefix} internals.` }));
    }
  }

  const workbenchSource = getSourceFile(project, WORKBENCH_PATH);
  if (!workbenchSource || !workbenchSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("capabilities/nerve-bus/index"))) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must consume Nerve Bus through the public index." }));
  }

  const orchestrationSource = getSourceFile(project, ORCHESTRATION_PATH);
  if (!orchestrationSource || !orchestrationSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("../nerve-bus/index"))) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: ORCHESTRATION_PATH, line: 1, severity: "fatal", message: "Orchestration must consume Nerve Bus through the public index." }));
  }

  const channelImplementations = project.getSourceFiles().filter((sourceFile) => sourceFile.getFilePath().includes("/src/capabilities/nerve-bus/channels/"));
  if (channelImplementations.length > 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: CHANNELS_ROOT, line: 1, severity: "fatal", message: "Nerve Bus channels/ must not become a second implementation root." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Nerve Bus runtime, child, and port internals stay behind the owning public boundary."
        : "Nerve Bus still leaks private transport internals or retains a second implementation root.",
    ),
  };
}