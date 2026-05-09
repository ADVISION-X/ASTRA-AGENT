import { Node, SyntaxKind, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { findAiOutputSchemaDescriptorBySchemaVersion, listAiOutputSchemaFieldNames } from "../../../../src/capabilities/ai/output-schema-catalog-port.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const VISION_PROMPT_TEMPLATE_PATH = "src/lib/local-ai/prompts/vision-product-presence.v1.ts";
const VISION_PROMPT_OUTPUT_SCHEMA_REF = "ai.product_presence_judgment.v1";

export const inspectPromptTemplateRequiredOutputSchema = (project: Project): Finding[] => {
  const source = getSource(project, VISION_PROMPT_TEMPLATE_PATH);
  const propAssignments = source.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
  const requiredOutputSchemaProp = propAssignments.find((property) => property.getName() === "requiredOutputSchema");

  if (!requiredOutputSchemaProp) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file: VISION_PROMPT_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Prompt template VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT is missing requiredOutputSchema." })];
  }

  const initializer = requiredOutputSchemaProp.getInitializer();
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    return [];
  }

  const runtimeSchema = findAiOutputSchemaDescriptorBySchemaVersion(VISION_PROMPT_OUTPUT_SCHEMA_REF);
  if (!runtimeSchema) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT, file: VISION_PROMPT_TEMPLATE_PATH, line: 1, severity: "fatal", message: `Runtime output schema ${VISION_PROMPT_OUTPUT_SCHEMA_REF} is missing from the AI schema catalog.` })];
  }

  const allowedFields = new Set(listAiOutputSchemaFieldNames(runtimeSchema.schema));
  return initializer.getProperties()
    .filter((property) => Node.isPropertyAssignment(property))
    .map((property) => property.getName())
    .filter((field) => !allowedFields.has(field))
    .map((field) => createFinding({
      lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
      file: VISION_PROMPT_TEMPLATE_PATH,
      line: 1,
      severity: "fatal",
      message: `Prompt template requiredOutputSchema must not declare field "${field}". Runtime schema ${VISION_PROMPT_OUTPUT_SCHEMA_REF} is strict and would reject any model output containing it.`,
    }));
};