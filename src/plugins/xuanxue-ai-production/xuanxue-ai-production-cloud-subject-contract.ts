import { z } from "zod";

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const CloudFrozenSubjectSchema = z.object({
  privacy_owner_ref: z.string().min(1),
  snapshot_ref: z.string().min(1),
  snapshot_hash: hashSchema,
  case_revision_ref: z.string().min(1),
  primary_person_ref: z.string().min(1).nullable(),
  participant_manifest_hash: hashSchema,
  participants: z.array(z.object({
    slot_ref: z.string().min(1),
    role_code: z.string().min(1),
    person_ref: z.string().min(1),
    profile_version_ref: z.string().min(1),
    chart_state_ref: z.string().min(1),
    chart_state_version: z.string().min(1),
    chart_state_hash: hashSchema,
    purpose_code: z.string().min(1),
    authorization_receipt_ref: z.string().min(1),
  }).strict()).max(32),
}).strict().superRefine((subject, context) => {
  const contextOnlyOwner = subject.privacy_owner_ref === "localization-catalog"
    || subject.privacy_owner_ref === "public-knowledge-content";
  const contextOnly = contextOnlyOwner && subject.primary_person_ref === null;
  if (!contextOnly && subject.participants.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_FROZEN_SUBJECT_PARTICIPANT_REQUIRED",
      path: ["participants"],
    });
  }
  if (contextOnly && subject.participants.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTEXT_ONLY_SUBJECT_MUST_NOT_HAVE_PARTICIPANTS",
      path: ["participants"],
    });
  }
});
