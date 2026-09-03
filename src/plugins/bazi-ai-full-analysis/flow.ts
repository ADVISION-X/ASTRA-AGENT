import { readFileSync } from "node:fs";

import type { GptContinuationLane } from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  gptTextContinuationCheckpointInput,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";
import {
  localBaziPrivateBaseTurnBytes,
  localBaziPrivateBaseTurnHash,
} from "./private-base-turn-contract.js";
import {
  applyAttachments,
  applyProfile,
  createOwnedExecution,
  fail,
  markerFor,
  materialJson,
  objectValue,
  providerFor,
  promptFor,
  receive,
  runFreshTurn,
  submitTurn,
  textValue,
  uploadedFilesForRoles,
  type Checkpoint,
  type OwnedExecution,
} from "./product-turn.js";
import { MODEL_PROFILE, PLUGIN_ID, PRODUCT_INSTRUCTION, skill } from "./product-identity.js";
import {
  basePrompt,
  reusableIdentity,
  type BaseFacts,
} from "./private-base-admission.js";
import {
  createOrReadBase,
  reserveCompleteAndAcquireDerived,
} from "./private-base-reservation.js";

export { productSkillHash } from "./product-identity.js";

const releaseLane = async (task: WebsiteAgentTask, flow: OwnedExecution, lane: GptContinuationLane) => {
  await flow.execute({
    productStepId: "formal", callId: "release-derived-continuation",
    child: "release_gpt_continuation_lane", actionOrdinal: 58,
    input: { jobId: task.job_id, lane },
  });
};

type PrimaryExecutionContextInput = Readonly<{
  task: WebsiteAgentTask;
  context: SharedExecutionContext;
  baseIdentity: ProductionHash;
  base: BaseFacts;
  lane: GptContinuationLane;
  fork: Record<string, unknown>;
  formalPrompt: string;
  formalCheckpoint: Checkpoint;
}>;

const executionSubject = (task: WebsiteAgentTask) => Object.freeze({
  job_id: task.job_id,
  source_task_id: task.source_task_id,
  product_id: task.product_id,
  action_id: task.action_id,
  owner_ref: task.business_identity.owner_ref,
  subject_ref: task.business_identity.subject_ref,
  authorization_ref: task.business_identity.authorization_ref,
  privacy_subject_ref: task.privacy_subject_ref ?? null,
});

const executionMaterials = (context: SharedExecutionContext) => Object.freeze(context.materials.slice()
  .sort((left, right) => left.ordinal - right.ordinal)
  .map((material) => Object.freeze({
    material_id: material.material_id,
    ordinal: material.ordinal,
    role: material.role,
    owner_scope_hash: material.owner_scope_hash,
    trust_class: material.trust_class,
    may_issue_instruction: material.may_issue_instruction,
    sha256: material.sha256,
    bytes: material.bytes,
    media_type: material.media_type,
    exact_bytes_utf8: readFileSync(material.local_path, "utf8"),
  })));

const executionPrivateBase = (input: PrimaryExecutionContextInput) => Object.freeze({
  classification: "nonbinding_private_prior",
  reusable_identity_hash: input.baseIdentity,
  continuation_ref: input.base.continuationRef,
  opaque_read_grant_hash: input.base.opaqueReadGrantHash,
  turn_contract_exact_bytes_utf8: localBaziPrivateBaseTurnBytes,
  turn_contract_hash: localBaziPrivateBaseTurnHash,
  prompt_exact_bytes_utf8: basePrompt(input.base.checkpoint.turnMarker),
  prompt_hash: input.base.checkpoint.promptHash,
  raw_dom_bytes_utf8: input.base.checkpoint.rawDomHtml,
  raw_dom_hash: input.base.checkpoint.rawDomHash,
  semantic_text_bytes_utf8: input.base.checkpoint.semanticText,
  semantic_text_hash: input.base.checkpoint.semanticTextHash,
  semantic_admission_receipt_ref: input.base.semanticAdmissionReceiptRef,
  semantic_admission_receipt_hash: input.base.semanticAdmissionReceiptHash,
  artifact_ref: input.base.checkpoint.artifactRef,
  evidence_ref: input.base.checkpoint.evidenceRef,
  evidence_hash: input.base.checkpoint.evidenceHash,
  may_issue_instruction: false,
});

