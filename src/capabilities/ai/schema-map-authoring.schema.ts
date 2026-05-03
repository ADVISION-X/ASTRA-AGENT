import { z } from "zod";

import { MapAuthoringAiOutputSchema } from "../../map-plugins/authoring/map-authoring-ai-output.schema.js";
import { MapAuthoringRequestSchema } from "../../map-plugins/authoring/map-authoring-request.schema.js";
import { AiBaseInputSchema } from "./schema-foundation.schema.js";

const AiMapAuthoringOutputSchema = MapAuthoringAiOutputSchema;

const MapAuthoringInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("map_authoring"),
  inputModality: z.literal("structured_record"),
  input: MapAuthoringRequestSchema,
}).strict();

export {
  AiMapAuthoringOutputSchema,
  MapAuthoringInputSchema,
};