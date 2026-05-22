import { createId } from "../../lib/local-runtime/ids.js";
import {
  DeepResearchSubQuestionSchema,
  type DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import {
  ResearchSubQuestionSchema,
  type ResearchAnswer,
  type ResearchAnswerKind,
  type ResearchInteraction,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import {
  createDeepResearchDatabase,
  getCurrentTimestamp,
  mapAnswerRow,
  mapInteractionRow,
  mapSubQuestionRow,
} from "./deep-research-analysis.record-db.js";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

export const createInteraction = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    phase: ResearchInteraction["phase"];
    subQuestionId?: string | null;
    promptId: string;
    promptVersion: string;
    promptHash: string;
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
      dom_ref, raw_response_text, raw_response_hash, normalized_text, parse_status,
      provider_kind, provider_proof_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.phase,
    input.subQuestionId ?? null,
    input.promptId,
    input.promptVersion,
    input.promptHash,
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
      id, job_id, interaction_id, ordinal, title, question_text, purpose, scope,
      expected_answer_shape, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = getCurrentTimestamp();
  const rows: ResearchSubQuestion[] = [];
  input.subQuestions.forEach((subQuestion, ordinal) => {
    const parsed = DeepResearchSubQuestionSchema.parse(subQuestion);
    insert.run(
      parsed.id,
      input.jobId,
      input.interactionId,
      ordinal,
      parsed.title,
      parsed.questionText,
      parsed.purpose,
      parsed.scope,
      parsed.expectedAnswerShape,
      createdAt,
    );
    rows.push(ResearchSubQuestionSchema.parse({
      id: parsed.id,
      jobId: input.jobId,
      interactionId: input.interactionId,
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
    confidence: ResearchAnswer["confidence"];
  },
): ResearchAnswer => {
  const id = createId(`deep_research_${input.answerKind}`);
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_answers (
      id, job_id, interaction_id, sub_question_id, answer_kind, answer_text,
      key_points_json, evidence_mentions_json, assumptions_json, limitations_json,
      contradiction_points_json, confidence, created_at
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
    input.confidence,
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