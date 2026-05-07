import { buildCapabilityCatalog } from "../../../../src/map-plugins/authoring/capability-catalog/index.js";
import { buildMapAuthoringGovernedCatalogs } from "../../../../src/map-plugins/authoring/map-authoring-governed-catalogs.js";
import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { createMapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { ROOT } = MAP_PLUGIN_PATHS;

const CAPABILITY_CATALOG_GENERATED_PATH = "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json";
const PHASE_05_DIAGNOSTIC_PACKAGE_ID = "builtin.phase-05-full-surface-diagnostic";
const PHASE_05_DIAGNOSTIC_MAP_PATH = "src/map-plugins/builtins/phase-05-full-surface-diagnostic.meta.map-package.json";
const PHASE_05_REQUIRED_ABILITY_SURFACE = [
  "open",
  "page-state",
  "screenshot",
  "ai",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
] as const;
const PHASE_05_REQUIRED_CONTROL_SURFACE = ["commander-console", "orchestration", "nerve-bus"] as const;

const hasForbiddenExecutableKey = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenExecutableKey);
  return Object.entries(value).some(([key, item]) =>
    ["handler", "rawPrompt", "executablePayload"].includes(key) || hasForbiddenExecutableKey(item),
  );
};

const createRegistryBootstrapError = (message: string): Finding =>
  createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message });

type ActiveRegistryRecord = NonNullable<ReturnType<ReturnType<typeof createMapPluginRegistry>["active"]["getActiveOperationalMapRecordByTaskTemplateId"]>>;

const collectRegistryFeedFindings = (registry: ReturnType<typeof createMapPluginRegistry>): Finding[] => {
  const activePackages = registry.active.listActivePackages();
  const ordinaryTemplates = registry.active.listOrdinaryTaskTemplates();
  const findings: Finding[] = [];

  if (activePackages.length < 2) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/registry/map-plugin-registry.ts`, line: 1, severity: "fatal", message: "Approved builtin map packages must bootstrap into the active registry." }));
  }
  if (ordinaryTemplates.some((item) => item.availability !== "ready")) {
    findings.push(createRegistryBootstrapError("Draft, quarantined, disabled, or rejected maps must never appear in the ordinary runnable feed."));
  }
  if (ordinaryTemplates.some((item) => "mapId" in (item as object) || "requestedPlatformId" in (item as object))) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.FEED_BOUNDARY, file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "Ordinary task-template feed must not expose internal map binding fields." }));
  }
  if (activePackages.some((mapPackage) => mapPackage.manifest.aiGenerated)) {
    findings.push(createRegistryBootstrapError("AI-generated map packages must not enter the active registry."));
  }

  return findings;
};

const resolveActiveRecord = (registry: ReturnType<typeof createMapPluginRegistry>): ActiveRegistryRecord | Finding[] => {
  for (const taskTemplateId of ["facebook-seeding-video-discovery", "tiktok-seeding-video-discovery"]) {
    if (!registry.active.getTaskTemplateDeveloperBinding(taskTemplateId)) {
      return [createRegistryBootstrapError(`Active registry must resolve a developer binding for approved task template ${taskTemplateId}.`)];
    }
  }

  const activeRecord = registry.active.getActiveOperationalMapRecordByTaskTemplateId("tiktok-seeding-video-discovery");
  if (!activeRecord) {
    return [createRegistryBootstrapError("Active registry must expose a frozen active record for approved task templates.")];
  }

  return activeRecord;
};

const hasFrozenGovernanceMetadata = (activeRecord: ActiveRegistryRecord): boolean => {
  return [
    activeRecord.activationId,
    activeRecord.activationSnapshotRef,
    activeRecord.activationSnapshotHash,
    activeRecord.mapPackageHash,
    activeRecord.operationalMapHash,
    activeRecord.capabilityCatalogVersion,
    activeRecord.promptCatalogVersion,
    activeRecord.validationReportRef,
    activeRecord.humanApprovalRef,
  ].every(Boolean);
};

const collectActiveRecordMetadataFindings = (activeRecord: ActiveRegistryRecord): Finding[] => {
  const findings: Finding[] = [];
  if (!hasFrozenGovernanceMetadata(activeRecord)) {
    findings.push(createRegistryBootstrapError("Active registry records must expose activationId, frozen hashes, and locked governance refs."));
  }
  if (!activeRecord.proofPolicy.recordPackageSelection) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.PROOF, file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "Active registry records must preserve proofPolicy outside the stripped orchestration map payload." }));
  }

  return findings;
};

const collectRollbackSnapshotFindings = (
  registry: ReturnType<typeof createMapPluginRegistry>,
  activeRecord: ActiveRegistryRecord,
): Finding[] => {
  const snapshotBeforeRollback = registry.active.getActiveOperationalMapRecordByActivationId(activeRecord.activationId);
  registry.rollbackActiveMap(activeRecord.mapId, "audit-required-shape", "rollback immutability check");
  const snapshotAfterRollback = registry.active.getActiveOperationalMapRecordByActivationId(activeRecord.activationId);
  return !snapshotBeforeRollback || !snapshotAfterRollback
    ? [createRegistryBootstrapError("Rollback must not remove frozen activation snapshots from activation-id lookup.")]
    : [];
};

const collectActiveRecordFindings = (registry: ReturnType<typeof createMapPluginRegistry>): Finding[] => {
  const activeRecord = resolveActiveRecord(registry);
  if (Array.isArray(activeRecord)) {
    return activeRecord;
  }

  return [
    ...collectActiveRecordMetadataFindings(activeRecord),
    ...collectRollbackSnapshotFindings(registry, activeRecord),
  ];
};

const bootstrapRegistry = (): ReturnType<typeof createMapPluginRegistry> => {
  const registry = createMapPluginRegistry();
  for (const builtinPackage of loadBuiltinMapPackages()) {
    registry.importPackage(builtinPackage, "audit-required-shape");
    if (builtinPackage.manifest.approvalStatus === "approved" && builtinPackage.taskTemplate.availabilityPolicy === "active") {
      registry.activatePackage(builtinPackage.manifest.packageId, builtinPackage.manifest.packageVersion, "audit-required-shape", "audit bootstrap");
    }
  }

  return registry;
};

export const inspectRegistryBootstrap = (): Finding[] => {
  try {
    const registry = bootstrapRegistry();
    return [
      ...collectRegistryFeedFindings(registry),
      ...collectActiveRecordFindings(registry),
    ];
  } catch (error) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/registry/map-plugin-registry.ts`, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Map registry bootstrap failed during audit." })];
  }
};

