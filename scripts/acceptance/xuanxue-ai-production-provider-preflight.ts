import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { XuanxueAiProductionCloudClaimedJobSchema } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.js";
import { runXuanxueProviderInputPreflight } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-input-preflight.js";
import type { AiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";

const canonical = (value:unknown):unknown => Array.isArray(value)
  ? value.map(canonical)
  : typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]))
    : value;
const hash=(value:unknown):`sha256:${string}`=>`sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;

const input = {
  input_id: "corpus-1", ordinal: 0, kind: "ready_book_corpus_part_text",
  summary: "full corpus", file_name: "corpus-1.md", mime_type: "text/markdown",
  sha256: hash("corpus"), byte_count: 6, object_ref: "private/corpus-1",
};

const request = {
  schema_version: "ai-production-provider-input-preflight-request.v1",
  source_task_id: "pkrun_acceptance", product_id: "public_knowledge_article_pipeline",
  input_bundle_ref: "bundle:acceptance", input_bundle_hash: hash("bundle"),
  stage_id: "corpus_research",
  inputs: [{
    input_id: input.input_id, ordinal: input.ordinal, file_name: input.file_name,
    sha256: input.sha256, byte_count: input.byte_count, object_ref: input.object_ref,
  }],
};

const receiptBase = {
  schema_version: "ai-production-provider-input-preflight-receipt.v1", status: "verified",
  source_task_id: request.source_task_id, product_id: request.product_id,
  input_bundle_ref: request.input_bundle_ref, input_bundle_hash: request.input_bundle_hash,
  stage_id: request.stage_id, input_set_hash: hash(request),
  files: [{
    input_id: input.input_id, ordinal: 0, file_name: input.file_name,
    sha256: input.sha256, byte_count: input.byte_count,
    provider_receipt_ref: "resp_acceptance:file_acceptance",
  }],
  provider_profile_ref: "chatgpt-web:browser-attachment-upload:no-local-capacity-gate.v1",
  provider_profile_hash: hash("profile"), issued_at: "2026-08-16T00:00:00.000Z",
};
const receipt = { ...receiptBase, receipt_hash: hash(receiptBase) };

const frozenSubject = {
  privacy_owner_ref: "public-knowledge", snapshot_ref: "snapshot:acceptance",
  snapshot_hash: hash("snapshot"), case_revision_ref: "acceptance", primary_person_ref: null,
  participant_manifest_hash: hash([]),
  participants: [{
    slot_ref: "public-content", role_code: "public-content", person_ref: "public-knowledge",
    profile_version_ref: "v1", chart_state_ref: "none", chart_state_version: "v1",
    chart_state_hash: hash("none"), purpose_code: "public_knowledge_article_pipeline",
    authorization_receipt_ref: "scheduled-public-content",
  }],
};

const material = {
  stage_id: "corpus_research", instruction_package_id: "acceptance",
  output_contract_ref: "public-knowledge-corpus-research.v3",
  output_schema_ref: "public-knowledge-research-output.v3", expected_output_kind: "text",
  task_directive: "research", timeout_ms: 60000, max_input_chars: 10000, max_file_count: 8,
  inputs: [input], provider_input_preflight_receipt: receipt,
  control_plane: "excluded_specialized_capability", exclusion_reason: "public_knowledge_article_pipeline",
};

const claimIdentity = {
  protocol_version: "xuanxue-ai-production-v4", job_id: "aiprod_preflight_acceptance",
  idempotency_key: "preflight-acceptance", source_task_id: request.source_task_id,
  product_id: request.product_id, service_class: "public_content",
  trigger_kind: "scheduled_public_content", lineage_id: null, reflection_snapshot_ref: null,
  reflection_plan_id: null, input_bundle_ref: request.input_bundle_ref,
  input_bundle_hash: request.input_bundle_hash, request_hash: hash("job-request"), frozen_subject: frozenSubject,
  conversation_scope_ref: "public-knowledge:acceptance",
};
const claimConversation = {
  conversation_parent: null, join_parents: [], seeded_stages: [], continuation_parent_replay: null,
  execution_lane: "supervised_local_gpt_web", materials: [material],
};
const claimLease = {
  status: "leased", lease_owner: "device:acceptance", lease_expires_at: "2026-08-16T00:05:00.000Z",
  retry_not_before: null, result_json: null, failure_ledger: [],
  created_at: "2026-08-16T00:00:00.000Z", updated_at: "2026-08-16T00:00:00.000Z",
  lease_token: "lease-acceptance", lease_version: 1,
};
const claim = { ...claimIdentity, ...claimConversation, ...claimLease };

export async function acceptXuanxueProviderPreflightContract():Promise<void>{
  assert.doesNotThrow(()=>XuanxueAiProductionCloudClaimedJobSchema.parse(claim));
  assert.throws(()=>XuanxueAiProductionCloudClaimedJobSchema.parse({...claim,materials:[{...claim.materials[0],provider_input_preflight_receipt:undefined}]}),/PROVIDER_INPUT_PREFLIGHT_REQUIRED/u);
  assert.throws(()=>XuanxueAiProductionCloudClaimedJobSchema.parse({...claim,materials:[{...claim.materials[0],provider_input_preflight_receipt:{...receipt,files:[{...receipt.files[0]!,sha256:hash("wrong")}]}}]}),/PROVIDER_INPUT_PREFLIGHT_INVALID/u);

  const corpusBytes=Buffer.from("corpus","utf8");
  const corpusHash=`sha256:${createHash("sha256").update(corpusBytes).digest("hex")}` as const;
  const gateway={
    preflightApprovedWebChatFiles:async(raw:unknown)=>{
      const parsed=raw as {inputRefs:Array<{id:string;fileName:string;sha256:`sha256:${string}`;byteCount:number}>};
      const startedAt=new Date().toISOString();
      return{uploadedFiles:parsed.inputRefs.map((item,index)=>({inputRefId:item.id,step:index+1,expectedAttachmentCount:parsed.inputRefs.length,detectedAttachmentCount:parsed.inputRefs.length,fileName:item.fileName,sha256:item.sha256,byteCount:item.byteCount})),attachmentUploadProof:{childCapabilityId:"attach-approved-web-chat-files-once" as const,uploadAttemptId:"preflight-upload-acceptance",transportKind:"exact_target_file_input_batch" as const,expectedFileCount:parsed.inputRefs.length,detectedFileCount:parsed.inputRefs.length,stagingManifestHash:hash("staging"),files:parsed.inputRefs.map((item,index)=>({inputRefId:item.id,order:index+1,sourceFileName:item.fileName,displayFileName:item.fileName,sha256:item.sha256,byteCount:item.byteCount})),startedAt,endedAt:new Date().toISOString(),status:"attachments_stable" as const,failureReason:null,reviewRequiredReason:null}};
    },
  } as AiInputGatewayAbilityGroup;
  const agentResult=await runXuanxueProviderInputPreflight({rawInput:{schema_version:"xuanxue-ai-production-provider-input-preflight-request.v1",source_task_id:"pkrun_acceptance",input_set_hash:hash("input-set"),files:[{input_id:"corpus-1",ordinal:0,file_name:"corpus.md",mime_type:"text/markdown",sha256:corpusHash,byte_count:corpusBytes.byteLength,bytes_base64:corpusBytes.toString("base64")}]},aiInputGateway:gateway});
  assert.equal(agentResult.status,"verified");
  assert.equal(agentResult.files.length,1);
  assert.match(agentResult.files[0]!.provider_receipt_ref,/^chatgpt-web-upload:/u);
  assert.equal(agentResult.provider_profile_ref,"chatgpt-web:browser-attachment-upload:no-local-capacity-gate.v1");
}
