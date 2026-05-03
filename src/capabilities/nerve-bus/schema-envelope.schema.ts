import { z, type RefinementCtx } from "zod";

import {
  AbilityTargetIdSchema,
  AiInputRefsSchema,
  CapabilityCallIdSchema,
  CommanderTargetIdSchema,
  EnvelopeIdSchema,
  EnvelopeStatusSchema,
  InputRefSchema,
  NerveBusEnvelopeBaseCoreSchema,
  OutputRefSchema,
  OutputSchemaRefSchema,
  PolicyRefSchema,
  ProofRefSchema,
  RequestedPlatformIdSchema,
  TargetChildCapabilityIdSchema,
  TargetRecordRefSchema,
  validateNerveBusEnvelopeBase,
} from "./schema-foundation.schema.js";

const ResultEnvelopeBaseCoreSchema = NerveBusEnvelopeBaseCoreSchema.extend({
  status: EnvelopeStatusSchema,
  correlationEnvelopeId: EnvelopeIdSchema,
  correlationCapabilityCallId: CapabilityCallIdSchema,
  correlationInputRef: InputRefSchema,
  outputRef: OutputRefSchema.nullable().default(null),
  diagnosticPayloadRef: OutputRefSchema.nullable().default(null),
  proofRef: ProofRefSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

type ResultEnvelopeBaseValue = z.infer<typeof ResultEnvelopeBaseCoreSchema>;
type ResultEnvelopeRequiredField = "outputRef" | "failureReason" | "reviewRequiredReason";
type ResultEnvelopeRequiredRule = {
  status: "success" | "failed" | "review_required";
  field: ResultEnvelopeRequiredField;
  message: string;
};

const RESULT_ENVELOPE_REQUIRED_RULES: ResultEnvelopeRequiredRule[] = [
  { status: "success", field: "outputRef", message: "Successful result envelopes must carry outputRef." },
  { status: "failed", field: "failureReason", message: "Failed result envelopes must carry failureReason." },
  { status: "review_required", field: "reviewRequiredReason", message: "Review-required result envelopes must carry reviewRequiredReason." },
];

function addResultEnvelopeIssue(context: RefinementCtx, path: [string], message: string) {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function validateRequiredResultField(value: ResultEnvelopeBaseValue, context: RefinementCtx, rule: ResultEnvelopeRequiredRule) {
  if (value.status === rule.status && !value[rule.field]) {
    addResultEnvelopeIssue(context, [rule.field], rule.message);
  }
}

function validatePayloadTraceability(
  value: ResultEnvelopeBaseValue,
  context: RefinementCtx,
  field: "outputRef" | "diagnosticPayloadRef",
  message: string,
) {
  if (value[field] && !value.payloadRef.includes(value[field])) {
    addResultEnvelopeIssue(context, [field], message);
  }
}

function validateResultEnvelopeBase(value: ResultEnvelopeBaseValue, context: RefinementCtx) {
  for (const rule of RESULT_ENVELOPE_REQUIRED_RULES) {
    validateRequiredResultField(value, context, rule);
  }
  validatePayloadTraceability(value, context, "outputRef", "outputRef must remain traceable through payloadRef.");
  validatePayloadTraceability(value, context, "diagnosticPayloadRef", "diagnosticPayloadRef must remain traceable through payloadRef.");
}

function validateGovernedResultEnvelope(value: ResultEnvelopeBaseValue, context: RefinementCtx) {
  validateNerveBusEnvelopeBase(value, context);
  validateResultEnvelopeBase(value, context);
}

export const ResultEnvelopeBaseSchema = ResultEnvelopeBaseCoreSchema.superRefine(validateGovernedResultEnvelope);

export const AbilityCommandEnvelopeSchema = NerveBusEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("ability_command"),
  channelId: z.literal("orchestration-to-ability"),
  commandId: z.string().min(1),
  from: z.literal("orchestration"),
  to: AbilityTargetIdSchema,
  targetAbilityGroupId: AbilityTargetIdSchema,
  targetChildCapabilityId: TargetChildCapabilityIdSchema,
  commandName: TargetChildCapabilityIdSchema,
  capabilityInputRef: InputRefSchema,
  expectedOutputSchemaRef: OutputSchemaRefSchema,
  postActionVerificationRequired: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  validateNerveBusEnvelopeBase(value, context);
  if (value.to !== value.targetAbilityGroupId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Ability command to must match targetAbilityGroupId.", path: ["to"] });
  }
  if (value.commandName !== value.targetChildCapabilityId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "commandName must match targetChildCapabilityId.", path: ["commandName"] });
  }
  if (value.capabilityInputRef !== value.inputRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "capabilityInputRef must match inputRef.", path: ["capabilityInputRef"] });
  }
});

