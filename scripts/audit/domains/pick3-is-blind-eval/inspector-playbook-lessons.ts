import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const flowPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts";
const fullHistoryAcceptancePath = "scripts/acceptance/pick3-is-blind-eval-full-history.acceptance.ts";
const historyPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.ts";
const pick3HistoryClientPath = "src/app/workbench-home-pick3-history-client.ts";
const playbookLessonsPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook-lessons.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const promptVersioningPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts";
const storageSchemaPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts";
const workbenchApiBoundaryPath = "src/app/workbench-api-boundary.ts";
const workbenchPick3RoutesPath = "src/app/workbench-pick3-routes.ts";

const readRepoTextIfExists = (repoPath: string): string => {
  const fullPath = resolveFromRepo(repoPath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (findings: InspectorFinding[], lawId: string, filePath: string, text: string, checkId: string, tokens: readonly string[]): void => {
  for (const token of tokens) if (!text.includes(token)) addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
};

export const inspectPick3PlaybookLessonStore = (input: {
  blueprintText: string;
  findings: InspectorFinding[];
  lawText: string;
  lessonStoreLaw: string;
}): void => {
  requireTokens(input.findings, input.lessonStoreLaw, lawPath, input.lawText, "pick3-is-blind-eval/playbook-lesson-law", ["GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1", "automatically create position-specific Playbook lesson records", "dedicated lesson store", "`hundreds`, `tens`, `ones`", "Manual Playbook review", "Free Analysis Strict Reasoning results must not enter the Playbook lesson store", "No automatic Playbook mutation"]);
  requireTokens(input.findings, input.lessonStoreLaw, blueprintPath, input.blueprintText, "pick3-is-blind-eval/playbook-lesson-blueprint", ["## Playbook Lesson Store Flow", "pick3_playbook_lessons", "source: auto_review | manual_review", "position: hundreds | tens | ones", "aggregate_key must begin with the position", "free_analysis_strict_reasoning must not write pick3_playbook_lessons", "POST /api/pick3-is-blind-eval/playbook-review", "no minimum lesson count before a position/aggregateKey is extracted"]);
  requireTokens(input.findings, input.lessonStoreLaw, storageSchemaPath, readRepoTextIfExists(storageSchemaPath), "pick3-is-blind-eval/playbook-lesson-storage-schema", ["CREATE TABLE IF NOT EXISTS pick3_playbook_lessons", "position TEXT NOT NULL", "aggregate_key TEXT NOT NULL", "source TEXT NOT NULL", "status TEXT NOT NULL"]);
  requireTokens(input.findings, input.lessonStoreLaw, playbookLessonsPath, readRepoTextIfExists(playbookLessonsPath), "pick3-is-blind-eval/playbook-lesson-review-runtime", ["reviewPick3PlaybookLessons", "pick3-is-blind-eval-playbook-failure-review-v1", "Do not make a new prediction", "candidateLesson", "aggregateKey: `${input.image.position}:", "source: input.source"]);
  if (readRepoTextIfExists(playbookLessonsPath).includes('promptContractId: "pick3-playbook-failure-review-v1"')) addFinding(input.findings, input.lessonStoreLaw, playbookLessonsPath, "pick3-is-blind-eval/playbook-lesson-review-contract-id-missing-pick3-substring", `${playbookLessonsPath} must not use a review promptContractId lacking the "pick3-is-blind-eval" substring; that silently disables web-chat tab reuse and rate-limit dialog handling for every review call.`);
  requireTokens(input.findings, input.lessonStoreLaw, playbookLessonsPath, readRepoTextIfExists(playbookLessonsPath), "pick3-is-blind-eval/playbook-lesson-leak-guard", ["detectPick3LessonLeak", "leaked target phase", "leaked imageId", "leaked internal front/back reveal/scoring label", "status: leakReason ? \"rejected\" : \"candidate\"", "[REJECTED: ${leakReason}]"]);
  requireTokens(input.findings, input.lessonStoreLaw, playbookLessonsPath, readRepoTextIfExists(playbookLessonsPath), "pick3-is-blind-eval/playbook-lesson-parse-retry-discard", ["PICK3_PLAYBOOK_REVIEW_MAX_ATTEMPTS = 3", "parseStrictReviewJson", "discard this", "if (!parsed) continue"]);
  for (const forbidden of ["manual_review_required", "ai_review_raw_text_not_json", "ai_review_failed"]) {
    if (readRepoTextIfExists(playbookLessonsPath).includes(forbidden)) addFinding(input.findings, input.lessonStoreLaw, playbookLessonsPath, "pick3-is-blind-eval/no-placeholder-playbook-lesson", `${playbookLessonsPath} must not store a placeholder lesson when a post-mortem reply fails to parse; it must retry up to 3 attempts and discard the failure entirely on exhaustion. Found: ${forbidden}.`);
  }
  requireTokens(input.findings, input.lessonStoreLaw, flowPath, readRepoTextIfExists(flowPath), "pick3-is-blind-eval/playbook-lesson-auto-flow", ["input.batchInput.promptMode === \"playbook_v1\"", "reviewPick3PlaybookLessons", "source: \"auto_review\"", "insertPlaybookLessons", "There is no saved candidate/promoted Playbook file", "assembled live from pick3_playbook_lessons at prompt-build time"]);
  requireTokens(input.findings, input.lessonStoreLaw, playbookLoaderPath, readRepoTextIfExists(playbookLoaderPath), "pick3-is-blind-eval/playbook-lesson-live-assembly", ["assemblePick3ExperienceSection", "experienceLessons: readonly Pick3PlaybookLessonRecord[] = []", "promptMode === \"playbook_v1\""]);
  requireTokens(input.findings, input.lessonStoreLaw, promptVersioningPath, readRepoTextIfExists(promptVersioningPath), "pick3-is-blind-eval/playbook-lesson-assembly-runtime", ["assembled live from accumulated AI-reviewed failure cases", "not a saved file, it is recomputed from current records every time", "no minimum count before experience counts", "lesson.status === \"rejected\""]);
  requireTokens(input.findings, input.lessonStoreLaw, promptVersioningPath, readRepoTextIfExists(promptVersioningPath), "pick3-is-blind-eval/playbook-lesson-read-time-leak-self-heal", ["isPick3LessonSafeToAssemble", "self-heals against any lesson rows that", "lesson.phase", "lesson.imageId", "front", "back"]);
  requireTokens(input.findings, input.lessonStoreLaw, promptVersioningPath, readRepoTextIfExists(promptVersioningPath), "pick3-is-blind-eval/playbook-lesson-self-prediction-guard", ["Self-prediction guard", "pixel-identical chart", "currentPhase", "currentImageId", "lesson.phase === current.currentPhase", "lesson.imageId === current.currentImageId"]);
  requireTokens(input.findings, input.lessonStoreLaw, playbookLoaderPath, readRepoTextIfExists(playbookLoaderPath), "pick3-is-blind-eval/playbook-lesson-self-prediction-wiring", ["currentPhase: image.targetPhase", "currentImageId: image.imageId"]);
  requireTokens(input.findings, input.lessonStoreLaw, promptVersioningPath, readRepoTextIfExists(promptVersioningPath), "pick3-is-blind-eval/playbook-lesson-no-code-side-selection", ["dead code passing judgment", "many there are", "group.map((lesson, index)", "the AI reads all of it and weighs it itself"]);
  for (const forbidden of ["const latest = group[group.length - 1]", "writeCandidatePick3Playbooks", "playbook_candidates", "mkdirSync(candidateDir", "PROMOTION_THRESHOLD", "threshold?: number", "group.length >= threshold"]) {
    if (readRepoTextIfExists(promptVersioningPath).includes(forbidden)) addFinding(input.findings, input.lessonStoreLaw, promptVersioningPath, "pick3-is-blind-eval/no-static-candidate-playbook-file", `${promptVersioningPath} must not write a static candidate Playbook file or gate experience behind a minimum-count threshold; every accepted lesson must be extracted immediately. Found: ${forbidden}.`);
  }
  requireTokens(input.findings, input.lessonStoreLaw, historyPath, readRepoTextIfExists(historyPath), "pick3-is-blind-eval/playbook-lesson-history-runtime", ["playbookLessons", "reviewPick3PlaybookLessonManually", "task.promptMode !== \"playbook_v1\"", "source: \"manual_review\"", "lessonStatus"]);
  requireTokens(input.findings, input.lessonStoreLaw, workbenchPick3RoutesPath, readRepoTextIfExists(workbenchPick3RoutesPath), "pick3-is-blind-eval/playbook-lesson-route", ["/api/pick3-is-blind-eval/playbook-review", "handlePick3ManualPlaybookReview", "reviewPick3PlaybookLessonManually"]);
  requireTokens(input.findings, input.lessonStoreLaw, workbenchApiBoundaryPath, readRepoTextIfExists(workbenchApiBoundaryPath), "pick3-is-blind-eval/playbook-lesson-api-boundary", ["/api/pick3-is-blind-eval/playbook-review", "local_pick3_playbook_lesson_manual_review", "externalApiAllowed: false"]);
  requireTokens(input.findings, input.lessonStoreLaw, pick3HistoryClientPath, readRepoTextIfExists(pick3HistoryClientPath), "pick3-is-blind-eval/playbook-lesson-ui", ["data-pick3-history-lesson-list", "runPick3ManualPlaybookReview", "data-pick3-manual-playbook-review", "renderPick3PlaybookLessons"]);
  requireTokens(input.findings, input.lessonStoreLaw, fullHistoryAcceptancePath, readRepoTextIfExists(fullHistoryAcceptancePath), "pick3-is-blind-eval/playbook-lesson-acceptance", ["free_analysis_strict_reasoning failures must not enter Playbook lessons", "reviewPick3PlaybookLessons", "aggregateKey.startsWith(\"tens:\")", "reviewPick3PlaybookLessonManually", "source, \"manual_review\""]);
};
