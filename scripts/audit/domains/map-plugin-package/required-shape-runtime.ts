import { buildCapabilityCatalog } from "../../../../src/map-plugins/authoring/capability-catalog/index.js";
import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { createMapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { ROOT } = MAP_PLUGIN_PATHS;

const CAPABILITY_CATALOG_GENERATED_PATH = "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json";

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
  if (ordinaryTemplates.some((item) => item.taskTemplateId === "ai-generated-map-placeholder")) {
    findings.push(createRegistryBootstrapError("AI draft placeholder must never appear in the approved active task-template feed."));
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
  if (!registry.active.getTaskTemplateDeveloperBinding("tiktok-product-discovery")) {
    return [createRegistryBootstrapError("Active registry must resolve a developer binding for an approved task template.")];
  }

  const activeRecord = registry.active.getActiveOperationalMapRecordByTaskTemplateId("tiktok-product-discovery");
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