export const AbilityResultEnvelopeSchema = ResultEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("ability_result"),
  channelId: z.literal("ability-to-orchestration"),
  resultId: z.string().min(1),
  from: AbilityTargetIdSchema,
  to: z.literal("orchestration"),
  targetAbilityGroupId: AbilityTargetIdSchema,
  targetChildCapabilityId: TargetChildCapabilityIdSchema,
}).strict().superRefine((value, context) => {
  validateGovernedResultEnvelope(value, context);
  if (value.from !== value.targetAbilityGroupId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Ability result from must match targetAbilityGroupId.", path: ["from"] });
  }
});

export const AiRequestEnvelopeSchema = NerveBusEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("ai_request"),
  channelId: z.literal("orchestration-to-ai"),
  requestId: z.string().min(1),
  from: z.literal("orchestration"),
  to: z.literal("ai"),
  taskType: z.string().min(1),
  promptContractId: z.string().min(1),
  promptContractVersion: z.string().min(1),
  outputSchemaRef: OutputSchemaRefSchema,
  aiInputRefs: AiInputRefsSchema,
  modelPolicyRef: PolicyRefSchema,
  providerPolicyRef: PolicyRefSchema,
}).strict().superRefine((value, context) => {
  validateNerveBusEnvelopeBase(value, context);
  if (!value.modelPolicyRef && !value.providerPolicyRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI request must declare modelPolicyRef or providerPolicyRef.", path: ["providerPolicyRef"] });
  }
});

export const AiResponseEnvelopeSchema = ResultEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("ai_response"),
  channelId: z.literal("ai-to-orchestration"),
  responseId: z.string().min(1),
  from: z.literal("ai"),
  to: z.literal("orchestration"),
  decision: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable().default(null),
}).strict().superRefine(validateGovernedResultEnvelope);

export const HumanCommandEnvelopeSchema = NerveBusEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("human_command"),
  channelId: z.literal("commander-to-orchestration"),
  commandId: z.string().min(1),
  from: z.literal("commander-console"),
  to: CommanderTargetIdSchema,
  commandType: z.string().min(1),
  commanderCommandRef: z.string().min(1),
  commanderEnvelopeRef: z.string().min(1),
  requestedPlatformId: RequestedPlatformIdSchema,
  taskTemplateId: z.string().min(1).nullable().default(null),
  targetRecordRef: TargetRecordRefSchema,
}).strict().superRefine((value, context) => {
  validateNerveBusEnvelopeBase(value, context);
  if (value.commandType === "start-mission" && !value.requestedPlatformId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "start-mission requires requestedPlatformId.", path: ["requestedPlatformId"] });
  }
});

export const HumanCommandResultEnvelopeSchema = ResultEnvelopeBaseCoreSchema.extend({
  envelopeKind: z.literal("human_command_result"),
  channelId: z.literal("orchestration-to-commander"),
  resultId: z.string().min(1),
  from: z.literal("orchestration"),
  to: z.literal("commander-console"),
}).strict().superRefine(validateGovernedResultEnvelope);