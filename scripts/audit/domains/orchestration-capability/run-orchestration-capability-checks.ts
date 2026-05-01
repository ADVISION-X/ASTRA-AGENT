import { createFinding, createPhase, fileExists, listFilesRecursive, pathFromRepoRoot, readTextFile, toRepoRelativePath, type Finding } from "./inspection-core.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodEnumValues,
  hasIdentifier,
  hasCallExpressionPath,
  hasInterfaceMethod,
  hasImportModuleSpecifier,
} from "./inspection-ast-helpers.js";

import { ORCHESTRATION_REQUIRED_PATHS, orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { arraysEqual, isPrivateOrchestrationPath } from "./inspection-utils.js";

type PresenceEntry = { filePath: string; exists: boolean };
type OrchestrationSources = ReturnType<typeof loadOrchestrationSources>;
type PhaseCheck = { findings: Finding[]; passed: boolean };

const loadPresenceEntries = async (paths: readonly string[]): Promise<PresenceEntry[]> => {
  return Promise.all(paths.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })));
};

const loadOrchestrationSources = () => {
  const project = createAuditProject();
  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const mapSelectionSource = getSourceFileOrThrow(project, config.MAP_SELECTION_GATE_PATH);
  const runtimeContextSource = getSourceFileOrThrow(project, config.RUNTIME_CONTEXT_PATH);
  return { project, contractSource, schemaSource, abilityGroupSource, mapSelectionSource, runtimeContextSource };
};

const getMissingRequiredPathFindings = (entries: PresenceEntry[]): Finding[] => {
  return entries.flatMap((entry) => {
    return entry.exists
      ? []
      : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: entry.filePath, line: 1, severity: "fatal", message: "Required orchestration standard-package file is missing." })];
  });
};

const getLegacyPathFindings = (entries: PresenceEntry[]): Finding[] => {
  return entries.flatMap((entry) => {
    return entry.exists
      ? [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: entry.filePath, line: 1, severity: "fatal", message: "Legacy orchestration path still exists after the standard-package rebuild." })]
      : [];
  });
};

const hasRequiredPublicMethods = (contractSource: import("ts-morph").SourceFile): boolean => {
  return config.REQUIRED_PUBLIC_METHODS.every((methodName) => hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", methodName));
};

const inspectStandardPackageShape = async (sources: OrchestrationSources): Promise<PhaseCheck> => {
  const requiredPresence = await loadPresenceEntries(ORCHESTRATION_REQUIRED_PATHS);
  const legacyPresence = await loadPresenceEntries(config.LEGACY_FORBIDDEN_PATHS);
  const publicMethodPass = hasRequiredPublicMethods(sources.contractSource);
  const findings = [
    ...getMissingRequiredPathFindings(requiredPresence),
    ...getLegacyPathFindings(legacyPresence),
    ...(
      publicMethodPass
        ? []
        : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.CONTRACT_PATH, line: 1, severity: "error", message: "Orchestration public contract is missing one or more governed mission-control methods." })]
    ),
  ];

  return {
    findings,
    passed: requiredPresence.every((entry) => entry.exists) && legacyPresence.every((entry) => !entry.exists) && publicMethodPass,
  };
};

