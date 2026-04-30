import { z } from "zod";

import { MapDependenciesSchema } from "./map-dependencies.schema.js";
import { MapPackageRequirementsSchema } from "./map-package-requirements.schema.js";
import { MapPluginManifestSchema } from "./map-plugin-manifest.schema.js";
import { MapPolicySchema } from "./map-policy.schema.js";
import { OperationalMapPackageSchema } from "./operational-map-package.schema.js";
import { PromptBindingsSchema } from "./prompt-bindings.schema.js";
import { TaskTemplatePackageSchema } from "./task-template-package.schema.js";

export const MapPackageSchema = z.object({
  manifest: MapPluginManifestSchema,
  taskTemplate: TaskTemplatePackageSchema,
  operationalMap: OperationalMapPackageSchema,
  dependencies: MapDependenciesSchema,
  compatibility: MapPackageRequirementsSchema,
  policy: MapPolicySchema,
  promptBindings: PromptBindingsSchema,
  changelog: z.string().default(""),
  signature: z.record(z.unknown()).nullable().optional().default(null)
}).strict().superRefine((value, context) => {
  if (value.manifest.mapId !== value.operationalMap.mapId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "manifest.mapId must match operationalMap.mapId", path: ["manifest", "mapId"] });
  }
  if (value.manifest.taskTemplateId !== value.taskTemplate.taskTemplateId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "manifest.taskTemplateId must match taskTemplate.taskTemplateId", path: ["manifest", "taskTemplateId"] });
  }
  if (value.taskTemplate.version !== value.manifest.packageVersion) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "taskTemplate.version must match manifest.packageVersion", path: ["taskTemplate", "version"] });
  }
});
