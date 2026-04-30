import type { OperationalMap } from "../../capabilities/orchestration/contract.js";
import type { MapActivationRecord } from "../shared/map-package-proof.js";
import type {
  ActiveOperationalMapRecord,
  DeveloperTaskTemplateFeedItem,
  MapPackage,
  OrdinaryTaskTemplateFeedItem,
  TaskTemplateDeveloperBinding,
} from "../shared/map-package-types.js";

type ActiveRegistration = {
  mapPackage: MapPackage;
  activationRecord: MapActivationRecord;
};

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
    operationalMap: toOperationalMap(registration.mapPackage),
  };
}

export class ActiveMapRegistry {
  private readonly activeByMapId = new Map<string, ActiveRegistration>();

  private findRegistrationByTaskTemplateId(taskTemplateId: string): ActiveRegistration | null {
    for (const registration of this.activeByMapId.values()) {
      if (registration.mapPackage.taskTemplate.taskTemplateId === taskTemplateId) {
        return registration;
      }
    }
    return null;
  }

  private findRegistrationByActivationId(activationId: string): ActiveRegistration | null {
    for (const registration of this.activeByMapId.values()) {
      if (registration.activationRecord.activationId === activationId) {
        return registration;
      }
    }
    return null;
  }

  activate(mapPackage: MapPackage, activationRecord: MapActivationRecord): void {
    this.activeByMapId.set(mapPackage.manifest.mapId, { mapPackage, activationRecord });
  }

  deactivate(mapId: string): void {
    this.activeByMapId.delete(mapId);
  }

  getOperationalMap(mapId: string): OperationalMap | null {
    const registration = this.activeByMapId.get(mapId);
    return registration ? toOperationalMap(registration.mapPackage) : null;
  }

  getActiveOperationalMapRecord(mapId: string): ActiveOperationalMapRecord | null {
    const registration = this.activeByMapId.get(mapId);
    return registration ? toActiveOperationalMapRecord(registration) : null;
  }

  getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId: string): ActiveOperationalMapRecord | null {
    const registration = this.findRegistrationByTaskTemplateId(taskTemplateId);
    return registration ? toActiveOperationalMapRecord(registration) : null;
  }

  getActiveOperationalMapRecordByActivationId(activationId: string): ActiveOperationalMapRecord | null {
    const registration = this.findRegistrationByActivationId(activationId);
    return registration ? toActiveOperationalMapRecord(registration) : null;
  }

  getRegistration(mapId: string): ActiveRegistration | null {
    return this.activeByMapId.get(mapId) ?? null;
  }

  listActivePackages(): MapPackage[] {
    return [...this.activeByMapId.values()].map((registration) => registration.mapPackage);
  }

  listActiveOperationalMapRecords(): ActiveOperationalMapRecord[] {
    return [...this.activeByMapId.values()].map((registration) => toActiveOperationalMapRecord(registration));
  }

  getTaskTemplateDeveloperBinding(taskTemplateId: string): TaskTemplateDeveloperBinding | null {
    const registration = this.findRegistrationByTaskTemplateId(taskTemplateId);
    return registration ? toDeveloperBinding(registration) : null;
  }

  listOrdinaryTaskTemplates(): OrdinaryTaskTemplateFeedItem[] {
    return [...this.activeByMapId.values()].map((registration) => ({
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
    }));
  }

  listApprovedTaskTemplates(): DeveloperTaskTemplateFeedItem[] {
    return [...this.activeByMapId.values()].map((registration) => ({
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
    }));
  }
}
