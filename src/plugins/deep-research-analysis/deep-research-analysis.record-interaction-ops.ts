import { createId } from "../../lib/local-runtime/ids.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import type { DeepResearchFinalAdjudicationParse } from "./deep-research-analysis.parser.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-shell.js";
import {
    createDeepResearchDatabase,
    getCurrentTimestamp,
    mapAnswerRow,
    mapExportRow,
    mapFinalAdjudicationRow,
    mapInteractionRow,
    mapResearchPlanRow,
    mapSubQuestionRow,
} from "./deep-research-analysis.record-db.js";
import {
    ResearchExportSchema,
    ResearchFinalAdjudicationRecordSchema,
    ResearchPlanRecordSchema,
    ResearchSubQuestionSchema,
    type ResearchAnswer,
    type ResearchAnswerKind,
    type ResearchExport,
    type ResearchExportKind,
    type ResearchFinalAdjudicationRecord,
    type ResearchInteraction,
    type ResearchPlanRecord,
    type ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPlan } from "./deep-research-analysis.schema.js";
import {
    DeepResearchSubQuestionSchema,
    type DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

const renderedPromptTextColumn = "rendered_prompt_text";

export const createInteraction = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    phase: ResearchInteraction["phase"];
    subQuestionId?: string | null;
    promptId: string;
    promptVersion: string;
    promptHash: string;
    renderedPromptText: string;
    domRef?: string | null;
    rawResponseText: string;
    rawResponseHash: string;
    normalizedText?: string | null;
    parseStatus: ResearchInteraction["parseStatus"];
    providerKind?: ResearchInteraction["providerKind"];
    providerProofJson?: string | null;
  },
): ResearchInteraction => {
  const id = createId("deep_research_interaction");
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_interactions (
      id, job_id, phase, sub_question_id, prompt_id, prompt_version, prompt_hash,
      ${renderedPromptTextColumn}, dom_ref, raw_response_text, raw_response_hash, normalized_text, parse_status,
      provider_kind, provider_proof_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.phase,
    input.subQuestionId ?? null,
    input.promptId,
    input.promptVersion,
    input.promptHash,
    input.renderedPromptText,
    input.domRef ?? null,
    input.rawResponseText,
    input.rawResponseHash,
    input.normalizedText ?? null,
    input.parseStatus,
    input.providerKind ?? null,
    input.providerProofJson ?? null,
    createdAt,
  );
  const row = db.prepare(`SELECT * FROM research_interactions WHERE id = ?`).get(id) as Parameters<typeof mapInteractionRow>[0] | undefined;
  if (!row) {
    throw new Error(`Deep research interaction ${id} was not persisted.`);
  }
  return mapInteractionRow(row);
};

