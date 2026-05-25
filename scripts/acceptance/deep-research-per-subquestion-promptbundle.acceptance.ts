import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DeepResearchPlanSchema } from "../../src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const analysisSubQuestions = read("src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts");
const prompts = read("src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts");
const persist = read("src/plugins/deep-research-analysis/deep-research-analysis.research-plan-persist.ts");
const schema = read("src/plugins/deep-research-analysis/deep-research-analysis.schema.ts");

const fixture = createDeepResearchFullCaseFixture();

try {
  const subQuestions = fixture.fullCaseFile.researchPlan.subQuestions;
  assert(subQuestions.length >= 2, "Fixture must persist at least two sub-questions.");
  const taskInstructions = new Set(subQuestions.map((subQuestion) => subQuestion.promptBundle.taskInstruction));
  assert.equal(taskInstructions.size, subQuestions.length, "Each sub-question must keep a distinct promptBundle taskInstruction.");
  const questionSpecificFocusKeys = new Set(
    subQuestions.map((subQuestion) => subQuestion.promptBundle.questionSpecificFocus.join("\n")),
  );
  const evidenceNeedKeys = new Set(
    subQuestions.map((subQuestion) => subQuestion.promptBundle.evidenceOrReasoningNeeds.join("\n")),
  );
  const requiredContentKeys = new Set(
    subQuestions.map((subQuestion) => subQuestion.promptBundle.outputGuidance.requiredContent.join("\n")),
  );
  assert.notEqual(
    questionSpecificFocusKeys.size,
    1,
    "questionSpecificFocus must not be identical across all sub-question promptBundles.",
  );
  assert.notEqual(
    evidenceNeedKeys.size,
    1,
    "evidenceOrReasoningNeeds must not be identical across all sub-question promptBundles.",
  );
  assert.notEqual(
    requiredContentKeys.size,
    1,
    "requiredContent must not be identical across all sub-question promptBundles.",
  );
  subQuestions.forEach((subQuestion) => {
    assert(subQuestion.promptBundle.promptRole === "sub_question_analysis", `Sub-question ${subQuestion.id} must keep a sub_question_analysis promptBundle.`);
    assert(subQuestion.promptBundle.taskInstruction.length > 0, `Sub-question ${subQuestion.id} must persist a promptBundle taskInstruction.`);
  });

  const clonedPlan = structuredClone(fixture.fullCaseFile.researchPlan);
  clonedPlan.subQuestions = clonedPlan.subQuestions.map((subQuestion) => ({
    ...subQuestion,
    promptBundle: {
      ...subQuestion.promptBundle,
      questionSpecificFocus: ["same focus"],
      evidenceOrReasoningNeeds: ["same evidence"],
      outputGuidance: {
        ...subQuestion.promptBundle.outputGuidance,
        requiredContent: ["same required content"],
      },
    },
  }));
  const parsedPlan = DeepResearchPlanSchema.safeParse(clonedPlan);
  assert.equal(parsedPlan.success, false, "ResearchPlan schema must reject globally identical sub-question promptBundle focus/evidence/content fields.");
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

assert(analysisSubQuestions.includes("subQuestion.question.promptBundle"), "Analysis runtime must read the sub-question promptBundle directly.");
assert(prompts.includes("Missing promptBundle for sub-question"), "Prompt renderer must fail when a sub-question promptBundle is missing.");
assert(persist.includes("Missing promptBundle for sub-question"), "PromptBundle export must fail when a sub-question promptBundle is missing.");
assert(schema.includes("promptBundle: DeepResearchPromptBundleSchema.extend({"), "Persisted sub-question schema must include promptBundle.");
for (const marker of [
  "questionSpecificFocus must not be identical across every sub-question promptBundle.",
  "evidenceOrReasoningNeeds must not be identical across every sub-question promptBundle.",
  "requiredContent must not be identical across every sub-question promptBundle.",
]) {
  assert(read("src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts").includes(marker), `ResearchPlan schema must contain uniqueness guard: ${marker}`);
}

process.stdout.write("[ACCEPTANCE][deep-research-per-subquestion-promptbundle] PASS\n");