const hasDynamicMapTruth = (input: {
  abilityGroupText: string;
  mapSelectionText: string;
  runtimeContextText: string;
  mapSelectionSource: import("ts-morph").SourceFile;
  runtimeContextSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasMapSelectionLookupTruth(input)
    && hasRuntimeContextMapRegistryTruth(input)
    && hasAbilityGroupMapRegistryTruth(input.abilityGroupText);
};

const hasMapSelectionLookupTruth = (input: {
  mapSelectionText: string;
  mapSelectionSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasCallExpressionPath(input.mapSelectionSource, ["input", "mapStore", "getActiveMapRecordByTaskTemplateId"])
    && hasCallExpressionPath(input.mapSelectionSource, ["input", "mapStore", "getActiveMapRecordByActivationId"])
    && !input.mapSelectionText.includes("resolvePreferredMapId")
    && !input.mapSelectionText.includes("platform_policy")
    && !input.mapSelectionText.includes("product-video-detection");
};

const hasRuntimeContextMapRegistryTruth = (input: {
  runtimeContextText: string;
  runtimeContextSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasImportModuleSpecifier(input.runtimeContextSource, "map-plugin-registry")
    && input.runtimeContextText.includes("listActivePackages")
    && !input.runtimeContextText.includes("../maps/");
};

const hasAbilityGroupMapRegistryTruth = (abilityGroupText: string): boolean => {
  return abilityGroupText.includes("getDefaultMapPluginRegistry")
    && abilityGroupText.includes("listActivePackages")
    && !abilityGroupText.includes("STATIC_MAP_IDS");
};

const inspectSchemaRegistryTruth = async (sources: OrchestrationSources): Promise<PhaseCheck> => {
  const childIds = getZodEnumValues(sources.schemaSource, "OrchestrationChildCapabilityIdSchema");
  const schemaText = await readTextFile(pathFromRepoRoot(config.SCHEMA_PATH));
  const registrySourceText = await readTextFile(pathFromRepoRoot(config.REGISTRY_PATH));
  const mapSelectionText = await readTextFile(pathFromRepoRoot(config.MAP_SELECTION_GATE_PATH));
  const runtimeContextText = await readTextFile(pathFromRepoRoot(config.RUNTIME_CONTEXT_PATH));
  const abilityGroupText = await readTextFile(pathFromRepoRoot(config.ABILITY_GROUP_PATH));
  const operationalMapIdPass = schemaText.includes("export const OperationalMapIdSchema = z.string().min(1);");
  const registryPass = registrySourceText.includes("createOrchestrationCapabilityRegistry") && registrySourceText.includes("getOrchestrationRegistryEntry");
  const dynamicMapTruthPass = hasDynamicMapTruth({ abilityGroupText, mapSelectionText, runtimeContextText, mapSelectionSource: sources.mapSelectionSource, runtimeContextSource: sources.runtimeContextSource });
  const findings = [
    ...(arraysEqual(childIds, config.REQUIRED_CHILD_IDS) ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Orchestration child capability ids drifted away from the canonical child set." })]),
    ...(operationalMapIdPass ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Operational map id schema must stay dynamic and registry-backed under controlled map packages." })]),
    ...(registryPass ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.REGISTRY_PATH, line: 1, severity: "error", message: "Orchestration registry must expose canonical registry accessors." })]),
  ];

  return { findings, passed: arraysEqual(childIds, config.REQUIRED_CHILD_IDS) && registryPass && dynamicMapTruthPass && operationalMapIdPass };
};

const inspectRootBoundary = async (project: ReturnType<typeof createAuditProject>): Promise<PhaseCheck> => {
  const orchestrationFiles = (await listFilesRecursive(pathFromRepoRoot(config.ROOT), { extensions: [".ts"] })).map((filePath) => getSourceFileOrThrow(project, toRepoRelativePath(filePath)));
  const findings: Finding[] = [];

  for (const sourceFile of orchestrationFiles) {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    for (const marker of config.FORBIDDEN_IMPORT_MARKERS) {
      if (hasImportModuleSpecifier(sourceFile, marker)) {
        findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: "Orchestration must not import browser, local-ai, platform-action, or evidence-store owners directly." }));
        break;
      }
    }

    for (const forbiddenIdentifier of config.FORBIDDEN_IDENTIFIER_NAMES) {
      if (hasIdentifier(sourceFile, forbiddenIdentifier)) {
        findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: `Orchestration must not depend on retired owner ${forbiddenIdentifier}.` }));
        break;
      }
    }
  }

  return { findings, passed: findings.length === 0 };
};

const getPrivateBoundaryFinding = (relativePath: string, importDeclaration: import("ts-morph").ImportDeclaration): Finding | null => {
  const target = importDeclaration.getModuleSpecifierSourceFile();
  if (!target) {
    return null;
  }

  const targetPath = toRepoRelativePath(target.getFilePath());
  return targetPath.startsWith(`${config.ROOT}/`) && isPrivateOrchestrationPath(targetPath)
    ? createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: relativePath, line: importDeclaration.getStartLineNumber(), severity: "fatal", message: "External code must not import orchestration private maps, children, runtime, shared, or port internals." })
    : null;
};

const collectSourcePrivateBoundaryFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  const relativePath = toRepoRelativePath(sourceFile.getFilePath());
  if (relativePath.startsWith(`${config.ROOT}/`)) {
    return [];
  }

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const finding = getPrivateBoundaryFinding(relativePath, importDeclaration);
    if (finding) {
      return [finding];
    }
  }

  return [];
};

