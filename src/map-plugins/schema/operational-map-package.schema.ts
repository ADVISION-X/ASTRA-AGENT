import { z } from "zod";

import { MapPluginOperationalMapSchema } from "./operational-map-core.schema.js";

export const OperationalMapPackageSchema = z.object({
  mapVersion: z.string().min(1),
}).passthrough().superRefine((value, context) => {
  const { mapVersion: _mapVersion, ...operationalMap } = value;
  const parsed = MapPluginOperationalMapSchema.safeParse(operationalMap);
  if (parsed.success) {
    return;
  }

  for (const issue of parsed.error.issues) {
    context.addIssue(issue);
  }
}).transform((value) => {
  const { mapVersion, ...operationalMap } = value;
  return {
    ...MapPluginOperationalMapSchema.parse(operationalMap),
    mapVersion,
  };
});
