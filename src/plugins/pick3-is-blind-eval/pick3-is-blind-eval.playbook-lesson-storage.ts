import type Database from "better-sqlite3";

import type { Pick3Statements } from "./pick3-is-blind-eval.storage-schema.js";
import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";

const rowToPlaybookLesson = (row: Record<string, unknown>): Pick3PlaybookLessonRecord => ({
  lessonId: String(row.lesson_id),
  batchId: String(row.batch_id),
  taskId: String(row.task_id),
  source: row.source as Pick3PlaybookLessonRecord["source"],
  status: row.status as Pick3PlaybookLessonRecord["status"],
  phase: String(row.phase),
  position: row.position as Pick3PlaybookLessonRecord["position"],
  imageId: String(row.image_id),
  predictionId: String(row.prediction_id),
  interactionId: String(row.interaction_id),
  failureReviewId: String(row.failure_review_id),
  promptPackageId: String(row.prompt_package_id),
  playbookVersionId: String(row.playbook_version_id),
  predictedLabel: row.predicted_label as Pick3PlaybookLessonRecord["predictedLabel"],
  answerLabel: row.answer_label as Pick3PlaybookLessonRecord["answerLabel"],
  aiReviewPrompt: String(row.ai_review_prompt),
  aiReviewRawText: String(row.ai_review_raw_text),
  aiReviewRawHash: String(row.ai_review_raw_hash),
  rootCause: String(row.root_cause),
  candidateLesson: String(row.candidate_lesson),
  evidenceRefsJson: String(row.evidence_refs_json),
  aggregateKey: String(row.aggregate_key),
  createdAt: String(row.created_at),
});

export const insertPlaybookLessons = (
  db: Database.Database,
  statements: Pick3Statements,
  lessons: readonly Pick3PlaybookLessonRecord[],
): void => {
  const run = db.transaction(() => {
    for (const lesson of lessons) {
      statements.insertPlaybookLesson.run(
        lesson.lessonId, lesson.batchId, lesson.taskId, lesson.source, lesson.status, lesson.phase,
        lesson.position, lesson.imageId, lesson.predictionId, lesson.interactionId, lesson.failureReviewId,
        lesson.promptPackageId, lesson.playbookVersionId, lesson.predictedLabel, lesson.answerLabel,
        lesson.aiReviewPrompt, lesson.aiReviewRawText, lesson.aiReviewRawHash, lesson.rootCause,
        lesson.candidateLesson, lesson.evidenceRefsJson, lesson.aggregateKey, lesson.createdAt,
      );
    }
  });
  run();
};

export const listPlaybookLessons = (statements: Pick3Statements, batchId: string): Pick3PlaybookLessonRecord[] =>
  statements.listPlaybookLessons.all(batchId).map((row) => rowToPlaybookLesson(row as Record<string, unknown>));

export const listPlaybookLessonsByPosition = (
  statements: Pick3Statements,
  position: Pick3PlaybookLessonRecord["position"],
): Pick3PlaybookLessonRecord[] =>
  statements.listPlaybookLessonsByPosition.all(position).map((row) => rowToPlaybookLesson(row as Record<string, unknown>));
