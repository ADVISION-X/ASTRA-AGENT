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
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";

import { ORCHESTRATION_REQUIRED_PATHS, orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { arraysEqual, isPrivateOrchestrationPath } from "./inspection-utils.js";

type PresenceEntry = { filePath: string; exists: boolean };
type OrchestrationSources = ReturnType<typeof loadOrchestrationSources>;
type PhaseCheck = { findings: Finding[]; passed: boolean };

const ROUND_MISSION_PACKET_DISPATCH_PATH = "src/capabilities/orchestration/runtime/visual-mission-ai-dispatch-context.ts";

const loadPresenceEntries = async (paths: readonly string[]): Promise<PresenceEntry[]> => {
  return Promise.all(paths.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })));
};

const loadOrchestrationSources = (project: ReturnType<typeof createAuditProject>) => {
  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const runtimePlanResolutionSource = getSourceFileOrThrow(project, config.RUNTIME_PLAN_RESOLUTION_GATE_PATH);
  const runtimeContextSource = getSourceFileOrThrow(project, config.RUNTIME_CONTEXT_PATH);
  return { project, contractSource, schemaSource, abilityGroupSource, runtimePlanResolutionSource, runtimeContextSource };
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
  runtimePlanResolutionText: string;
  runtimeContextText: string;
  runtimePlanResolutionSource: import("ts-morph").SourceFile;
  runtimeContextSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasRuntimePlanResolutionTruth(input)
    && hasRuntimeContextRuntimePlanStoreTruth(input)
    && hasAbilityGroupRuntimePlanStoreTruth(input.abilityGroupText);
};

const hasRuntimePlanResolutionTruth = (input: {
  runtimePlanResolutionText: string;
  runtimePlanResolutionSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasIdentifier(input.runtimePlanResolutionSource, "resolveRuntimePlan")
    && input.runtimePlanResolutionText.includes("userRequirementText")
    && input.runtimePlanResolutionText.includes("selectedPlatforms")
    && !input.runtimePlanResolutionText.includes("platform_policy")
    && !input.runtimePlanResolutionText.includes("product-video-detection");
};

const hasRuntimeContextRuntimePlanStoreTruth = (input: {
  runtimeContextText: string;
  runtimeContextSource: import("ts-morph").SourceFile;
}): boolean => {
  return hasImportModuleSpecifier(input.runtimeContextSource, "orchestration-runtime-plan-store-port")
    && input.runtimeContextText.includes("OrchestrationRuntimePlanStorePort")
    && !input.runtimeContextText.includes("../maps/");
};

const hasAbilityGroupRuntimePlanStoreTruth = (abilityGroupText: string): boolean => {
  return abilityGroupText.includes("createDefaultOrchestrationRuntimePlanStore")
    && !abilityGroupText.includes("STATIC_MAP_IDS");
};

const RUNTIME_CONTROL_REQUIRED_FIELDS = ["promptContractVersion", "capabilityCatalogVersion"] as const;
const RUNTIME_PLAN_ID_SCHEMA_LINE = ["export const ", ["Runtime", "Plan", "IdSchema"].join(""), " = z.string().min(1);"] .join("");

type SchemaRegistryTruthFacts = {
  childIds: string[];
  runtimePlanIdPass: boolean;
  registryPass: boolean;
  dynamicMapTruthPass: boolean;
  roundMissionPacketTruthPass: boolean;
  runtimeControlMissing: string[];
};

const loadSchemaRegistryTruthFacts = async (sources: OrchestrationSources): Promise<SchemaRegistryTruthFacts> => {
  const childIds = getZodEnumValues(sources.schemaSource, "OrchestrationChildCapabilityIdSchema");
  const runtimeProofFields = getZodObjectPropertyNames(sources.schemaSource, "RuntimeProofSchema");
  const schemaText = await readTextFile(pathFromRepoRoot(config.SCHEMA_PATH));
  const registrySourceText = await readTextFile(pathFromRepoRoot(config.REGISTRY_PATH));
  const runtimePlanResolutionText = await readTextFile(pathFromRepoRoot(config.RUNTIME_PLAN_RESOLUTION_GATE_PATH));
  const runtimeContextText = await readTextFile(pathFromRepoRoot(config.RUNTIME_CONTEXT_PATH));
  const roundMissionPacketDispatchText = await readTextFile(pathFromRepoRoot(ROUND_MISSION_PACKET_DISPATCH_PATH));
  const abilityGroupText = await readTextFile(pathFromRepoRoot(config.ABILITY_GROUP_PATH));
  const runtimePlanIdPass = schemaText.includes(RUNTIME_PLAN_ID_SCHEMA_LINE);
  const registryPass = registrySourceText.includes("createOrchestrationCapabilityRegistry") && registrySourceText.includes("getOrchestrationRegistryEntry");
  const dynamicMapTruthPass = hasDynamicMapTruth({
    abilityGroupText,
    runtimePlanResolutionText,
    runtimeContextText,
    runtimePlanResolutionSource: sources.runtimePlanResolutionSource,
    runtimeContextSource: sources.runtimeContextSource,
  });
  const roundMissionPacketTruthPass = roundMissionPacketDispatchText.includes("buildRoundMissionPacket(")
    && roundMissionPacketDispatchText.includes("recordRoundMissionPacket(")
    && roundMissionPacketDispatchText.includes("roundMissionPacketJson")
    && roundMissionPacketDispatchText.includes("roundMissionPacketRef");
  const runtimeControlMissing = RUNTIME_CONTROL_REQUIRED_FIELDS.filter((fieldName) => !runtimeProofFields.has(fieldName));

  return {
    childIds,
    runtimePlanIdPass,
    registryPass,
    dynamicMapTruthPass,
    roundMissionPacketTruthPass,
    runtimeControlMissing,
  };
};

const buildSchemaRegistryTruthFindings = (facts: SchemaRegistryTruthFacts): Finding[] => {
  return [
    ...(arraysEqual(facts.childIds, config.REQUIRED_CHILD_IDS) ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Orchestration child capability ids drifted away from the canonical child set." })]),
    ...(facts.runtimePlanIdPass ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Runtime plan id schema must stay governed under the runtime-plan contract." })]),
    ...(facts.registryPass ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.REGISTRY_PATH, line: 1, severity: "error", message: "Orchestration registry must expose canonical registry accessors." })]),
    ...(facts.roundMissionPacketTruthPass ? [] : [createFinding({ lawId: "GRASSEYE-ROUND-MISSION-PACKET-V1", file: ROUND_MISSION_PACKET_DISPATCH_PATH, line: 1, severity: "error", message: "Orchestration must build, record, and inject Round Mission Packet refs before the Visual Mission AI request." })]),
    ...(facts.runtimeControlMissing.length === 0 ? [] : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Orchestration runtime proof is missing governed runtime control fields.", detail: facts.runtimeControlMissing.join(", ") })]),
  ];
};

const inspectSchemaRegistryTruth = async (sources: OrchestrationSources): Promise<PhaseCheck> => {
  const facts = await loadSchemaRegistryTruthFacts(sources);
  const findings = buildSchemaRegistryTruthFindings(facts);

  return {
    findings,
    passed: facts.childIds.length > 0
      && facts.dynamicMapTruthPass
      && facts.runtimePlanIdPass
      && facts.registryPass
      && facts.roundMissionPacketTruthPass
      && facts.runtimeControlMissing.length === 0
      && arraysEqual(facts.childIds, config.REQUIRED_CHILD_IDS),
  };
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

export const runOrchestrationCapabilityChecks = async (project: ReturnType<typeof createAuditProject>) => {
  const sources = loadOrchestrationSources(project);
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