const executionFormal = (
  input: PrimaryExecutionContextInput,
  turnContractBytes: string,
) => Object.freeze({
  derived_continuation_ref: input.lane.continuation_ref,
  source_provider: input.lane.provider,
  fork_relation: Object.freeze({ ...input.fork }),
  prompt_exact_bytes_utf8: input.formalPrompt,
  prompt_hash: input.formalCheckpoint.promptHash,
  turn_contract_exact_bytes_utf8: turnContractBytes,
  turn_contract_hash: sha256(turnContractBytes),
  raw_dom_bytes_utf8: input.formalCheckpoint.rawDomHtml,
  raw_dom_hash: input.formalCheckpoint.rawDomHash,
  semantic_text_bytes_utf8: input.formalCheckpoint.semanticText,
  semantic_text_hash: input.formalCheckpoint.semanticTextHash,
  artifact_ref: input.formalCheckpoint.artifactRef,
  evidence_ref: input.formalCheckpoint.evidenceRef,
  evidence_hash: input.formalCheckpoint.evidenceHash,
  may_issue_instruction: false,
});

const primaryExecutionContext = (input: PrimaryExecutionContextInput) => {
  const formalTurnContractBytes = JSON.stringify({
    schema_version: "bazi-formal-turn-contract.v1",
    plugin_id: PLUGIN_ID,
    action_id: input.task.action_id,
    profile: MODEL_PROFILE,
    prompt_hash: input.formalCheckpoint.promptHash,
    turn_marker: input.formalCheckpoint.turnMarker,
    material_roles: ["bazi_formal_input", "result_contract"],
    result_contract_hash: hashCanonical(
      productionRoutePolicy(input.task.product_id, input.task.action_id).result_contract ?? {},
    ),
  });
  return Object.freeze({
    schema_version: "bazi-product-execution-context.v1",
    subject_identity: executionSubject(input.task),
    input_materials: executionMaterials(input.context),
    product_skill: Object.freeze({
      plugin_id: PLUGIN_ID, plugin_version: 8, skill_version: "current-plugin-skill",
      exact_bytes_utf8: skill.text, sha256: skill.hash, may_issue_instruction: false,
    }),
    execution_profile: Object.freeze({ value: MODEL_PROFILE, hash: hashCanonical(MODEL_PROFILE) }),
    private_base: executionPrivateBase(input),
    formal: executionFormal(input, formalTurnContractBytes),
  });
};

