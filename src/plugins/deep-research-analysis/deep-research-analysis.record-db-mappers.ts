import { z } from "zod";

import type {
  DeepResearchInput,
  DeepResearchInteractionPhase,
  DeepResearchJobStatus,
  DeepResearchParseStatus,
  DeepResearchPhase,
  DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import type {
  DeepResearchConflictMatrixRow,
} from "./deep-research-analysis.result.js";
import {
  LEGACY_RENDERED_PROMPT_TEXT,
  ResearchAnswerSchema,
  ResearchConflictMatrixSchema,
  ResearchExportSchema,
  ResearchFinalReportRecordSchema,
  ResearchInteractionSchema,
  ResearchJobSchema,
  ResearchSubQuestionSchema,
  type ResearchAnswer,
  type ResearchAnswerKind,
  type ResearchConflictMatrix,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalReportRecord,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";

const parseStringArray = (value: string): string[] =>
  z.array(z.string().trim().min(1)).parse(JSON.parse(value));

const parseUnknownRecord = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
};

export const mapJobRow = (row: {
  id: string;
  user_question: string;
  analysis_goal: string | null;
  language: DeepResearchInput["language"];
  max_sub_questions: number;
  output_format: DeepResearchInput["outputFormat"];
  flow_mode: ResearchJob["flowMode"] | null;
  status: DeepResearchJobStatus;
  phase: DeepResearchPhase;
  failure_reason: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}): ResearchJob =>
  ResearchJobSchema.parse({
    id: row.id,
    userQuestion: row.user_question,
    analysisGoal: row.analysis_goal,
    language: row.language,
    maxSubQuestions: row.max_sub_questions,
    outputFormat: row.output_format,
    flowMode: row.flow_mode ?? "legacy_1_n_n_1",
    status: row.status,
    phase: row.phase,
    failureReason: row.failure_reason,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export const mapSubQuestionRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  model_question_id: string;
  ordinal: number;
  title: string;
  question_text: string;
  purpose: string;
  why_it_matters: string | null;
  decision_weight: DeepResearchSubQuestion["decisionWeight"] | null;
  analysis_focus: string | null;
  required_evidence_json: string;
  scope: string;
  expected_answer_shape: string;
  priority: DeepResearchSubQuestion["priority"] | null;
  omission_risk: string | null;
  created_at: string;
}): ResearchSubQuestion =>
  ResearchSubQuestionSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    modelQuestionId: row.model_question_id,
    ordinal: row.ordinal,
    question: {
      id: row.model_question_id,
      title: row.title,
      questionText: row.question_text,
      purpose: row.purpose,
      ...(row.why_it_matters ? { whyItMatters: row.why_it_matters } : {}),
      ...(row.decision_weight ? { decisionWeight: row.decision_weight } : {}),
      ...(row.analysis_focus ? { analysisFocus: row.analysis_focus } : {}),
      requiredEvidence: parseStringArray(row.required_evidence_json),
      scope: row.scope,
      expectedAnswerShape: row.expected_answer_shape,
      ...(row.priority ? { priority: row.priority } : {}),
      ...(row.omission_risk ? { omissionRisk: row.omission_risk } : {}),
    },
    createdAt: row.created_at,
  });

export const mapInteractionRow = (row: {
  id: string;
  job_id: string;
  phase: DeepResearchInteractionPhase;
  sub_question_id: string | null;
  prompt_id: string;
  prompt_version: string;
  prompt_hash: string;
  rendered_prompt_text: string | null;
  dom_ref: string | null;
  raw_response_text: string;
  raw_response_hash: string;
  normalized_text: string | null;
  parse_status: DeepResearchParseStatus;
  provider_kind: ResearchInteraction["providerKind"] | null;
  provider_proof_json: string | null;
  created_at: string;
}): ResearchInteraction =>
  ResearchInteractionSchema.parse({
    id: row.id,
    jobId: row.job_id,
    phase: row.phase,
    subQuestionId: row.sub_question_id,
    promptId: row.prompt_id,
    promptVersion: row.prompt_version,
    promptHash: row.prompt_hash,
    renderedPromptText: row.rendered_prompt_text ?? LEGACY_RENDERED_PROMPT_TEXT,
    domRef: row.dom_ref,
    rawResponseText: row.raw_response_text,
    rawResponseHash: row.raw_response_hash,
    normalizedText: row.normalized_text,
    parseStatus: row.parse_status,
    providerKind: row.provider_kind,
    providerProofJson: row.provider_proof_json,
    createdAt: row.created_at,
  });

export const mapAnswerRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  sub_question_id: string;
  answer_kind: ResearchAnswerKind;
  answer_text: string;
  key_points_json: string;
  evidence_mentions_json: string;
  assumptions_json: string;
  limitations_json: string;
  contradiction_points_json: string;
  parsed_payload_json: string;
  confidence: ResearchAnswer["confidence"];
  created_at: string;
}): ResearchAnswer =>
  ResearchAnswerSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    subQuestionId: row.sub_question_id,
    answerKind: row.answer_kind,
    answerText: row.answer_text,
    keyPoints: parseStringArray(row.key_points_json),
    evidenceMentions: parseStringArray(row.evidence_mentions_json),
    assumptions: parseStringArray(row.assumptions_json),
    limitations: parseStringArray(row.limitations_json),
    contradictionPoints: parseStringArray(row.contradiction_points_json),
    parsedPayload: parseUnknownRecord(row.parsed_payload_json),
    confidence: row.confidence,
    createdAt: row.created_at,
  });

export const mapConflictRow = (row: {
  id: string;
  job_id: string;
  sub_question_id: string;
  positive_claim_summary: string;
  falsification_summary: string;
  conflict_level: DeepResearchConflictMatrixRow["conflictLevel"];
  evidence_gap: string;
  needs_human_review: number;
  created_at: string;
}): ResearchConflictMatrix =>
  ResearchConflictMatrixSchema.parse({
    id: row.id,
    jobId: row.job_id,
    row: {
      subQuestionId: row.sub_question_id,
      positiveClaimSummary: row.positive_claim_summary,
      falsificationSummary: row.falsification_summary,
      conflictLevel: row.conflict_level,
      evidenceGap: row.evidence_gap,
      needsHumanReview: row.needs_human_review === 1,
    },
    createdAt: row.created_at,
  });

export const mapFinalReportRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  report_json: string;
  report_hash: string;
  created_at: string;
}): ResearchFinalReportRecord =>
  ResearchFinalReportRecordSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    report: DeepResearchFinalReportSchema.parse(JSON.parse(row.report_json)),
    reportHash: row.report_hash,
    createdAt: row.created_at,
  });

export const mapExportRow = (row: {
  id: string;
  job_id: string;
  export_kind: ResearchExportKind;
  file_path: string;
  file_hash: string;
  payload_hash: string;
  created_at: string;
}): ResearchExport =>
  ResearchExportSchema.parse({
    id: row.id,
    jobId: row.job_id,
    exportKind: row.export_kind,
    filePath: row.file_path,
    fileHash: row.file_hash,
    payloadHash: row.payload_hash,
    createdAt: row.created_at,
  });