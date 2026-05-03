import type { OperationalMap } from "../../capabilities/orchestration/contract.js";
import type { MapActivationRecord } from "../shared/map-package-proof.js";
import type {
  ActiveOperationalMapRecord,
  DeveloperTaskTemplateFeedItem,
  OrdinaryTaskTemplateFeedItem,
  TaskTemplateDeveloperBinding,
} from "../shared/map-package-registry-types.js";
import type { MapPackage } from "../shared/map-package-types.js";

export type ActiveRegistration = {
  mapPackage: MapPackage;
  activationRecord: MapActivationRecord;
};

type RegistrationMap = Map<string, ActiveRegistration>;
type ActivationRegistrationMap = Map<string, ActiveRegistration>;

function toOperationalMap(mapPackage: MapPackage): OperationalMap {
  const { mapVersion: _mapVersion, proofPolicy: _proofPolicy, ...operationalMap } = mapPackage.operationalMap;
  return operationalMap;
}

function toDeveloperBinding(registration: ActiveRegistration): TaskTemplateDeveloperBinding {
  return {
    packageId: registration.mapPackage.manifest.packageId,
    packageVersion: registration.mapPackage.manifest.packageVersion,
    activationId: registration.activationRecord.activationId,
    mapId: registration.mapPackage.manifest.mapId,
    taskTemplateId: registration.mapPackage.taskTemplate.taskTemplateId,
    mapVersion: registration.mapPackage.operationalMap.mapVersion,
    requestedPlatformId: registration.mapPackage.taskTemplate.requestedPlatformId,
    platformProfileRef: registration.mapPackage.taskTemplate.platformProfileRef,
    targetProfileRef: registration.mapPackage.taskTemplate.targetProfileRef,
  };
}

function toActiveOperationalMapRecord(registration: ActiveRegistration): ActiveOperationalMapRecord {
  return {
    ...toDeveloperBinding(registration),
    activationSnapshotRef: registration.activationRecord.activationSnapshotRef,
    activationSnapshotHash: registration.activationRecord.activationSnapshotHash,
    mapPackageHash: registration.activationRecord.mapPackageHash,
    operationalMapHash: registration.activationRecord.operationalMapHash,
    capabilityCatalogVersion: registration.activationRecord.capabilityCatalogVersion,
    promptCatalogVersion: registration.activationRecord.promptCatalogVersion,
    validationReportRef: registration.activationRecord.validationReportRef,
    humanApprovalRef: registration.activationRecord.humanApprovalRef,
    importProofRef: registration.activationRecord.importProofRef,
    quarantineProofRef: registration.activationRecord.quarantineProofRef,
    activationProofRef: registration.activationRecord.activationProofRef,
    authoringProofRef: registration.activationRecord.authoringProofRef,
    proofPolicy: registration.mapPackage.operationalMap.proofPolicy,
    operationalMap: toOperationalMap(registration.mapPackage),
  };
}

const toOrdinaryTaskTemplateFeedItem = (registration: ActiveRegistration): OrdinaryTaskTemplateFeedItem => ({
  taskTemplateId: registration.mapPackage.taskTemplate.taskTemplateId,
  displayName: registration.mapPackage.taskTemplate.displayName,
  description: registration.mapPackage.taskTemplate.description,
  recommended: registration.mapPackage.taskTemplate.recommended,
  taskCategory: registration.mapPackage.taskTemplate.taskCategory,
  version: registration.mapPackage.taskTemplate.version,
  defaultRunLimit: registration.mapPackage.taskTemplate.defaultRunLimit,
  maxAllowedRunLimit: registration.mapPackage.taskTemplate.maxAllowedRunLimit,
  safetyLevel: registration.mapPackage.taskTemplate.safetyLevel,
  userVisibleCapabilities: registration.mapPackage.taskTemplate.userVisibleCapabilities,
  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",
  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,
});

const toDeveloperTaskTemplateFeedItem = (registration: ActiveRegistration): DeveloperTaskTemplateFeedItem => ({
  ...toDeveloperBinding(registration),
  packageId: registration.mapPackage.manifest.packageId,
  packageVersion: registration.mapPackage.manifest.packageVersion,
  activationId: registration.activationRecord.activationId,
  mapId: registration.mapPackage.manifest.mapId,
  taskTemplateId: registration.mapPackage.taskTemplate.taskTemplateId,
  displayName: registration.mapPackage.taskTemplate.displayName,
  description: registration.mapPackage.taskTemplate.description,
  recommended: registration.mapPackage.taskTemplate.recommended,
  taskCategory: registration.mapPackage.taskTemplate.taskCategory,
  version: registration.mapPackage.taskTemplate.version,
  defaultRunLimit: registration.mapPackage.taskTemplate.defaultRunLimit,
  maxAllowedRunLimit: registration.mapPackage.taskTemplate.maxAllowedRunLimit,
  safetyLevel: registration.mapPackage.taskTemplate.safetyLevel,
  userVisibleCapabilities: registration.mapPackage.taskTemplate.userVisibleCapabilities,
  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",
  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,
});

