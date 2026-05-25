import { z } from "zod";

import { DeepResearchInteractionPhaseSchema } from "./deep-research-analysis.schema.js";

const DeepResearchPromptIdSchema = z.enum([
  "deep-research.decomposition",
  "deep-research.sub-question-analysis",
  "deep-research.final-adjudication",
  "deep-research.business-html-report-publisher",
]);

const DeepResearchPromptVersionSchema = z
  .string()
  .regex(/^v\d+\.\d+\.\d+$/u, "promptVersion must use semver-like vX.Y.Z format.");

const DeepResearchPromptOutputContractSchema = z.object({
  contractId: z.string().trim().min(1),
  format: z.enum(["json_object", "html_artifact"]),
  requiredFields: z.array(z.string().trim().min(1)).min(1),
  forbiddenFields: z.array(z.string().trim().min(1)).min(1),
}).strict();

const DeepResearchPromptSchema = z.object({
  promptId: DeepResearchPromptIdSchema,
  promptVersion: DeepResearchPromptVersionSchema,
  phase: DeepResearchInteractionPhaseSchema,
  promptText: z.string().trim().min(1),
  expectedOutputContract: DeepResearchPromptOutputContractSchema,
}).strict();

export type DeepResearchPromptOutputContract = z.infer<typeof DeepResearchPromptOutputContractSchema>;
export type DeepResearchPrompt = z.infer<typeof DeepResearchPromptSchema>;
