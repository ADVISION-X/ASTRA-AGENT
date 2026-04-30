import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getZodEnumValues, hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { hasIdentifier } from "../_shared/ast-literal-queries.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/orchestration";
const INDEX_PATH = `${ROOT}/index.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const MAP_SELECTION_GATE_PATH = `${ROOT}/runtime/map-selection-gate.ts`;
const RUNTIME_CONTEXT_PATH = `${ROOT}/runtime/orchestration-runtime-context.ts`;

const REQUIRED_CHILD_IDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "execute-map-step",
  "evaluate-step-transition",
  "request-human-review",
  "finalize-mission",
] as const;

const REQUIRED_RUNTIME_FILES = [
  "orchestration-clock.ts",
  "orchestration-idempotency.ts",
  "mission-state-store.ts",
  "mission-command-gate.ts",
  "map-selection-gate.ts",
  "map-validation-gate.ts",
  "transition-evaluator.ts",
  "loop-guard.ts",
  "step-dispatcher.ts",
  "orchestration-proof-builder.ts",
  "orchestration-result-builder.ts",
  "orchestration-dispatch-failure.ts",
  "orchestration-executor.ts",
] as const;

const REQUIRED_PORT_FILES = [
  "orchestration-clock-port.ts",
  "orchestration-state-port.ts",
  "orchestration-map-store-port.ts",
  "orchestration-idempotency-port.ts",
  "orchestration-nerve-bus-port.ts",
] as const;

const REQUIRED_SHARED_FILES = [
  "orchestration-map.ts",
  "orchestration-step.ts",
  "orchestration-transition.ts",
  "orchestration-result.ts",
  "orchestration-proof.ts",
  "orchestration-policy.ts",
  "orchestration-failure.ts",
] as const;

const REQUIRED_ROOT_FILES = [INDEX_PATH, ABILITY_GROUP_PATH, CONTRACT_PATH, SCHEMA_PATH, REGISTRY_PATH] as const;

const REQUIRED_PATHS = [
  ...REQUIRED_ROOT_FILES,
  ...REQUIRED_RUNTIME_FILES.map((fileName) => `${ROOT}/runtime/${fileName}`),
  ...REQUIRED_PORT_FILES.map((fileName) => `${ROOT}/ports/${fileName}`),
  ...REQUIRED_SHARED_FILES.map((fileName) => `${ROOT}/shared/${fileName}`),
  ...REQUIRED_CHILD_IDS.flatMap((childId) => [
    `${ROOT}/children/${childId}/contract.ts`,
    `${ROOT}/children/${childId}/schema.ts`,
    `${ROOT}/children/${childId}/implementation.ts`,
  ]),
] as const;

const LEGACY_FORBIDDEN_PATHS = [
  `${ROOT}/ability-roster.ts`,
  `${ROOT}/map-registry.ts`,
  `${ROOT}/mission-state.ts`,
  `${ROOT}/shared/branch-result.ts`,
  `${ROOT}/shared/map-types.ts`,
  `${ROOT}/shared/product-presence-branching-contract.ts`,
  `${ROOT}/shared/product-presence-branching.ts`,
  `${ROOT}/shared/transition-evaluator.ts`,
  `${ROOT}/maps/facebook-product-discovery/map.ts`,
  `${ROOT}/maps/facebook-product-discovery/map-check.ts`,
  `${ROOT}/maps/tiktok-product-discovery/map.ts`,
  `${ROOT}/maps/tiktok-product-discovery/map-check.ts`,
  `${ROOT}/bounded-local-runtime-execution/bootstrap.ts`,
  `${ROOT}/bounded-local-runtime-execution/executor.ts`,
  `${ROOT}/bounded-local-runtime-execution/runtime-local-ai-result.ts`,
  `${ROOT}/bounded-local-runtime-execution/state.ts`,
  `${ROOT}/bounded-local-runtime-execution/step-support.ts`,
] as const;

const REQUIRED_PUBLIC_METHODS = [
  "listChildCapabilityIds",
  "listMapIds",
  "execute",
  "startMission",
  "pauseMission",
  "resumeMission",
  "stopMission",
  "emergencyStop",
  "getMissionState",
  "executeMission",
  "submitReviewDecision",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "lib/browser/",
  "lib/local-ai/",
  "storage/evidence-store/",
  "features/" + "platform-action/",
] as const;

const FORBIDDEN_IDENTIFIER_NAMES = [
  "PlatformAdapter",
  "EvidenceStoreService",
  "MissionRuntimeExecutor",
  "OpenDrawer",
  "OpenAbilityGroup",
] as const;

const PRIVATE_ORCHESTRATION_SEGMENTS = ["/children/", "/maps/", "/runtime/", "/shared/", "/ports/"] as const;

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isPrivateOrchestrationPath(relativePath: string): boolean {
  return PRIVATE_ORCHESTRATION_SEGMENTS.some((segment) => relativePath.includes(segment));
}

export const orchestrationCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Orchestration Capability Owner Inspector",
  inspectorId: "orchestration-capability-owner",
  capabilityDomain: "orchestration-capability",
  inspectorEntry: "scripts/audit/domains/orchestration-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "orchestration-capability law exists but canonical commander root is not fully established yet",
  implementedSummary: "orchestration-capability is implemented as the canonical mission-command owner with governed maps, children, runtime, and Nerve Bus dispatch",
  extraChecks: async () => {
    const findings: Finding[] = [];
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const mapSelectionSource = getSourceFileOrThrow(project, MAP_SELECTION_GATE_PATH);
    const runtimeContextSource = getSourceFileOrThrow(project, RUNTIME_CONTEXT_PATH);

    const requiredPresence = await Promise.all(
      REQUIRED_PATHS.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })),
    );
    for (const check of requiredPresence) {
      if (!check.exists) {
        findings.push(createFinding({
          lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
          file: check.filePath,
          line: 1,
          severity: "fatal",
          message: "Required orchestration standard-package file is missing.",
        }));
      }
    }

    const legacyPresence = await Promise.all(
      LEGACY_FORBIDDEN_PATHS.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })),
    );
    for (const check of legacyPresence) {
      if (check.exists) {
        findings.push(createFinding({
          lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
          file: check.filePath,
          line: 1,
          severity: "fatal",
          message: "Legacy orchestration path still exists after the standard-package rebuild.",
        }));
      }
    }

    const publicMethodPass = REQUIRED_PUBLIC_METHODS.every((methodName) =>
      hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", methodName),
    );
    if (!publicMethodPass) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "error",
        message: "Orchestration public contract is missing one or more governed mission-control methods.",
      }));
    }

    const childIds = getZodEnumValues(schemaSource, "OrchestrationChildCapabilityIdSchema");
    if (!arraysEqual(childIds, REQUIRED_CHILD_IDS)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: "Orchestration child capability ids drifted away from the canonical child set.",
      }));
    }

    const schemaText = await readTextFile(pathFromRepoRoot(SCHEMA_PATH));
    const operationalMapIdPass = schemaText.includes("export const OperationalMapIdSchema = z.string().min(1);");
    if (!operationalMapIdPass) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: "Operational map id schema must stay dynamic and registry-backed under controlled map packages.",
      }));
    }

    const registrySourceText = await readTextFile(pathFromRepoRoot(REGISTRY_PATH));
    const mapSelectionText = await readTextFile(pathFromRepoRoot(MAP_SELECTION_GATE_PATH));
    const runtimeContextText = await readTextFile(pathFromRepoRoot(RUNTIME_CONTEXT_PATH));
    const registryPass = registrySourceText.includes("createOrchestrationCapabilityRegistry")
      && registrySourceText.includes("getOrchestrationRegistryEntry");
    if (!registryPass) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
        file: REGISTRY_PATH,
        line: 1,
        severity: "error",
        message: "Orchestration registry must expose canonical registry accessors.",
      }));
    }

    const indexSourceText = await readTextFile(pathFromRepoRoot(INDEX_PATH));
    const indexPass = !/export\s+\*\s+from\s+["']/.test(indexSourceText);
    if (!indexPass) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1",
        file: INDEX_PATH,
        line: 1,
        severity: "fatal",
        message: "Orchestration public index must not use export-star forwarding.",
      }));
    }

    const abilityGroupText = await readTextFile(pathFromRepoRoot(ABILITY_GROUP_PATH));
    const nerveBusPass = hasImportModuleSpecifier(abilityGroupSource, "../nerve-bus/")
      && hasCallExpressionPath(runtimeContextSource, ["nerveBus", "dispatchAbilityCommand"])
      && hasCallExpressionPath(runtimeContextSource, ["nerveBus", "requestAi"])
      && !abilityGroupText.includes("local-ai-decision")
      && !runtimeContextText.includes("local-ai-decision");
    if (!nerveBusPass) {
      findings.push(createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1",
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Orchestration ability-group must dispatch through Nerve Bus only and must not reference local-ai-decision.",
      }));
    }

    const orchestrationFiles = (await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] }))
      .map((filePath) => getSourceFileOrThrow(project, toRepoRelativePath(filePath)));
    let rootBoundaryPass = true;
    for (const sourceFile of orchestrationFiles) {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      for (const marker of FORBIDDEN_IMPORT_MARKERS) {
        if (hasImportModuleSpecifier(sourceFile, marker)) {
          rootBoundaryPass = false;
          findings.push(createFinding({
            lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1",
            file: relativePath,
            line: 1,
            severity: "fatal",
            message: "Orchestration must not import browser, local-ai, platform-action, or evidence-store owners directly.",
          }));
          break;
        }
      }

      for (const forbiddenIdentifier of FORBIDDEN_IDENTIFIER_NAMES) {
        if (hasIdentifier(sourceFile, forbiddenIdentifier)) {
          rootBoundaryPass = false;
          findings.push(createFinding({
            lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1",
            file: relativePath,
            line: 1,
            severity: "fatal",
            message: `Orchestration must not depend on retired owner ${forbiddenIdentifier}.`,
          }));
          break;
        }
      }
    }

    const srcFiles = (await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".tsx"] }))
      .map((filePath) => getSourceFileOrThrow(project, toRepoRelativePath(filePath)));
    let privateBoundaryPass = true;
    for (const sourceFile of srcFiles) {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath.startsWith(`${ROOT}/`)) {
        continue;
      }

      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const target = importDeclaration.getModuleSpecifierSourceFile();
        if (!target) {
          continue;
        }

        const targetPath = toRepoRelativePath(target.getFilePath());
        if (!targetPath.startsWith(`${ROOT}/`) || !isPrivateOrchestrationPath(targetPath)) {
          continue;
        }

        privateBoundaryPass = false;
        findings.push(createFinding({
          lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1",
          file: relativePath,
          line: importDeclaration.getStartLineNumber(),
          severity: "fatal",
          message: "External code must not import orchestration private maps, children, runtime, shared, or port internals.",
        }));
        break;
      }
    }

    const shapePass = requiredPresence.every((entry) => entry.exists)
      && legacyPresence.every((entry) => !entry.exists)
      && publicMethodPass;
    const dynamicMapTruthPass = operationalMapIdPass
      && hasCallExpressionPath(mapSelectionSource, ["input", "mapStore", "getActiveMapRecordByTaskTemplateId"])
      && hasCallExpressionPath(mapSelectionSource, ["input", "mapStore", "getActiveMapRecordByActivationId"])
      && !mapSelectionText.includes("resolvePreferredMapId")
      && !mapSelectionText.includes("platform_policy")
      && !mapSelectionText.includes("product-video-detection")
      && hasImportModuleSpecifier(runtimeContextSource, "map-plugin-registry")
      && runtimeContextText.includes("listActivePackages")
      && !runtimeContextText.includes("../maps/")
      && abilityGroupText.includes("getDefaultMapPluginRegistry")
      && abilityGroupText.includes("listActivePackages")
      && !abilityGroupText.includes("STATIC_MAP_IDS");

    const schemaPass = arraysEqual(childIds, REQUIRED_CHILD_IDS)
      && registryPass
      && dynamicMapTruthPass;

    return {
      findings,
      phases: [
        createPhase(
          "orchestration-standard-package-shape",
          shapePass ? "PASS" : "CODE VIOLATION",
          shapePass,
          shapePass
            ? "Orchestration root matches the standard package shape and old runtime files are gone."
            : "Orchestration root is missing required standard-package files or still contains legacy runtime paths.",
        ),
        createPhase(
          "orchestration-schema-registry-truth",
          schemaPass ? "PASS" : "CODE VIOLATION",
          schemaPass,
          schemaPass
            ? "Schema ids and runtime wiring match the canonical orchestration child set plus governed map package registry truth."
            : "Schema ids or registry truth drifted away from the canonical orchestration package.",
        ),
        createPhase(
          "orchestration-nerve-bus-boundary",
          nerveBusPass && indexPass && rootBoundaryPass ? "PASS" : "CODE VIOLATION",
          nerveBusPass && indexPass && rootBoundaryPass,
          nerveBusPass && indexPass && rootBoundaryPass
            ? "Ability-group dispatches through Nerve Bus only and orchestration root avoids forbidden owners."
            : "Orchestration still bypasses Nerve Bus, leaks local-ai-decision, reintroduces export-star forwarding, or imports forbidden owners.",
        ),
        createPhase(
          "orchestration-private-boundary",
          privateBoundaryPass ? "PASS" : "CODE VIOLATION",
          privateBoundaryPass,
          privateBoundaryPass
            ? "External code does not reach into orchestration private internals."
            : "External code still imports orchestration private maps, children, runtime, shared, or port internals.",
        ),
      ],
    };
  },
});
