import { MapAuthoringInputPackageSchema } from "../../../map-plugins/authoring/map-authoring-input-package.schema.js";
import { normalizeMapAuthoringDraft } from "../../../map-plugins/authoring/map-authoring-draft-normalizer.js";
import type { MapLabAuthoringRequest } from "./map-lab-types.js";

type NormalizeMapLabDraftInput = {
  request: MapLabAuthoringRequest;
  aiInput: unknown;
  aiOutput: unknown;
  promptContractId: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  runtime: string;
  sessionId: string;
};

export type NormalizedMapLabDraft = ReturnType<typeof normalizeMapAuthoringDraft>;

export function normalizeMapLabDraft(input: NormalizeMapLabDraftInput): NormalizedMapLabDraft {
  return normalizeMapAuthoringDraft({
    request: input.request,
    inputPackage: MapAuthoringInputPackageSchema.parse(input.aiInput),
    aiOutput: input.aiOutput,
    promptContractId: input.promptContractId,
    promptVersion: input.promptVersion,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    runtime: input.runtime,
    sessionId: input.sessionId,
  });
}