const inspectPrivateBoundary = async (project: ReturnType<typeof createAuditProject>): Promise<PhaseCheck> => {
  const srcFiles = (await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".tsx"] })).map((filePath) => getSourceFileOrThrow(project, toRepoRelativePath(filePath)));
  const findings = srcFiles.flatMap((sourceFile) => collectSourcePrivateBoundaryFindings(sourceFile));

  return { findings, passed: findings.length === 0 };
};

const hasNerveBusBoundary = (input: {
  abilityGroupText: string;
  runtimeContextText: string;
  abilityGroupSource: import("ts-morph").SourceFile;
  runtimeContextSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasImportModuleSpecifier(input.abilityGroupSource, "../nerve-bus/")
    && hasCallExpressionPath(input.runtimeContextSource, ["nerveBus", "dispatchAbilityCommand"])
    && hasCallExpressionPath(input.runtimeContextSource, ["nerveBus", "requestAi"])
    && !input.abilityGroupText.includes("local-ai-decision")
    && !input.runtimeContextText.includes("local-ai-decision");
};

const getIndexBoundaryFindings = (indexPass: boolean): Finding[] => {
  return indexPass
    ? []
    : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: config.INDEX_PATH, line: 1, severity: "fatal", message: "Orchestration public index must not use export-star forwarding." })];
};

const getNerveBusBoundaryFindings = (nerveBusPass: boolean): Finding[] => {
  return nerveBusPass
    ? []
    : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: config.ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Orchestration ability-group must dispatch through Nerve Bus only and must not reference local-ai-decision." })];
};

const inspectNerveBusBoundary = async (sources: OrchestrationSources): Promise<PhaseCheck> => {
  const indexSourceText = await readTextFile(pathFromRepoRoot(config.INDEX_PATH));
  const abilityGroupText = await readTextFile(pathFromRepoRoot(config.ABILITY_GROUP_PATH));
  const runtimeContextText = await readTextFile(pathFromRepoRoot(config.RUNTIME_CONTEXT_PATH));
  const rootBoundary = await inspectRootBoundary(sources.project);
  const indexPass = !/export\s+\*\s+from\s+["']/.test(indexSourceText);
  const nerveBusPass = hasNerveBusBoundary({ abilityGroupText, runtimeContextText, abilityGroupSource: sources.abilityGroupSource, runtimeContextSource: sources.runtimeContextSource });
  const findings = [
    ...getIndexBoundaryFindings(indexPass),
    ...getNerveBusBoundaryFindings(nerveBusPass),
    ...rootBoundary.findings,
  ];

  return { findings, passed: indexPass && nerveBusPass && rootBoundary.passed };
};

const createOrchestrationPhase = (name: string, passed: boolean, passMessage: string, failMessage: string) => {
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passMessage : failMessage);
};

const buildOrchestrationPhases = (input: {
  shape: PhaseCheck;
  schema: PhaseCheck;
  nerveBus: PhaseCheck;
  privateBoundary: PhaseCheck;
}) => {
  return [
    createOrchestrationPhase("orchestration-standard-package-shape", input.shape.passed, "Orchestration root matches the standard package shape and old runtime files are gone.", "Orchestration root is missing required standard-package files or still contains legacy runtime paths."),
    createOrchestrationPhase("orchestration-schema-registry-truth", input.schema.passed, "Schema ids and runtime wiring match the canonical orchestration child set plus governed map package registry truth.", "Schema ids or registry truth drifted away from the canonical orchestration package."),
    createOrchestrationPhase("orchestration-nerve-bus-boundary", input.nerveBus.passed, "Ability-group dispatches through Nerve Bus only and orchestration root avoids forbidden owners.", "Orchestration still bypasses Nerve Bus, leaks local-ai-decision, reintroduces export-star forwarding, or imports forbidden owners."),
    createOrchestrationPhase("orchestration-private-boundary", input.privateBoundary.passed, "External code does not reach into orchestration private internals.", "External code still imports orchestration private maps, children, runtime, shared, or port internals."),
  ];
};

export const runOrchestrationCapabilityChecks = async () => {
  const sources = loadOrchestrationSources();
  const phaseChecks = await Promise.all([
    inspectStandardPackageShape(sources),
    inspectSchemaRegistryTruth(sources),
    inspectNerveBusBoundary(sources),
    inspectPrivateBoundary(sources.project),
  ]);
  const [shape, schema, nerveBus, privateBoundary] = phaseChecks;

  return {
    findings: [...shape.findings, ...schema.findings, ...nerveBus.findings, ...privateBoundary.findings],
    phases: buildOrchestrationPhases({ shape, schema, nerveBus, privateBoundary }),
  };
};