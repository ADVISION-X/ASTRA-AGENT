import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { createAuditProject, getSourceFileOrThrow, hasInterfaceMethod } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/orchestration";
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const MAP_REGISTRY_PATH = `${ROOT}/map-registry.ts`;
const ROSTER_PATH = `${ROOT}/ability-roster.ts`;
const FACEBOOK_MAP_PATH = `${ROOT}/maps/facebook-product-discovery/map.ts`;
const TIKTOK_MAP_PATH = `${ROOT}/maps/tiktok-product-discovery/map.ts`;

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  MAP_REGISTRY_PATH,
  ROSTER_PATH,
  FACEBOOK_MAP_PATH,
  TIKTOK_MAP_PATH,
] as const;

const FORBIDDEN_ROOT_IMPORTS = [
  "lib/browser/",
  "lib/local-ai/",
  "features/platform-action/",
  "children/",
  "implementation.ts",
] as const;

const FORBIDDEN_TARGET_CHILDREN = [
  'targetAbilityGroupId: "open-facebook"',
  'targetAbilityGroupId: "open-tiktok"',
  'targetAbilityGroupId: "click-left-point"',
  'targetAbilityGroupId: "vertical-wheel-scroll"',
] as const;

export default createPendingDomainInspector({
  inspector: "GrassEye Orchestration Capability Owner Inspector",
  inspectorId: "orchestration-capability-owner",
  capabilityDomain: "orchestration-capability",
  inspectorEntry: "scripts/audit/domains/orchestration-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "orchestration-capability law exists but canonical commander root is not fully established yet",
  implementedSummary: "orchestration-capability is implemented as the canonical mission-command owner with governed maps and Nerve Bus dispatch",
  extraChecks: async () => {
    const findings: Finding[] = [];
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const requiredPresence = await Promise.all(
      REQUIRED_FILES.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })),
    );
    for (const check of requiredPresence) {
      if (!check.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: check.filePath, line: 1, severity: "fatal", message: "Required Orchestration owner file is missing." }));
      }
    }

    const [abilityGroupSource, mapRegistrySource, rosterSource, facebookMapSource, tiktokMapSource] = await Promise.all([
      readTextFile(pathFromRepoRoot(ABILITY_GROUP_PATH)),
      readTextFile(pathFromRepoRoot(MAP_REGISTRY_PATH)),
      readTextFile(pathFromRepoRoot(ROSTER_PATH)),
      readTextFile(pathFromRepoRoot(FACEBOOK_MAP_PATH)),
      readTextFile(pathFromRepoRoot(TIKTOK_MAP_PATH)),
    ]);
    const rootFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const srcFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".tsx"] });
    const rootFileSources = await Promise.all(rootFiles.map(async (filePath) => ({ relativePath: toRepoRelativePath(filePath), source: await readTextFile(filePath) })));
    const srcFileSources = await Promise.all(srcFiles.map(async (filePath) => ({ relativePath: toRepoRelativePath(filePath), source: await readTextFile(filePath) })));

    const usesNerveBusBoundary = abilityGroupSource.includes("../nerve-bus/")
      && abilityGroupSource.includes("requestAi(")
      && abilityGroupSource.includes("dispatchAbilityCommand(");
    if (!usesNerveBusBoundary) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "error", message: "Orchestration ability group must dispatch through the Nerve Bus public interface." }));
    }

    const forbiddenImports = rootFileSources.flatMap((entry) =>
      FORBIDDEN_ROOT_IMPORTS.some((marker) => entry.source.includes(marker)) ? [entry.relativePath] : []);
    if (forbiddenImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1", file: forbiddenImports[0]!, line: 1, severity: "fatal", message: "Orchestration root must not import browser, local-ai, platform-action, or child implementation surfaces." }));
    }

    const mapRegistryPassed = mapRegistrySource.includes("facebookProductDiscoveryMap")
      && mapRegistrySource.includes("tiktokProductDiscoveryMap")
      && rosterSource.includes("forensics-persistence");
    if (!mapRegistryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: MAP_REGISTRY_PATH, line: 1, severity: "error", message: "Orchestration root must declare map registry and ability roster truth." }));
    }

    const mapsAreGroupLevel = [facebookMapSource, tiktokMapSource].every((source) => FORBIDDEN_TARGET_CHILDREN.every((marker) => !source.includes(marker)));
    if (!mapsAreGroupLevel) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: FACEBOOK_MAP_PATH, line: 1, severity: "fatal", message: "Operational maps must reference abilityGroupId only and must not leak child ability ids into targetAbilityGroupId." }));
    }

    const externalMapImports = srcFileSources
      .filter((entry) => !entry.relativePath.startsWith(`${ROOT}/`))
      .filter((entry) => /from\s+["'][^"']*capabilities\/orchestration\/maps\//.test(entry.source))
      .map((entry) => entry.relativePath);
    if (externalMapImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: externalMapImports[0]!, line: 1, severity: "fatal", message: "Operational maps must not be imported outside the canonical orchestration root." }));
    }

    const mapIdsAreScoped = facebookMapSource.includes('mapId: "facebook-product-discovery-map"')
      && tiktokMapSource.includes('mapId: "tiktok-product-discovery-map"');
    if (!mapIdsAreScoped) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: FACEBOOK_MAP_PATH, line: 1, severity: "error", message: "Operational maps must expose the required facebook/tiktok map ids." }));
    }

    const contractPassed = hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "startMission")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "pauseMission")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "resumeMission")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "stopMission")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "emergencyStop")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "getMissionState")
      && hasInterfaceMethod(contractSource, "OrchestrationAbilityGroup", "submitReviewDecision");
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "error", message: "Orchestration contract must expose governed mission-control commands on the public interface." }));
    }

    return {
      findings,
      phases: [
        createPhase("orchestration-required-shape", requiredPresence.every((entry) => entry.exists) && mapRegistryPassed && contractPassed ? "PASS" : "CODE VIOLATION", requiredPresence.every((entry) => entry.exists) && mapRegistryPassed && contractPassed, requiredPresence.every((entry) => entry.exists) && mapRegistryPassed && contractPassed ? "Orchestration root contains contract, roster, map registry, both maps, verify anchor, and governed mission-control commands." : "Orchestration required shape is incomplete."),
        createPhase("orchestration-map-boundary", mapsAreGroupLevel && externalMapImports.length === 0 && mapIdsAreScoped ? "PASS" : "CODE VIOLATION", mapsAreGroupLevel && externalMapImports.length === 0 && mapIdsAreScoped, mapsAreGroupLevel && externalMapImports.length === 0 && mapIdsAreScoped ? "Operational maps stay declarative, group-level, and owned by the orchestration root only." : "Operational map ownership or targeting drift was detected."),
        createPhase("orchestration-dispatch-boundary", usesNerveBusBoundary && forbiddenImports.length === 0 ? "PASS" : "CODE VIOLATION", usesNerveBusBoundary && forbiddenImports.length === 0, usesNerveBusBoundary && forbiddenImports.length === 0 ? "Orchestration uses Nerve Bus and avoids browser, AI runtime, platform-action, and child implementation imports." : "Orchestration still bypasses the Nerve Bus boundary or imports forbidden owners."),
      ],
    };
  },
});