export const inspectCapabilityCatalogGeneratedTruth = async (): Promise<Finding[]> => {
  const generatedText = await readTextFile(pathFromRepoRoot(CAPABILITY_CATALOG_GENERATED_PATH));
  const generatedDocument = JSON.parse(generatedText) as object;
  const rebuiltDocument = buildCapabilityCatalog();

  return JSON.stringify(generatedDocument) === JSON.stringify(rebuiltDocument)
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG, file: CAPABILITY_CATALOG_GENERATED_PATH, line: 1, severity: "fatal", message: "Generated capability catalog must match the governed build source exactly." })];
};

export const inspectMapAuthoringCapabilityCatalogGate = (): Finding[] => {
  try {
    const catalogs = buildMapAuthoringGovernedCatalogs();
    return catalogs.capabilityCatalog.entries.length > 0
      ? []
      : [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: `${ROOT}/authoring/map-authoring-governed-catalogs.ts`, line: 1, severity: "fatal", message: "Map authoring governed capability catalog must expose at least one governed entry." })];
  } catch (error) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: `${ROOT}/authoring/map-authoring-governed-catalogs.ts`, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Map authoring capability catalog gate failed." })];
  }
};

export const inspectPhase05DiagnosticMapSurface = (): Finding[] => {
  const diagnosticPackage = loadBuiltinMapPackages().find((mapPackage) => mapPackage.manifest.packageId === PHASE_05_DIAGNOSTIC_PACKAGE_ID);
  if (!diagnosticPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: PHASE_05_DIAGNOSTIC_MAP_PATH, line: 1, severity: "fatal", message: "Phase-05 full-surface diagnostic map must be present as a governed builtin map package." })];
  }

  const map = diagnosticPackage.operationalMap;
  const abilitySurface = new Set(map.steps.map((step) => step.targetAbilityGroupId).filter((value) => Boolean(value)));
  const missingAbilitySurface = PHASE_05_REQUIRED_ABILITY_SURFACE.filter((abilityGroupId) => !abilitySurface.has(abilityGroupId));
  const textInputStep = map.steps.find((step) => step.targetAbilityGroupId === "text-input");
  const policyText = [
    diagnosticPackage.policy.safetyPolicy,
    diagnosticPackage.policy.debugPolicy,
    diagnosticPackage.taskTemplate.safetyLevel,
    textInputStep?.stepId ?? "",
  ].join(" ");
  const hasDryRunTextInputGate = /dry-run|sandbox/.test(policyText) && /local/.test(policyText);
  const hasNoExecutablePayload = !hasForbiddenExecutableKey(diagnosticPackage);
  const hasControlSurface = PHASE_05_REQUIRED_CONTROL_SURFACE.every((surface) => {
    if (surface === "commander-console") return diagnosticPackage.taskTemplate.taskTemplateId === "phase-05-full-surface-diagnostic-map";
    if (surface === "orchestration") return map.steps.every((step) => step.capabilityId === "orchestration");
    return map.steps.some((step) => step.stepKind === "ability" || step.stepKind === "ai");
  });

  const findings: Finding[] = [];
  if (missingAbilitySurface.length > 0 || !hasControlSurface) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: PHASE_05_DIAGNOSTIC_MAP_PATH, line: 1, severity: "fatal", message: "Phase-05 diagnostic map must cover the full governed evidence surface without adding owners.", detail: [...missingAbilitySurface, ...PHASE_05_REQUIRED_CONTROL_SURFACE.filter((surface) => !hasControlSurface)].join(", ") }));
  }
  if (!hasDryRunTextInputGate) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: PHASE_05_DIAGNOSTIC_MAP_PATH, line: 1, severity: "fatal", message: "Phase-05 diagnostic text-input coverage must be local sandbox dry-run/review-gated only." }));
  }
  if (!hasNoExecutablePayload) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: PHASE_05_DIAGNOSTIC_MAP_PATH, line: 1, severity: "fatal", message: "Phase-05 diagnostic map package must not contain executable payloads, handlers, shell commands, or raw prompts." }));
  }

  return findings;
};
