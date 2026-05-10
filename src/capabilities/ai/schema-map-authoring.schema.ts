import { z } from "zod";

import { MapAuthoringAiOutputSchema, MapAuthoringInputPackageSchema } from "./shared/ai-map-authoring-schemas.js";
import { AiBaseInputSchema } from "./schema-foundation.schema.js";

const AiMapAuthoringOutputSchema = MapAuthoringAiOutputSchema;

const MapAuthoringInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("map_authoring"),
  inputModality: z.literal("structured_record"),
  input: MapAuthoringInputPackageSchema,
}).strict();

export {
  AiMapAuthoringOutputSchema,
  MapAuthoringInputSchema,
};