const findRegistration = (registrations: Iterable<ActiveRegistration>, predicate: (registration: ActiveRegistration) => boolean): ActiveRegistration | null => {
  for (const registration of registrations) {
    if (predicate(registration)) {
      return registration;
    }
  }
  return null;
};

const listRegistrations = (activeByMapId: RegistrationMap): ActiveRegistration[] => [...activeByMapId.values()];

const createActiveWriteApi = (
  activeByMapId: RegistrationMap,
  snapshotByActivationId: ActivationRegistrationMap,
): Pick<ActiveMapRegistry, "activate" | "deactivate" | "getRegistration" | "listActivePackages"> => ({
  activate(mapPackage, activationRecord) {
    const registration = { mapPackage, activationRecord };
    activeByMapId.set(mapPackage.manifest.mapId, registration);
    snapshotByActivationId.set(activationRecord.activationId, registration);
  },
  deactivate(mapId) {
    activeByMapId.delete(mapId);
  },
  getRegistration(mapId) {
    return activeByMapId.get(mapId) ?? null;
  },
  listActivePackages() {
    return listRegistrations(activeByMapId).map((registration) => registration.mapPackage);
  },
});

const createActiveLookupApi = (
  activeByMapId: RegistrationMap,
  snapshotByActivationId: ActivationRegistrationMap,
): Pick<
  ActiveMapRegistry,
  | "getOperationalMap"
  | "getActiveOperationalMapRecord"
  | "getActiveOperationalMapRecordByTaskTemplateId"
  | "getActiveOperationalMapRecordByActivationId"
  | "getTaskTemplateDeveloperBinding"
> => ({
  getOperationalMap(mapId) {
    const registration = activeByMapId.get(mapId);
    return registration ? toOperationalMap(registration.mapPackage) : null;
  },
  getActiveOperationalMapRecord(mapId) {
    const registration = activeByMapId.get(mapId);
    return registration ? toActiveOperationalMapRecord(registration) : null;
  },
  getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId) {
    const registration = findRegistration(listRegistrations(activeByMapId), (entry) => entry.mapPackage.taskTemplate.taskTemplateId === taskTemplateId);
    return registration ? toActiveOperationalMapRecord(registration) : null;
  },
  getActiveOperationalMapRecordByActivationId(activationId) {
    const registration = snapshotByActivationId.get(activationId) ?? null;
    return registration ? toActiveOperationalMapRecord(registration) : null;
  },
  getTaskTemplateDeveloperBinding(taskTemplateId) {
    const registration = findRegistration(listRegistrations(activeByMapId), (entry) => entry.mapPackage.taskTemplate.taskTemplateId === taskTemplateId);
    return registration ? toDeveloperBinding(registration) : null;
  },
});

const createActiveFeedApi = (
  activeByMapId: RegistrationMap,
): Pick<ActiveMapRegistry, "listActiveOperationalMapRecords" | "listOrdinaryTaskTemplates" | "listApprovedTaskTemplates"> => ({
  listActiveOperationalMapRecords() {
    return listRegistrations(activeByMapId).map(toActiveOperationalMapRecord);
  },
  listOrdinaryTaskTemplates() {
    return listRegistrations(activeByMapId).map(toOrdinaryTaskTemplateFeedItem);
  },
  listApprovedTaskTemplates() {
    return listRegistrations(activeByMapId).map(toDeveloperTaskTemplateFeedItem);
  },
});

export type ActiveMapRegistry = {
  activate(mapPackage: MapPackage, activationRecord: MapActivationRecord): void;
  deactivate(mapId: string): void;
  getOperationalMap(mapId: string): OperationalMap | null;
  getActiveOperationalMapRecord(mapId: string): ActiveOperationalMapRecord | null;
  getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId: string): ActiveOperationalMapRecord | null;
  getActiveOperationalMapRecordByActivationId(activationId: string): ActiveOperationalMapRecord | null;
  getRegistration(mapId: string): ActiveRegistration | null;
  listActivePackages(): MapPackage[];
  listActiveOperationalMapRecords(): ActiveOperationalMapRecord[];
  getTaskTemplateDeveloperBinding(taskTemplateId: string): TaskTemplateDeveloperBinding | null;
  listOrdinaryTaskTemplates(): OrdinaryTaskTemplateFeedItem[];
  listApprovedTaskTemplates(): DeveloperTaskTemplateFeedItem[];
};

export const createActiveMapRegistry = (): ActiveMapRegistry => {
  const activeByMapId = new Map<string, ActiveRegistration>();
  const snapshotByActivationId = new Map<string, ActiveRegistration>();
  return {
    ...createActiveWriteApi(activeByMapId, snapshotByActivationId),
    ...createActiveLookupApi(activeByMapId, snapshotByActivationId),
    ...createActiveFeedApi(activeByMapId),
  };
};
