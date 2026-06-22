import { strict as assert } from "node:assert";

import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { assemblePick3ExperienceSection } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.js";
import type { Pick3PlaybookLessonRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook-lesson-types.js";

const playbooks = loadBuiltInPick3Playbooks("playbook_v1");
const tensPlaybook = playbooks.find((playbook) => playbook.position === "tens");
if (!tensPlaybook) throw new Error("pick3_acceptance_tens_playbook_missing");

const lessonSeed: Pick3PlaybookLessonRecord = {
  lessonId: "acceptance-lesson-1",
  batchId: "acceptance-batch",
  taskId: "acceptance-task",
  source: "auto_review",
  status: "accepted",
  phase: "260100",
  position: "tens",
  imageId: "acceptance-image",
  predictionId: "acceptance-prediction",
  interactionId: "acceptance-interaction",
  failureReviewId: "acceptance-failure",
  promptPackageId: "acceptance-package",
  playbookVersionId: "acceptance-playbook",
  predictedLabel: "front",
  answerLabel: "back",
  aiReviewPrompt: "fixture prompt",
  aiReviewRawText: "{\"rootCause\":\"fixture\",\"candidateLesson\":\"fixture\"}",
  aiReviewRawHash: "fixture-review-hash",
  rootCause: "Fixture root cause pattern.",
  candidateLesson: "Fixture candidate lesson for accumulated experience assembly.",
  evidenceRefsJson: "{}",
  aggregateKey: "tens:high_exhaustion_missed",
  createdAt: new Date().toISOString(),
};

const noLessons = assemblePick3ExperienceSection({ lessons: [] });
assert.equal(noLessons, null, "zero lessons means nothing to extract yet, not a withheld threshold");

const singleLesson = assemblePick3ExperienceSection({ lessons: [lessonSeed] });
assert.notEqual(singleLesson, null, "a single accepted lesson must be included immediately, no minimum count required");
assert.equal(singleLesson!.includes("Do not memorize concrete answers"), true);
assert.equal(singleLesson!.includes("not a hard rule"), true);
assert.equal(singleLesson!.includes("no minimum count before experience counts"), true);
assert.equal(singleLesson!.includes(lessonSeed.aggregateKey), true);

const eligibleLessons = [
  lessonSeed,
  { ...lessonSeed, lessonId: "acceptance-lesson-2", candidateLesson: "case-two-distinct-lesson-text", rootCause: "case-two-distinct-root-cause" },
  { ...lessonSeed, lessonId: "acceptance-lesson-3", candidateLesson: "case-three-distinct-lesson-text", rootCause: "case-three-distinct-root-cause" },
];
const manyLessons = assemblePick3ExperienceSection({ lessons: eligibleLessons });
assert.notEqual(manyLessons, null);
assert.equal(manyLessons!.includes("3 accumulated cases"), true);
for (const lesson of eligibleLessons) {
  assert.equal(manyLessons!.includes(lesson.candidateLesson), true, `dead code must not select/summarize cases; case-specific text "${lesson.candidateLesson}" must appear in full no matter how many cases accumulate`);
  assert.equal(manyLessons!.includes(lesson.rootCause), true, `dead code must not select/summarize cases; case-specific root cause "${lesson.rootCause}" must appear in full`);
}

const rejectedLessons = eligibleLessons.map((lesson) => ({ ...lesson, status: "rejected" as const }));
assert.equal(assemblePick3ExperienceSection({ lessons: rejectedLessons }), null, "rejected lessons must never be extracted");

// No read-time (or write-time) text-content judgment: a lesson's rootCause/candidateLesson is
// never scanned for the words "front"/"back" or for its own phase string. Code has no standing to
// judge dynamically generated AI content by keyword match — that approach false-positives on the
// AI's ordinary English usage (e.g. "rebound back toward the shoulder"). Only the structural
// self-prediction guard (same phase/imageId as what is currently being predicted) and an explicit
// status of "rejected" may exclude a lesson; text content itself is always included verbatim.
const ordinaryEnglishUsageLesson: Pick3PlaybookLessonRecord = {
  ...lessonSeed,
  lessonId: "acceptance-ordinary-english-usage",
  status: "candidate",
  rootCause: "This was wrong because the tail surged back toward the shoulder before the prior lower read should have been discounted.",
};
assert.notEqual(assemblePick3ExperienceSection({ lessons: [ordinaryEnglishUsageLesson] }), null, "a lesson using the ordinary English word 'back' must be included verbatim, never excluded by keyword match");

const phaseMentioningLesson: Pick3PlaybookLessonRecord = {
  ...lessonSeed,
  lessonId: "acceptance-phase-mentioning-text",
  status: "accepted",
  candidateLesson: `In phase ${lessonSeed.phase} the shoulder hold pattern reversed.`,
};
assert.notEqual(assemblePick3ExperienceSection({ lessons: [phaseMentioningLesson] }), null, "lesson text is never content-scanned for its own phase string either; only status and the structural self-prediction guard may exclude a lesson");

const tensImage = {
  imageId: "acceptance-image-tens",
  batchId: "acceptance-batch",
  position: "tens" as const,
  targetPhase: "260101",
  targetExpectedPrizeTime: "2026-06-20T00:00:00.000Z",
  visibleStartPhase: "260021",
  visibleEndPhase: "260100",
  imagePath: "/tmp/acceptance-tens.png",
  imageSha256: "acceptance-sha256",
  answerDigit: 7,
  answerLabel: "front" as const,
};
const noExperiencePackage = buildPick3PlaybookPromptPackage(tensPlaybook, tensImage, "playbook_v1", []);
assert.equal(noExperiencePackage.businessPrompt.includes("assembled live from accumulated"), false);

const withExperiencePackage = buildPick3PlaybookPromptPackage(tensPlaybook, tensImage, "playbook_v1", eligibleLessons);
assert.equal(withExperiencePackage.businessPrompt.includes("assembled live from accumulated"), true);
assert.equal(withExperiencePackage.businessPrompt.includes(lessonSeed.aggregateKey), true);
assert.notEqual(withExperiencePackage.businessPromptHash, noExperiencePackage.businessPromptHash);

// Self-prediction guard: a phase's blind chart is deterministic from official draws, so
// re-targeting the SAME phase regenerates the identical chart. A lesson born from that exact
// phase's own past failure must never be fed back into a prompt that predicts that same phase
// again, even though its text contains no literal phase/imageId/front-back token.
assert.equal(assemblePick3ExperienceSection({ lessons: [lessonSeed], currentPhase: lessonSeed.phase }), null, "a lesson born from the exact phase now being predicted must be excluded even with clean text");
assert.equal(assemblePick3ExperienceSection({ lessons: [lessonSeed], currentImageId: lessonSeed.imageId }), null, "a lesson born from the exact image now being predicted must be excluded even with clean text");
assert.notEqual(assemblePick3ExperienceSection({ lessons: [lessonSeed], currentPhase: "260999" }), null, "a lesson from a different phase must still be included normally");

const samePhaseImage = { ...tensImage, targetPhase: lessonSeed.phase };
const selfPredictionGuardedPackage = buildPick3PlaybookPromptPackage(tensPlaybook, samePhaseImage, "playbook_v1", [lessonSeed]);
assert.equal(selfPredictionGuardedPackage.businessPrompt.includes("assembled live from accumulated"), false, "re-targeting the same phase the lesson came from must not leak that lesson back into the prompt");

console.log("pick3-is-blind-eval playbook lessons acceptance passed");
