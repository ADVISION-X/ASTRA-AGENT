import { z } from "zod";

import {
  AiCommentSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiMapAuthoringOutputSchema,
  AiOcrCleanupOutputSchema,
  AiPagePreparationOutputSchema,
  AiProductSignalSummaryOutputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  AiVisualTargetCandidateOutputSchema,
} from "../schema-core.schema.js";

type AiOutputSchemaDescriptor = {
  schemaVersion: string;
  schema: z.ZodObject<z.ZodRawShape>;
};

const AI_OUTPUT_SCHEMA_BY_TASK_TYPE: Record<string, AiOutputSchemaDescriptor> = {
  page_preparation_judgment: { schemaVersion: "ai.page_preparation_judgment.v1", schema: AiPagePreparationOutputSchema },
  product_presence_judgment: { schemaVersion: "ai.product_presence_judgment.v1", schema: AiVisualOutputSchema },
  visual_target_candidate_analysis: { schemaVersion: "ai.visual_target_candidate_analysis.v1", schema: AiVisualTargetCandidateOutputSchema },
  ocr_cleanup: { schemaVersion: "ai.ocr_cleanup.v1", schema: AiOcrCleanupOutputSchema },
  comment_signal_summary: { schemaVersion: "ai.comment_signal_summary.v1", schema: AiCommentSignalSummaryOutputSchema },
  product_signal_summary: { schemaVersion: "ai.product_signal_summary.v1", schema: AiProductSignalSummaryOutputSchema },
  evidence_packet_analysis: { schemaVersion: "ai.evidence_packet_analysis.v1", schema: AiEvidencePacketAnalysisOutputSchema },
  map_authoring: { schemaVersion: "ai.map_authoring.v1", schema: AiMapAuthoringOutputSchema },
  schema_validation_only: { schemaVersion: "ai.schema_validation_only.v1", schema: AiSchemaValidationOnlyOutputSchema },
};

export { AI_OUTPUT_SCHEMA_BY_TASK_TYPE };
export type { AiOutputSchemaDescriptor };