export const listInteractions = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchInteraction[] =>
  (db.prepare(`SELECT * FROM research_interactions WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapInteractionRow>[0][])
    .map(mapInteractionRow);

export const saveSubQuestions = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    subQuestions: readonly DeepResearchSubQuestion[];
  },
): ResearchSubQuestion[] => {
  const insert = db.prepare(
    `INSERT INTO research_sub_questions (
      id, job_id, interaction_id, model_question_id, ordinal, title, question_text, purpose,
      why_it_matters, decision_weight, analysis_focus, required_evidence_json,
      scope, expected_answer_shape, priority, omission_risk, prompt_bundle_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = getCurrentTimestamp();
  const rows: ResearchSubQuestion[] = [];
  input.subQuestions.forEach((subQuestion, ordinal) => {
    const parsed = DeepResearchSubQuestionSchema.parse(subQuestion);
    const id = createId("deep_research_sub_question");
    insert.run(
      id,
      input.jobId,
      input.interactionId,
      parsed.id,
      ordinal,
      parsed.title,
      parsed.questionText,
      parsed.purpose,
      parsed.whyItMatters ?? null,
      parsed.decisionWeight ?? null,
      parsed.analysisFocus ?? null,
      JSON.stringify(parsed.requiredEvidence),
      parsed.scope,
      parsed.expectedAnswerShape,
      parsed.priority ?? null,
      parsed.omissionRisk ?? null,
      JSON.stringify(parsed.promptBundle),
      createdAt,
    );
    rows.push(ResearchSubQuestionSchema.parse({
      id,
      jobId: input.jobId,
      interactionId: input.interactionId,
      modelQuestionId: parsed.id,
      ordinal,
      question: parsed,
      createdAt,
    }));
  });
  return rows;
};

export const listSubQuestions = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchSubQuestion[] =>
  (db.prepare(`SELECT * FROM research_sub_questions WHERE job_id = ? ORDER BY ordinal ASC`).all(jobId) as Parameters<typeof mapSubQuestionRow>[0][])
    .map(mapSubQuestionRow);

export const saveResearchPlan = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    researchPlan: DeepResearchPlan;
  },
): ResearchPlanRecord => {
  const id = createId("deep_research_plan");
  const createdAt = getCurrentTimestamp();
  const researchPlanJson = JSON.stringify(input.researchPlan);
  const planHash = stableJsonHash(input.researchPlan);
  db.prepare(
    `INSERT INTO research_plans (
      id, job_id, interaction_id, research_plan_json, plan_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      interaction_id = excluded.interaction_id,
      research_plan_json = excluded.research_plan_json,
      plan_hash = excluded.plan_hash,
      created_at = excluded.created_at`,
  ).run(
    id,
    input.jobId,
    input.interactionId,
    researchPlanJson,
    planHash,
    createdAt,
  );
  const row = db.prepare(`SELECT * FROM research_plans WHERE job_id = ?`).get(input.jobId) as Parameters<typeof mapResearchPlanRow>[0] | undefined;
  if (!row) {
    throw new Error(`Deep research plan for job ${input.jobId} was not persisted.`);
  }
  return ResearchPlanRecordSchema.parse(mapResearchPlanRow(row));
};

export const getResearchPlan = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): DeepResearchPlan | null => {
  const row = db.prepare(`SELECT * FROM research_plans WHERE job_id = ?`).get(jobId) as Parameters<typeof mapResearchPlanRow>[0] | undefined;
  return row ? mapResearchPlanRow(row).researchPlan : null;
};

export const saveAnswer = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    subQuestionId: string;
    answerKind: ResearchAnswerKind;
    answerText: string;
    keyPoints?: readonly string[];
    evidenceMentions?: readonly string[];
    assumptions?: readonly string[];
    limitations: readonly string[];
    contradictionPoints?: readonly string[];
    parsedPayload?: Record<string, unknown>;
  },
): ResearchAnswer => {
  const id = createId(`deep_research_${input.answerKind}`);
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_answers (
      id, job_id, interaction_id, sub_question_id, answer_kind, answer_text,
      key_points_json, evidence_mentions_json, assumptions_json, limitations_json,
      contradiction_points_json, parsed_payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.interactionId,
    input.subQuestionId,
    input.answerKind,
    input.answerText,
    JSON.stringify(input.keyPoints ?? []),
    JSON.stringify(input.evidenceMentions ?? []),
    JSON.stringify(input.assumptions ?? []),
    JSON.stringify(input.limitations),
    JSON.stringify(input.contradictionPoints ?? []),
    JSON.stringify(input.parsedPayload ?? {}),
    createdAt,
  );
  const row = db.prepare(`SELECT * FROM research_answers WHERE id = ?`).get(id) as Parameters<typeof mapAnswerRow>[0] | undefined;
  if (!row) {
    throw new Error(`Deep research answer ${id} was not persisted.`);
  }
  return mapAnswerRow(row);
};

export const listAnswers = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    answerKind?: ResearchAnswerKind;
  },
): ResearchAnswer[] => {
  const rows = input.answerKind
    ? (db.prepare(`SELECT * FROM research_answers WHERE job_id = ? AND answer_kind = ? ORDER BY created_at ASC`).all(input.jobId, input.answerKind) as Parameters<typeof mapAnswerRow>[0][])
    : (db.prepare(`SELECT * FROM research_answers WHERE job_id = ? ORDER BY created_at ASC`).all(input.jobId) as Parameters<typeof mapAnswerRow>[0][]);
  return rows.map(mapAnswerRow);
};

