import type { OperationalMap } from "../../capabilities/orchestration/contract.js";

import type { MapPackageLifecycleStatus } from "./map-package-status.js";
import type { MapPackageValidationIssue } from "./map-package-failure.js";
import type { MapPackage, TaskTemplatePackage } from "./map-package-types.js";

export type OrdinaryTaskTemplateFeedItem = {
  taskTemplateId: string;
  displayName: string;
  description: string;
  recommended: boolean;
  taskCategory: string;
  version: string;
  defaultRunLimit: TaskTemplatePackage["defaultRunLimit"];
  maxAllowedRunLimit: TaskTemplatePackage["maxAllowedRunLimit"];
  safetyLevel: string;
  userVisibleCapabilities: string[];
  availability: "ready" | "disabled";
  defaultHumanGoal: string;
};

export type TaskTemplateDeveloperBinding = {
  packageId: string;
  packageVersion: string;
  activationId: string;
  mapId: string;
  taskTemplateId: string;
  mapVersion: string;
  requestedPlatformId: TaskTemplatePackage["requestedPlatformId"];
  platformProfileRef: string | null;
  targetProfileRef: string | null;
};

export type ActiveOperationalMapRecord = {
  packageId: string;
  packageVersion: string;
  activationId: string;
  mapId: string;
  taskTemplateId: string;
  mapVersion: string;
  requestedPlatformId: TaskTemplatePackage["requestedPlatformId"];
  platformProfileRef: string | null;
  targetProfileRef: string | null;
  activationSnapshotRef: string;
  activationSnapshotHash: string;
  mapPackageHash: string;
  operationalMapHash: string;
  capabilityCatalogVersion: string;
  promptCatalogVersion: string;
  validationReportRef: string;
  automationGateRef: string;
  importProofRef: string;
  quarantineProofRef: string;
  activationProofRef: string;
  authoringProofRef: string | null;
  operationalMap: OperationalMap;
};

export type DeveloperTaskTemplateFeedItem = TaskTemplateDeveloperBinding & {
  displayName: string;
  description: string;
  recommended: boolean;
  taskCategory: string;
  version: string;
  defaultRunLimit: TaskTemplatePackage["defaultRunLimit"];
  maxAllowedRunLimit: TaskTemplatePackage["maxAllowedRunLimit"];
  safetyLevel: string;
  userVisibleCapabilities: string[];
  availability: "ready" | "disabled";
  defaultHumanGoal: string;
};

export type DeveloperMapPackageItem = {
  packageId: string;
  packageVersion: string;
  mapId: string;
  title: string;
  lifecycleStatus: MapPackageLifecycleStatus;
  activationGateStatus: string;
  summary: string;
  chain: string[];
  validationIssues: MapPackageValidationIssue[];
  activationId: string | null;
  draftOnly: boolean;
};