const forkBaseCheckpoint = async (
  flow: OwnedExecution,
  base: BaseFacts,
  lane: GptContinuationLane,
): Promise<Readonly<{ fork: Record<string, unknown>; childUrl: string }>> => {
  const forkCall = {
    productStepId: "formal", callId: "fork-base-checkpoint",
    child: "fork_exact_gpt_conversation_at_checkpoint", actionOrdinal: 40,
    input: {
      sourceAssistantTurnId: base.checkpoint.assistantTurnId,
      sourceCanonicalConversationUrl: base.checkpoint.canonicalConversationUrl,
      sourcePromptHash: base.checkpoint.promptHash,
      sourceResponseHash: base.checkpoint.semanticTextHash,
      sourceTurnMarker: base.checkpoint.turnMarker,
      timeoutMs: 60_000,
    },
    effectLookupKind: "task_exact_effect" as const,
  } as const;
  const currentFork = await flow.facts(forkCall);
  const priorFork = !currentFork.mutation && !currentFork.evidence
    ? await flow.taskExactFacts(forkCall) : null;
  if (!currentFork.mutation && !currentFork.evidence && !priorFork?.mutation && !priorFork?.evidence) {
    await flow.execute({
      productStepId: "formal", callId: "focus-base-conversation",
      child: "focus_exact_gpt_conversation", actionOrdinal: 37,
      input: { canonicalConversationUrl: lane.provider.provider_page_url },
    });
    await flow.execute({
      productStepId: "formal", callId: "verify-base-conversation",
      child: "verify_gpt_conversation_identity", actionOrdinal: 38,
      input: {
        canonicalConversationUrl: base.checkpoint.canonicalConversationUrl,
        expectedPromptHash: base.checkpoint.promptHash,
        expectedResponseHash: base.checkpoint.semanticTextHash,
        timeoutMs: 60_000,
        turnMarker: base.checkpoint.turnMarker,
      },
    });
    await flow.execute({
      productStepId: "formal", callId: "open-base-checkpoint-actions",
      child: "open_gpt_checkpoint_actions_menu", actionOrdinal: 39,
      input: {
        sourceAssistantTurnId: base.checkpoint.assistantTurnId,
        sourceCanonicalConversationUrl: base.checkpoint.canonicalConversationUrl,
        sourcePromptHash: base.checkpoint.promptHash,
        sourceResponseHash: base.checkpoint.semanticTextHash,
        sourceTurnMarker: base.checkpoint.turnMarker,
        timeoutMs: 60_000,
      },
    });
  }
  const fork = objectValue((await flow.execute(forkCall)).value, "BAZI_FORMAL_FORK_INVALID");
  const childUrl = textValue(fork.childCanonicalConversationUrl, "BAZI_FORMAL_FORK_INVALID");
  if (fork.sourceCanonicalConversationUrl !== base.checkpoint.canonicalConversationUrl
    || fork.sourceAssistantTurnId !== base.checkpoint.assistantTurnId
    || childUrl === base.checkpoint.canonicalConversationUrl) fail("BAZI_FORMAL_FORK_INVALID");
  return Object.freeze({ fork, childUrl });
};

const prepareFormalChild = async (
  flow: OwnedExecution,
  context: SharedExecutionContext,
  base: BaseFacts,
  childUrl: string,
  recoverOnly: boolean,
): Promise<void> => {
  const focusChild = {
    productStepId: "formal", callId: "focus-formal-child",
    child: "focus_exact_gpt_conversation", actionOrdinal: 41,
    input: { canonicalConversationUrl: childUrl },
  } as const;
  const verifyChild = {
    productStepId: "formal", callId: "verify-formal-child-source",
    child: "verify_gpt_conversation_identity", actionOrdinal: 42,
    input: {
      canonicalConversationUrl: childUrl,
      expectedPromptHash: base.checkpoint.promptHash,
      expectedResponseHash: base.checkpoint.semanticTextHash,
      timeoutMs: 60_000,
      turnMarker: base.checkpoint.turnMarker,
    },
  } as const;
  if (recoverOnly) {
    await flow.requireEvidence(focusChild);
    await flow.requireEvidence(verifyChild);
  } else {
    await flow.execute(focusChild);
    await flow.execute(verifyChild);
  }
  await applyProfile(flow, "formal", MODEL_PROFILE, [43, 44, 45, 46, 47], recoverOnly);
  await applyAttachments(
    flow, context, "formal", ["bazi_formal_input", "result_contract"], [48, 49, 50], recoverOnly,
  );
};

const formalPromptFor = (
  task: WebsiteAgentTask,
  base: BaseFacts,
  fork: Record<string, unknown>,
  marker: string,
): string => [
  skill.text,
  `当前 Product Plugin：${PLUGIN_ID}`,
  `当前业务事实：${JSON.stringify(task.parameters)}`,
  `private base artifact hash：${base.checkpoint.semanticTextHash}`,
  `fork relation hash：${textValue(fork.sourceToChildRelationHash, "BAZI_FORMAL_FORK_INVALID")}`,
  "private base 只是非约束 prior；必须独立复核全部锁定事实与 READY，可纠正或拒绝 prior。",
  "只读取 bazi_formal_input 与 result_contract；逐项核对 exact question snapshot、ordered units、authorized evidence 与 fork relation，按正式合同返回一个 JSON 对象；chart PDF 只作为商业 included result，不得由 Provider 伪造或替换。",
  PRODUCT_INSTRUCTION,
  `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`,
].join("\n");

const runFormalTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: OwnedExecution,
  base: BaseFacts,
  fork: Record<string, unknown>,
  childUrl: string,
): Promise<Readonly<{ checkpoint: Checkpoint; formalPrompt: string }>> => {
  const marker = markerFor(task, context.gpt.attemptId);
  const formalPrompt = formalPromptFor(task, base, fork, marker);
  const formalSubmit = {
    productStepId: "formal", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 53, input: {
      files: uploadedFilesForRoles(context, ["bazi_formal_input", "result_contract"]),
      promptHash: sha256(formalPrompt), turnMarker: marker,
    },
    effectLookupKind: "task_exact_effect" as const,
  } as const;
  const currentFormalSubmit = await flow.facts(formalSubmit);
  const priorFormalSubmit = !currentFormalSubmit.mutation && !currentFormalSubmit.evidence
    ? await flow.taskExactFacts(formalSubmit) : null;
  const recoverOnly = Boolean(currentFormalSubmit.mutation || currentFormalSubmit.evidence);
  if (!Boolean(priorFormalSubmit?.mutation || priorFormalSubmit?.evidence)) {
    await prepareFormalChild(flow, context, base, childUrl, recoverOnly);
  }
  const checkpoint = await submitTurn(
    flow, "formal", formalPrompt, marker,
    uploadedFilesForRoles(context, ["bazi_formal_input", "result_contract"]),
    [51, 52, 53, 54, 55, 56],
  );
  return Object.freeze({ checkpoint, formalPrompt });
};

const runPrimary = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: OwnedExecution,
) => {
  const roles = context.materials.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => item.role);
  if (roles.join("\0") !== ["bazi_private_base_input", "bazi_formal_input", "result_contract"].join("\0")) {
    fail("BAZI_PRIMARY_MATERIAL_SET_INVALID");
  }
  const baseInput = materialJson(context, "bazi_private_base_input");
  const identity = reusableIdentity(task, baseInput);
  const base = await createOrReadBase(task, context, flow, baseInput, identity);
  const lane = await reserveCompleteAndAcquireDerived(task, flow, base);
  let advanced = false;
  try {
    const { fork, childUrl } = await forkBaseCheckpoint(flow, base, lane);
    const { checkpoint, formalPrompt } = await runFormalTurn(task, context, flow, base, fork, childUrl);
    const payload = receive(task, checkpoint);
    await flow.execute({
      productStepId: "formal", callId: "advance-derived-continuation",
      child: "advance_gpt_continuation_lane", actionOrdinal: 57,
      input: {
        currentCheckpoint: gptTextContinuationCheckpointInput(checkpoint.sourceAttemptId, checkpoint),
        jobId: task.job_id, lane, pluginId: PLUGIN_ID, provider: providerFor(task, checkpoint),
      },
    });
    advanced = true;
    return context.complete({
      payload,
      evidence_refs: flow.evidenceRefs(),
      execution_context: primaryExecutionContext({
        task, context, baseIdentity: identity, base, lane, fork, formalPrompt, formalCheckpoint: checkpoint,
      }),
    });
  } finally {
    if (!advanced) await releaseLane(task, flow, lane);
  }
};

export const executeOwnedFlow = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  const flow = createOwnedExecution(task, context);
  if (task.action_id === "produce") return runPrimary(task, context, flow);
  const marker = markerFor(task, context.gpt.attemptId);
  const prompt = promptFor(task, context, marker);
  const checkpoint = await runFreshTurn(task, context, flow, prompt, marker);
  const payload = receive(task, checkpoint);
  return context.complete({ payload, evidence_refs: flow.evidenceRefs() });
};