export const saveFinalAdjudication = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    promptId: string;
    promptVersion: string;
    parsed: DeepResearchFinalAdjudicationParse;
    promptBundleSnapshot: unknown;
  },
): ResearchFinalAdjudicationRecord => {
  const id = createId("deep_research_final_adjudication");
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_final_adjudications (
      id, job_id, interaction_id, prompt_id, prompt_version, raw_final_answer_text,
      raw_response_hash, preferred_format, parsed_json_index_json, parse_status,
      prompt_bundle_snapshot_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.interactionId,
    input.promptId,
    input.promptVersion,
    input.parsed.rawFinalAnswerText,
    input.parsed.rawResponseHash,
    input.parsed.preferredFormat,
    input.parsed.parsedJsonIndex === null ? null : JSON.stringify(input.parsed.parsedJsonIndex),
    input.parsed.parseStatus,
    JSON.stringify(input.promptBundleSnapshot),
    createdAt,
  );
  return ResearchFinalAdjudicationRecordSchema.parse({
    id,
    jobId: input.jobId,
    interactionId: input.interactionId,
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    rawFinalAnswerText: input.parsed.rawFinalAnswerText,
    rawResponseHash: input.parsed.rawResponseHash,
    preferredFormat: input.parsed.preferredFormat,
    parsedJsonIndex: input.parsed.parsedJsonIndex,
    parseStatus: input.parsed.parseStatus,
    promptBundleSnapshot: input.promptBundleSnapshot,
    createdAt,
  });
};

export const getLatestFinalAdjudication = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchFinalAdjudicationRecord | null => {
  const row = db.prepare(
    `SELECT * FROM research_final_adjudications WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
  ).get(jobId) as Parameters<typeof mapFinalAdjudicationRow>[0] | undefined;
  return row ? mapFinalAdjudicationRow(row) : null;
};

export const saveExport = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    exportKind: ResearchExportKind;
    filePath: string;
    fileHash: string;
    payload: unknown;
  },
): ResearchExport => {
  const id = createId("deep_research_export");
  const createdAt = getCurrentTimestamp();
  const payloadHash = stableJsonHash(input.payload);
  const payloadJson = JSON.stringify(input.payload);
  db.prepare(
    `INSERT INTO research_exports (
      id, job_id, export_kind, file_path, file_hash, payload_hash, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.exportKind,
    input.filePath,
    input.fileHash,
    payloadHash,
    payloadJson,
    createdAt,
  );
  return ResearchExportSchema.parse({
    id,
    jobId: input.jobId,
    exportKind: input.exportKind,
    filePath: input.filePath,
    fileHash: input.fileHash,
    payloadHash,
    payloadJson,
    createdAt,
  });
};

export const listExports = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchExport[] =>
  (db.prepare(`SELECT * FROM research_exports WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapExportRow>[0][])
    .map(mapExportRow);

export const buildDeepResearchPromptBundleExport = (input: {
  researchPlan: DeepResearchPlan;
  subQuestions: readonly ResearchSubQuestion[];
}): {
  subQuestionPromptBundles: { subQuestionId: string; modelQuestionId: string; promptBundle: DeepResearchPromptBundle }[];
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
  htmlReportPromptBundle: DeepResearchPromptBundle;
} => ({
  subQuestionPromptBundles: input.subQuestions.map((subQuestion) => {
    const promptBundle = subQuestion.question.promptBundle;
    if (!promptBundle) {
      throw new Error(`Missing promptBundle for sub-question ${subQuestion.id}.`);
    }
    return {
      subQuestionId: subQuestion.id,
      modelQuestionId: subQuestion.modelQuestionId,
      promptBundle,
    };
  }),
  finalAdjudicationPromptBundle: input.researchPlan.finalAdjudicationPromptBundle,
  htmlReportPromptBundle: input.researchPlan.htmlReportPromptBundle,
});
