import { buildMapAuthoringInputPackage } from "./map-authoring-input-package-builder.js";
import { buildMapAuthoringPrompt } from "./map-authoring-prompt-builder.js";
import { MapAuthoringRequestSchema, type MapAuthoringRequest } from "./map-authoring-request.schema.js";
import type { MapAuthoringInputPackage } from "./map-authoring-input-package.schema.js";
import type { MapAuthoringResponse } from "./map-authoring-response.schema.js";

export function buildMapAuthoringPublicContract(input: {
  request: unknown;
  requesterRef?: string;
}): {
  request: MapAuthoringRequest;
  inputPackage: MapAuthoringInputPackage;
  promptResponse: MapAuthoringResponse;
} {
  const request = MapAuthoringRequestSchema.parse(input.request);
  const inputPackage = input.requesterRef === undefined
    ? buildMapAuthoringInputPackage(request)
    : buildMapAuthoringInputPackage(request, { requesterRef: input.requesterRef });
  const promptResponse = buildMapAuthoringPrompt(inputPackage);

  return { request, inputPackage, promptResponse };
}