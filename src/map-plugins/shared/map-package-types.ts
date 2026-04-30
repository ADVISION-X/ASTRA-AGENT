import type { OperationalMap } from "../../capabilities/orchestration/contract.js";
import type { z } from "zod";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import { MapDependenciesSchema } from "../schema/map-dependencies.schema.js";
import { MapPluginManifestSchema } from "../schema/map-plugin-manifest.schema.js";
import { MapPackageRequirementsSchema } from "../schema/map-package-requirements.schema.js";
import { MapPolicySchema } from "../schema/map-policy.schema.js";
import { OperationalMapPackageSchema } from "../schema/operational-map-package.schema.js";
import { PromptBindingsSchema } from "../schema/prompt-bindings.schema.js";
import { TaskTemplatePackageSchema } from "../schema/task-template-package.schema.js";
import type { MapPackageLifecycleStatus } from "./map-package-status.js";
import type { MapPackageValidationIssue } from "./map-package-failure.js";

export type MapPluginManifest = z.output<typeof MapPluginManifestSchema>;
export type TaskTemplatePackage = z.output<typeof TaskTemplatePackageSchema>;
export type OperationalMapPackage = z.output<typeof OperationalMapPackageSchema>;
export type MapDependencies = z.output<typeof MapDependenciesSchema>;
export type MapCompatibility = z.output<typeof MapPackageRequirementsSchema>;
export type MapPolicy = z.output<typeof MapPolicySchema>;
export type PromptBindings = z.output<typeof PromptBindingsSchema>;
export type MapPackage = z.output<typeof MapPackageSchema>;

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

export type ActiveOperationalMapRecord = TaskTemplateDeveloperBinding & {
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
  approvalStatus: string;
  summary: string;
  chain: string[];
  validationIssues: MapPackageValidationIssue[];
  activationId: string | null;
  draftOnly: boolean;
};
