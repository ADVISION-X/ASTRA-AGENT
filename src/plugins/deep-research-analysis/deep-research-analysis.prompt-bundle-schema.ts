import { z } from "zod";

export const DeepResearchPromptBundleRoleSchema = z.enum([
  "sub_question_analysis",
  "final_adjudication",
  "html_report_publisher",
]);

export const DeepResearchPromptBundleSchema = z.object({
  promptBundleId: z.string().trim().min(1),
  promptRole: DeepResearchPromptBundleRoleSchema,
  taskInstruction: z.string().trim().min(1),
  questionSpecificFocus: z.array(z.string().trim().min(1)).min(1),
  mustUseInputs: z.array(z.string().trim().min(1)).min(1),
  mustNotDo: z.array(z.string().trim().min(1)).default([]),
  evidenceOrReasoningNeeds: z.array(z.string().trim().min(1)).default([]),
  outputGuidance: z.object({
    preferredFormat: z.enum(["json_object", "structured_text", "html_document"]),
    requiredContent: z.array(z.string().trim().min(1)).default([]),
    supplementalContent: z.array(z.string().trim().min(1)).default([]),
    forbiddenContent: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  safetyBoundary: z.array(z.string().trim().min(1)).default([]),
  languageInstruction: z.string().trim().min(1),
}).strict();

export type DeepResearchPromptBundle = z.infer<typeof DeepResearchPromptBundleSchema>;
