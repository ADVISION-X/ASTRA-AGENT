import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import type { Pick3PlaybookLessonRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook-lesson-types.js";
import { writeCandidatePick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.js";

const artifactDir = mkdtempSync(resolve(tmpdir(), "pick3-lesson-promotion-"));
const playbooks = loadBuiltInPick3Playbooks("playbook_v1");
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
  candidateLesson: "Fixture candidate lesson for accumulated playbook promotion.",
  evidenceRefsJson: "{}",
  aggregateKey: "tens:high_exhaustion_missed",
  createdAt: new Date().toISOString(),
};

const belowThreshold = writeCandidatePick3Playbooks({
  artifactDir,
  activePlaybooks: playbooks,
  lessonsByPosition: new Map([["tens", [lessonSeed]]]),
});
assert.equal(belowThreshold.length, 0);

const candidates = writeCandidatePick3Playbooks({
  artifactDir,
  activePlaybooks: playbooks,
  lessonsByPosition: new Map([[
    "tens",
    [lessonSeed, { ...lessonSeed, lessonId: "acceptance-lesson-2" }, { ...lessonSeed, lessonId: "acceptance-lesson-3" }],
  ]]),
});
assert.equal(candidates.length, 1);
assert.equal(candidates[0]?.position, "tens");
assert.equal(candidates[0]?.status, "candidate");
assert.equal(readFileSync(candidates[0]!.contentPath, "utf8").includes("Do not memorize concrete answers"), true);

console.log("pick3-is-blind-eval playbook lessons acceptance passed");
