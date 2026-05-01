import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  LAW_STRUCTURED_LOGGING_AI_ERROR,
  LAW_STRUCTURED_LOGGING_AI_REQUEST,
  LAW_STRUCTURED_LOGGING_AI_RESPONSE,
  LAW_STRUCTURED_LOGGING_DEBUG,
  LAW_STRUCTURED_LOGGING_EXIT,
  LAW_STRUCTURED_LOGGING_REFS,
  STARTUP_ENTRYPOINT_PATH,
  STRUCTURED_LOG_PATH,
} = forensicsPersistenceInspectionConstants;

const STRUCTURED_LOG_SCHEMA_RULES = [
  {
    lawId: LAW_STRUCTURED_LOGGING_DEBUG,
    file: STRUCTURED_LOG_PATH,
    message: "StructuredRuntimeEvent schema is missing required DEBUG transparency fields.",
    requiredFields: ["level", "traceId", "spanId", "eventId", "eventType", "ownerResponsible", "missionId", "mapId", "stepId", "taskTemplateId", "refs", "durationMs"],
  },
  {
    lawId: LAW_STRUCTURED_LOGGING_REFS,
    file: STRUCTURED_LOG_PATH,
    message: "StructuredRuntimeEvent schema is missing trace-back refs required for Forensics linkage.",
    requiredFields: ["proofRefs", "artifactRefs", "rawResponseRef", "promptDebugRef"],
  },
  {
    lawId: LAW_STRUCTURED_LOGGING_AI_REQUEST,
    file: STRUCTURED_LOG_PATH,
    message: "StructuredRuntimeEvent schema is missing AI request DEBUG fields.",
    requiredFields: ["promptContractId", "promptVersion", "outputSchemaRef", "promptDebugRef", "systemPromptHash", "userPromptHash", "promptPreview", "promptFullText", "imageInputs", "sourceScreenshotEvidenceId", "aiInputArtifactRef", "tokenEstimate"],
  },
  {
    lawId: LAW_STRUCTURED_LOGGING_AI_RESPONSE,
    file: STRUCTURED_LOG_PATH,
    message: "StructuredRuntimeEvent schema is missing AI response DEBUG fields.",
    requiredFields: ["rawResponsePreview", "rawResponseText", "rawResponseHash", "rawResponseRef", "parsedJson", "parsedDecision", "parserErrors"],
  },
  {
    lawId: LAW_STRUCTURED_LOGGING_AI_ERROR,
    file: STRUCTURED_LOG_PATH,
    message: "StructuredRuntimeEvent schema is missing actionable AI error fields.",
    requiredFields: ["actionableMessage", "ownerResponsible"],
  },
  {
    lawId: LAW_STRUCTURED_LOGGING_EXIT,
    file: STARTUP_ENTRYPOINT_PATH,
    message: "Service shutdown and unexpected-exit structured logging is missing required event classifications or persisted fields.",
    requiredFields: ["exitCode", "signal", "pid", "lastRuntimeEventId", "lastCommandEventId", "lastAiEventId", "likelyCauseRef", "crashBundleRef"],
  },
] as const;

const collectMissingSchemaFieldFinding = (input: {
  fields: Set<string>;
  lawId: string;
  file: string;
  message: string;
  requiredFields: readonly string[];
}): Finding[] => {
  const missingFields = input.requiredFields.filter((fieldName) => !input.fields.has(fieldName));
  return missingFields.length > 0
    ? [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "error", message: input.message, detail: missingFields.join(", ") })]
    : [];
};

export function runForensicsStructuredLogSchemaChecks(project: import("ts-morph").Project): Finding[] {
  const structuredLogSource = getSourceFileOrThrow(project, STRUCTURED_LOG_PATH);
  const structuredRuntimeEventProperties = getZodObjectPropertyNames(structuredLogSource, "StructuredRuntimeEventSchema");
  return STRUCTURED_LOG_SCHEMA_RULES.flatMap((rule) => collectMissingSchemaFieldFinding({ ...rule, fields: structuredRuntimeEventProperties }));
}