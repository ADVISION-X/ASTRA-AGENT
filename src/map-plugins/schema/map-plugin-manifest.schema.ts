import { z } from "zod";

import { MAP_PACKAGE_APPROVAL_STATUSES } from "../shared/map-package-status.js";

export const MapPluginManifestSchema = z.object({
  packageId: z.string().min(1),
  packageKind: z.literal("operational-map-package"),
  packageVersion: z.string().min(1),
  mapId: z.string().min(1),
  taskTemplateId: z.string().min(1),
  displayName: z.string().min(1),
  author: z.string().min(1),
  createdAt: z.string().datetime(),
  minimumGrassEyeVersion: z.string().min(1),
  mapSchemaVersion: z.string().min(1),
  approvalStatus: z.enum(MAP_PACKAGE_APPROVAL_STATUSES),
  aiGenerated: z.boolean().default(false)
}).strict();
