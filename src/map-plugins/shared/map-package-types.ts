import type { z } from "zod";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import { MapDependenciesSchema } from "../schema/map-dependencies.schema.js";
import { MapPluginManifestSchema } from "../schema/map-plugin-manifest.schema.js";
import { MapPackageRequirementsSchema } from "../schema/map-package-requirements.schema.js";
import { OperationalMapPackageSchema } from "../schema/operational-map-package.schema.js";
import { PromptBindingsSchema } from "../schema/prompt-bindings.schema.js";
import { TaskTemplatePackageSchema } from "../schema/task-template-package.schema.js";

export type MapPluginManifest = z.output<typeof MapPluginManifestSchema>;
export type TaskTemplatePackage = z.output<typeof TaskTemplatePackageSchema>;
export type OperationalMapPackage = z.output<typeof OperationalMapPackageSchema>;
export type MapDependencies = z.output<typeof MapDependenciesSchema>;
export type MapCompatibility = z.output<typeof MapPackageRequirementsSchema>;
export type PromptBindings = z.output<typeof PromptBindingsSchema>;
export type MapPackage = z.output<typeof MapPackageSchema>;
