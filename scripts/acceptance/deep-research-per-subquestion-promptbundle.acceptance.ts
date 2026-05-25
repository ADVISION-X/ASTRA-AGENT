import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  subQuestions.forEach((subQuestion) => {
    assert(subQuestion.promptBundle.promptRole === "sub_question_analysis", `Sub-question ${subQuestion.id} must keep a sub_question_analysis promptBundle.`);
    assert(subQuestion.promptBundle.taskInstruction.length > 0, `Sub-question ${subQuestion.id} must persist a promptBundle taskInstruction.`);
  });
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

assert(analysisSubQuestions.includes("subQuestion.question.promptBundle"), "Analysis runtime must read the sub-question promptBundle directly.");
assert(prompts.includes("Missing promptBundle for sub-question"), "Prompt renderer must fail when a sub-question promptBundle is missing.");
assert(persist.includes("Missing promptBundle for sub-question"), "PromptBundle export must fail when a sub-question promptBundle is missing.");
assert(schema.includes("promptBundle: DeepResearchPromptBundleSchema.extend({"), "Persisted sub-question schema must include promptBundle.");
assert(
  !schema.includes("promptRole: z.literal(\"sub_question_analysis\"),\n  }).optional()"),
  "Persisted sub-question promptBundle must not be optional.",
);

process.stdout.write("[ACCEPTANCE][deep-research-per-subquestion-promptbundle] PASS\n");