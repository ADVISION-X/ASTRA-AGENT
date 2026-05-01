import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";

function collectInternalLeakFindings(): Finding[] {
  const findings: Finding[] = [];
  const project = makeProject();
  for (const targetPrefix of [`${PATHS.ROOT}/runtime/`, `${PATHS.ROOT}/children/`, `${PATHS.ROOT}/ports/`]) {
    for (const importerPath of getExternalImportsWithPrefix(project, targetPrefix)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: importerPath, line: 1, severity: "fatal", message: `External code must not import ${targetPrefix} internals.` }));
    }
  }
  return findings;
}

function collectConsumerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const workbenchSource = getSourceFile(project, PATHS.WORKBENCH);
  if (!workbenchSource || !workbenchSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("capabilities/nerve-bus/index"))) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.WORKBENCH, line: 1, severity: "fatal", message: "Workbench must consume Nerve Bus through the public index." }));
  }
  const orchestrationSource = getSourceFile(project, PATHS.ORCHESTRATION);
  return !orchestrationSource || !orchestrationSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("../nerve-bus/index"))
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ORCHESTRATION, line: 1, severity: "fatal", message: "Orchestration must consume Nerve Bus through the public index." }))
    : findings;
}

function collectChannelRootFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const channelImplementations = project.getSourceFiles().filter((sourceFile) => sourceFile.getFilePath().includes("/src/capabilities/nerve-bus/channels/"));
  return channelImplementations.length > 0
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CHANNELS_ROOT, line: 1, severity: "fatal", message: "Nerve Bus channels/ must not become a second implementation root." })]
    : [];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectInternalLeakFindings(),
    ...collectConsumerFindings(project),
    ...collectChannelRootFindings(project),
  ];

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