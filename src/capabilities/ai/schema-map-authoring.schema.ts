import { z } from "zod";

import { MapAuthoringAiOutputSchema } from "../../map-plugins/authoring/map-authoring-ai-output.schema.js";
import { MapAuthoringInputPackageSchema } from "../../map-plugins/authoring/map-authoring-input-package.schema.js";
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