import assert from "../audit/shared/governance-exam-assert.js";
import { writeFileSync } from "node:fs";

import {
  gptAttachmentProviderDisplayName,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import type {
  ExactGptContinuationQuery,
  ExactGptContinuationReadback,
  ProductPlugin,
  ProductPluginOutput,
  SharedExecutionContext,
} from "../../src/lib/local-runtime/production/plugin.js";
import type { ProductionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";

const HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
const dual = Object.freeze({ professional_markdown: "专业层", reader_explanation_markdown: "读者层" });
const common = Object.freeze({ citations: [], uncertainties: [], limitations: [], safety_notes: [] });
type ProductCall = Parameters<SharedExecutionContext["gpt"]["execute"]>[0];

type ReusableBaseFixture = Readonly<{
  reusableIdentityHash: ProductionHash;
  sourceJobId: string;
  opaqueReadGrantHash: ProductionHash;
  readback: Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>;
}>;

const parameterValue = (key: string, route: ProductionRoutePolicy): unknown => {
  const fixed: Readonly<Record<string, unknown>> = {
    evidence_ref_catalog: ["receipt:1"], analysis_kind: "chart_interpretation",
    article_package_contract_version: "public-knowledge-article-package.v1",
    observation_schema_version: "payment-screenshot-observation-v1",
    reflection_contract_version: "scheduled-quality-reflection.v1",
    target_locale: "en-US", locale: "zh-CN", thread_ref: "continuation:1",
  };
  if (key === "result_schema_version") return route.result_schema_version;
  if (key === "reusable_base_candidate") return null;
  if (Object.hasOwn(fixed, key)) return fixed[key];
  if (key === "resource_kind") {
    return route.product_id === "localization_report_translation" ? "report" : "article";
  }
  if (key.endsWith("_hash") || key.endsWith("_sha256")) return HASH;
  return `${key}:1`;
};

const taskFor = (route: ProductionRoutePolicy): WebsiteAgentTask => ({
  schema_version: "website-agent-task.v1",
  protocol_version: "xuanxue-ai-production-v6",
  job_id: `job:${route.product_id}:${route.action_id}`,
  source_task_id: `source:${route.product_id}:${route.action_id}`,
  product_id: route.product_id,
  action_id: route.action_id,
  idempotency_key: `idempotency:${route.product_id}:${route.action_id}`,
  request_hash: HASH,
  task_contract_id: "website-agent-task",
  task_contract_version: 1,
  business_identity: {
    owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1",
  },
  business_context_ref: "context:1",
  business_context_hash: HASH,
  parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, parameterValue(key, route)])),
  material_refs: route.material_roles.map((material, ordinal) => ({
    material_id: `material:${ordinal}`,
    ordinal,
    role: material.role,
    display_name: `material-${ordinal}.json`,
    object_ref: material.role === "subject_result" ? "result:subject" : `object:${ordinal}`,
    sha256: HASH,
    bytes: 10,
    media_type: material.media_types[0]!,
    storage_class: material.storage_class,
    owner_scope_hash: material.owner_scope_policy === "required" ? HASH_B : null,
    trust_class: material.trust_class,
    may_issue_instruction: material.may_issue_instruction,
  })),
  result_contract_id: "website-agent-result",
  result_contract_version: 1,
  ...(route.relation_kind === "continuation" ? {
    continuation_ref: "continuation:1",
    parent_task_ref: "task:parent",
    parent_result_ref: "result:parent",
    parent_result_hash: HASH,
  } : {}),
  ...(route.relation_kind === "review" ? {
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject",
    subject_result_hash: HASH,
    review_policy: route.action_id === "accuracy_challenge"
      ? "manual-accuracy-challenge.v1" as const
      : "scheduled-quality-reflection.v1" as const,
  } : {}),
});

const prepareMaterialFiles = (
  task: WebsiteAgentTask,
  route: ProductionRoutePolicy,
  reusableBase: ReusableBaseFixture | null,
): void => {
  let privateBaseInput: Record<string, unknown> | null = null;
  if ((task.product_id === "bazi_chart_interpretation" || task.product_id === "bazi_ai_full_analysis")
    && route.relation_kind === "primary") {
    (task as WebsiteAgentTask & { privacy_subject_ref?: string }).privacy_subject_ref = "privacy-subject:1";
    const baseContract = route.result_contract?.private_base;
    assert(baseContract && typeof baseContract === "object" && !Array.isArray(baseContract));
    const providerVisible = {
      schema_version: "bazi-private-base-input.v1",
      owner_scope_hash: task.parameters.owner_scope_hash,
      privacy_subject_ref: task.privacy_subject_ref,
      stable_base_authorization_ref: task.parameters.stable_base_authorization_ref,
      interpretive_mode: "deep",
      chart_snapshot: { snapshot_hash: HASH },
      preflight: { verdict: "READY", ready_book_set_hash: HASH },
      material_lineage: { lineage_hash: HASH, rule_catalog_hash: HASH },
      chart_field_manifest: [{ field_path: "chart.day_master", value_hash: HASH }],
      ready_books: [{ book_id: "book:1" }],
      ready_book_manifest: [{ book_id: "book:1", index_hash: HASH }],
      base_output_contract: baseContract,
    };
    const digest = hashCanonical(providerVisible);
    (task.parameters as Record<string, unknown>).reusable_base_semantic_digest = digest;
    (task.parameters as Record<string, unknown>).reusable_base_candidate = reusableBase ? {
      reusable_identity_hash: reusableBase.reusableIdentityHash,
      source_job_id: reusableBase.sourceJobId,
      opaque_read_grant_hash: reusableBase.opaqueReadGrantHash,
    } : null;
    privateBaseInput = {
      ...providerVisible,
      reusable_base_semantic_digest: digest,
    };
  }
  if (task.product_id === "bazi_report_followup" && route.relation_kind === "continuation") {
    Object.assign(task.parameters as Record<string, unknown>, {
      thread_ref: task.continuation_ref,
      current_authorization_ref: task.business_identity.authorization_ref,
      parent_raw_output_hash: task.parent_result_hash,
      parent_product_id: "bazi_chart_interpretation",
      parent_authorization_ref: "authorization:parent",
      parent_delivery_manifest_id: "manifest:parent",
      parent_delivery_manifest_hash: HASH,
      parent_lane_use_grant_hash: HASH,
    });
  }
  for (const material of task.material_refs) {
    const value = material.role === "bazi_private_base_input" ? privateBaseInput
      : material.role === "result_contract" ? (route.result_contract ?? { schema_version: "fixture.v1" })
        : { schema_version: `${material.role}.fixture.v1` };
    writeFileSync(`/tmp/${material.display_name}`, JSON.stringify(value), "utf8");
  }
};

const report = (schema_version: string, summary: string, blocks: string): Record<string, unknown> => ({
  schema_version, [summary]: dual, [blocks]: [{ section: "one" }], ...common,
});

const coreOutputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> | null => {
  switch (task.product_id) {
    case "bazi_chart_interpretation": return {
      ...report(route.result_schema_version, "report_summary", "interpretation_blocks"),
      chart_ref: task.parameters.chart_ref, chart_version: task.parameters.chart_version,
      chart_hash: task.parameters.chart_hash, bazi_pdf_semantic_manifest_ref: "manifest:1",
      manifest_hash: HASH, covered_semantic_anchor_refs: ["anchor:1"],
    };
    case "bazi_ai_full_analysis": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "bazi_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.parameters.thread_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "qimen_professional_answer": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      question_snapshot: "question", index_review_receipts: [{ index: "one" }],
      covered_question_unit_refs: ["question:1"], covered_candidate_refs: ["candidate:1"],
    };
    case "qimen_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.continuation_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      continuation_relation: "same_conversation_followup", new_question_snapshot: "question",
      index_review_receipts: [{ index: "one" }], covered_question_unit_refs: ["question:1"],
      covered_candidate_refs: ["candidate:1"],
    };
    case "hehun_ai_analysis": return {
      ...report(route.result_schema_version, "relationship_summary", "relationship_blocks"),
      case_manifest_ref: task.parameters.case_manifest_ref,
      case_manifest_hash: task.parameters.case_manifest_hash,
      question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "hehun_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.parameters.thread_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    default: return null;
  }
};

const specializedOutputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> => {
  switch (task.product_id) {
    case "naming_from_existing_bazi_report": return {
      schema_version: route.result_schema_version,
      requirement_manifest_ref: task.parameters.requirement_manifest_ref,
      requirement_manifest_hash: task.parameters.requirement_manifest_hash,
      naming_rationale: dual, candidates: [{ name: "one" }],
      comparison_or_selection_rationale: dual,
      uncertainties: [], limitations: [], safety_notes: [], covered_requirement_anchor_refs: ["requirement:1"],
    };
    case "naming_bazi_analysis_and_naming": return {
      schema_version: route.result_schema_version,
      bazi_analysis: {
        ...report("bazi-naming-basis-report-output.v1", "report_summary", "interpretation_blocks"),
        chart_ref: task.parameters.chart_ref, chart_version: task.parameters.chart_version,
        chart_hash: task.parameters.chart_hash, bazi_pdf_semantic_manifest_ref: "manifest:1",
        manifest_hash: HASH, naming_requirement_manifest_ref: "requirement:1",
        naming_requirement_manifest_hash: HASH_B, covered_semantic_anchor_refs: ["anchor:1"],
        covered_requirement_anchor_refs: ["requirement:1"],
      },
      naming: {
        schema_version: "naming-report-output.v2", requirement_manifest_ref: "requirement:1",
        requirement_manifest_hash: HASH_B, naming_rationale: dual, candidates: [{ name: "one" }],
        comparison_or_selection_rationale: dual, uncertainties: [], limitations: [], safety_notes: [],
        covered_requirement_anchor_refs: ["requirement:1"],
      },
    };
    case "localization_report_translation":
    case "localization_article_translation": return {
      schema_version: route.result_schema_version, action_id: task.product_id,
      source_resource_id: task.parameters.source_resource_id,
      source_version: task.parameters.source_version,
      source_sha256: task.parameters.source_sha256,
      target_locale: task.parameters.target_locale,
      localized_structured_payload: { title: "localized" },
    };
    case "payment_screenshot_observation": return {
      schema_version: route.result_schema_version, page_kind: "payment_success", payment_app: "alipay",
      success_visible: true, visible_amount_minor_units: 100, reason_code: "VISIBLE_SUCCESS",
    };
    default: throw new Error(`PRODUCT_FLOW_OUTPUT_MISSING:${task.product_id}`);
  }
};

const outputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> => {
  if (route.relation_kind === "review") return { decision: "no_issue", issues: [] };
  return coreOutputFor(task, route) ?? specializedOutputFor(task, route);
};

type Harness = {
  calls: ProductCall[];
  continuationReads: ExactGptContinuationQuery[];
  completed: ProductPluginOutput | null;
  facts: Map<string, Readonly<{ evidenceRef: string; mutation: boolean }>>;
  provider: GptProviderContinuation | null;
  laneOwned: boolean;
  physicalSubmitDispatches: number;
};

const callKey = (call: Omit<ProductCall, "sessionKey">): string => hashCanonical({
  productStepId: call.productStepId, callId: call.callId, child: call.child,
  actionOrdinal: call.actionOrdinal, input: call.input,
});

const initialProvider = (): GptProviderContinuation => Object.freeze({
  provider_page_url: "https://chatgpt.com/c/parent",
  prior_task_id: "task:parent",
  prior_prompt_hash: HASH,
  prior_raw_output_hash: HASH,
  prior_turn_marker: `[GRASSEYE:${"b".repeat(24)}]`,
});

const privateBaseOutput = () => ({
  schema_version: "bazi-base-interpretation-output-v2",
  interpretation_markdown: "私有基础判断",
  citations: [{ book_id: "book:1", locator: "macro:1" }],
  uncertainties: [{ topic: "候选", status: "open", detail: "待复核", impact: "有限" }],
  index_review_receipts: [{
    book_id: "book:1", index_hash: HASH, macro_entry_count: 1,
    navigation_node_count: 1, semantic_entry_count: 1,
    review_status: "complete", applicability_note: "已复核",
  }],
});

const valueForCall = (
  state: Harness,
  task: WebsiteAgentTask,
  expected: Readonly<Record<string, unknown>>,
  uploaded: readonly Readonly<Record<string, unknown>>[],
  call: ProductCall,
): unknown => {
  if (call.child === "reconcile_gpt_attachment_set") {
    const files = Array.isArray(call.input.files) ? call.input.files : [];
    return {
      files: files.map((file) => {
        assert(file && typeof file === "object" && !Array.isArray(file));
        const material = file as Readonly<Record<string, unknown>>;
        return {
          artifactRef: material.artifactRef,
          displayName: material.displayName,
          providerDisplayName: gptAttachmentProviderDisplayName(
            String(material.displayName), "attempt-1", String(material.artifactRef),
          ),
          sha256: material.sha256,
          bytes: material.bytes,
        };
      }),
    };
  }
  if (call.child === "reconcile_gpt_turn_submission") {
    return { canonicalConversationUrl: "https://chatgpt.com/c/current" };
  }
  if (call.child === "wait_for_stable_gpt_text") {
    return { assistantTurnId: "assistant:1", responseHash: HASH };
  }
  if (call.child === "checkpoint_gpt_text_response") {
    const output = call.productStepId === "private-base" ? privateBaseOutput() : expected;
    return {
      rawDomHtml: `<article>${JSON.stringify(output)}</article>`,
      rawDomHash: HASH,
      semanticText: JSON.stringify(output),
      semanticTextHash: HASH,
    };
  }
  if (call.child === "reserve_exact_gpt_continuation_once") {
    return {
      continuationRef: `gpt-continuation:${String(call.input.reservationIdentityHash).slice(7)}`,
      reservationIdentityHash: call.input.reservationIdentityHash,
      laneVersion: call.input.laneVersion,
      reservationFenceHash: call.input.reservationFenceHash,
      complete: false,
      opaqueReadGrantHash: null,
    };
  }
  if (call.child === "complete_exact_gpt_continuation_reservation_once") {
    state.provider = call.input.provider as GptProviderContinuation;
    return { completionReceiptHash: call.input.completionReceiptHash };
  }
  if (call.child === "fork_exact_gpt_conversation_at_checkpoint") {
    return {
      sourceAssistantTurnId: call.input.sourceAssistantTurnId,
      sourceCanonicalConversationUrl: call.input.sourceCanonicalConversationUrl,
      childCanonicalConversationUrl: "https://chatgpt.com/c/formal-child",
      sourceToChildRelationHash: HASH,
    };
  }
  if (call.child === "persist_gpt_continuation") {
    state.provider = call.input.provider as GptProviderContinuation;
    return { continuationRef: "continuation:created" };
  }
  if (call.child === "acquire_gpt_continuation_lane") {
    assert.equal(state.laneOwned, false);
    state.laneOwned = true;
    return { continuation_ref: call.input.continuationRef, lane_version: 1, provider: state.provider };
  }
  if (call.child === "advance_gpt_continuation_lane") {
    assert.equal(state.laneOwned, true);
    state.provider = call.input.provider as GptProviderContinuation;
    state.laneOwned = false;
  }
  if (call.child === "release_gpt_continuation_lane") state.laneOwned = false;
  return {};
};

const contextFor = (
  state: Harness,
  task: WebsiteAgentTask,
  route: ProductionRoutePolicy,
  reusableBase: ReusableBaseFixture | null,
): SharedExecutionContext => {
  const expected = outputFor(task, route);
  const uploaded = task.material_refs.map((material) => ({
    artifactRef: material.material_id,
    displayName: material.display_name,
    providerDisplayName: gptAttachmentProviderDisplayName(
      material.display_name, "attempt-1", material.material_id,
    ),
    sha256: material.sha256,
    bytes: material.bytes,
  }));
  return {
    materials: task.material_refs.map((material) => ({
      ...material, local_path: `/tmp/${material.display_name}`,
    })),
    gpt: {
      attemptId: "attempt-1",
      readContinuationExact: async (query) => {
        state.continuationReads.push(query);
        if (!reusableBase) return null;
        assert.equal(query.lookupKind, "frontier_ref");
        if (query.lookupKind !== "frontier_ref") return null;
        assert.equal(query.frontierRef, reusableBase.reusableIdentityHash);
        assert.equal(query.authorization.kind, "current_artifact_read_grant");
        if (query.authorization.kind !== "current_artifact_read_grant") return null;
        assert.equal(query.authorization.currentAuthorizationRef,
          task.business_identity.authorization_ref);
        assert.equal(query.authorization.opaqueReadGrantHash, reusableBase.opaqueReadGrantHash);
        return reusableBase.readback;
      },
      readCallFacts: async (call) => {
        const fact = state.facts.get(callKey(call));
        return {
          exactCallIdentityHash: HASH,
          mutation: fact?.mutation ? {
            owner: "browser" as const, sourceAttemptId: "attempt-1",
            effectScope: "provider_effect" as const,
            outcome: "CONFIRMED" as const, terminalAt: "2020-01-01T00:00:00.000Z",
            targetRef: "target:fixture", documentRef: "document:fixture",
            productStepId: call.productStepId, callId: call.callId,
            childCapabilityId: call.child, actionOrdinal: call.actionOrdinal,
          } : null,
          evidence: fact ? {
            owner: "forensics-persistence" as const, evidenceRef: fact.evidenceRef,
            evidenceHash: HASH, readbackVerified: true as const,
            artifactRefs: call.child === "checkpoint_gpt_text_response" ? ["artifact:checkpoint"] : [],
          } : null,
          continuation: null,
        };
      },
      execute: async (call) => {
        state.calls.push(call);
        const key = callKey(call);
        const prior = state.facts.get(key);
        if (call.child === "submit_exact_gpt_turn_once" && !prior) state.physicalSubmitDispatches += 1;
        const evidenceRef = prior?.evidenceRef ?? `evidence:${state.calls.length}`;
        state.facts.set(key, { evidenceRef, mutation: call.child === "submit_exact_gpt_turn_once" });
        return { value: valueForCall(state, task, expected, uploaded, call), evidenceRef, evidenceHash: HASH };
      },
    },
    complete: async (output) => {
      state.completed = output;
      return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
    },
  };
};

export const exerciseProductOwnedFlow = async (
  plugin: ProductPlugin,
  route: ProductionRoutePolicy,
  options: Readonly<{ reusableBase?: ReusableBaseFixture }> = {},
) => {
  const task = taskFor(route);
  const reusableBase = options.reusableBase ?? null;
  prepareMaterialFiles(task, route, reusableBase);
  const state: Harness = {
    calls: [], continuationReads: [], completed: null, facts: new Map(),
    provider: route.relation_kind === "continuation" ? initialProvider() : null,
    laneOwned: false, physicalSubmitDispatches: 0,
  };
  await plugin.execute(task, contextFor(state, task, route, reusableBase));
  assert(state.completed);
  const baziTwoTurn = route.relation_kind === "primary"
    && (plugin.pluginId === "bazi-chart-interpretation" || plugin.pluginId === "bazi-ai-full-analysis");
  assert.equal(state.physicalSubmitDispatches, baziTwoTurn && !reusableBase ? 2 : 1);
  assert.equal(state.laneOwned, false);
  assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(state.calls.every((call) => call.sessionKey.includes(plugin.pluginId)));
  const firstActionOrdinal = reusableBase ? 34 : 1;
  const expectedActionOrdinals = baziTwoTurn && !reusableBase
    ? [...Array.from({ length: 16 }, (_value, index) => index + 1),
      ...Array.from({ length: 24 }, (_value, index) => index + 33)]
    : state.calls.map((_call, index) => index + firstActionOrdinal);
  assert.deepEqual(state.calls.map((call) => call.actionOrdinal), expectedActionOrdinals);
  const prompt = state.calls.filter((call) => call.child === "write_exact_gpt_prompt").at(-1)?.input.prompt;
  assert.equal(typeof prompt, "string");
  assert.match(String(prompt), new RegExp(`当前 Product Plugin：${plugin.pluginId}`, "u"));
  for (const material of baziTwoTurn ? [] : task.material_refs) {
    assert.match(String(prompt), new RegExp(gptAttachmentProviderDisplayName(
      material.display_name, "attempt-1", material.material_id,
    ).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  return { calls: state.calls, continuationReads: state.continuationReads,
    completed: state.completed, task };
};

const reusableBaseFixtureFrom = (
  run: Awaited<ReturnType<typeof exerciseProductOwnedFlow>>,
): ReusableBaseFixture => {
  const reserve = run.calls.find((call) => call.child === "reserve_exact_gpt_continuation_once"
    && call.input.reservationKind === "reusable_origin");
  const complete = run.calls.find((call) =>
    call.child === "complete_exact_gpt_continuation_reservation_once"
    && call.productStepId === "private-base");
  assert(reserve && complete, "fresh Bazi primary must durably reserve and complete the reusable base");
  const identity = reserve.input.reservationIdentityHash as ProductionHash;
  const provider = complete.input.provider as GptProviderContinuation;
  const stored = complete.input.checkpoint as Readonly<Record<string, unknown>>;
  const semanticText = JSON.stringify(privateBaseOutput());
  const checkpoint = Object.freeze({
    checkpointKind: "text" as const,
    sourceAttemptId: String(stored.sourceAttemptId),
    assistantTurnId: String(stored.assistantTurnId),
    artifactRef: String(stored.artifactRef),
    rawDomHtml: `<article>${semanticText}</article>`,
    rawDomHash: stored.rawDomHash as ProductionHash,
    semanticText,
    semanticTextHash: stored.semanticTextHash as ProductionHash,
    canonicalConversationUrl: String(stored.canonicalConversationUrl),
    promptHash: stored.promptHash as ProductionHash,
    turnMarker: String(stored.turnMarker),
    evidenceRef: String(stored.evidenceRef),
    evidenceHash: stored.evidenceHash as ProductionHash,
  });
  const opaqueReadGrantHash = complete.input.opaqueReadGrantHash as ProductionHash;
  return Object.freeze({
    reusableIdentityHash: identity,
    sourceJobId: run.task.job_id,
    opaqueReadGrantHash,
    readback: Object.freeze({
      lookupKind: "frontier_ref" as const,
      continuationRef: `gpt-continuation:${identity.slice(7)}`,
      authorizationReadback: Object.freeze({
        kind: "current_artifact_read_grant" as const,
        currentAuthorizationRef: "authorization:1",
        ownerScopeHash: hashCanonical({ kind: "gpt-owner-scope.v1", owner_ref: "owner:1" }),
        subjectRef: "subject:1",
        sourceArtifactRef: checkpoint.artifactRef,
        sourceCheckpointRef: HASH,
        semanticAdmissionReceiptRef: String(complete.input.semanticAdmissionReceiptRef),
        semanticAdmissionReceiptHash: complete.input.semanticAdmissionReceiptHash as ProductionHash,
        opaqueReadGrantHash,
      }),
      originProvider: provider,
      originCheckpoint: checkpoint,
      currentProvider: provider,
      currentCheckpoint: checkpoint,
    }),
  });
};

export const exerciseBaziReusableBasePair = async (
  originPlugin: ProductPlugin,
  originRoute: ProductionRoutePolicy,
  reusePlugin: ProductPlugin,
  reuseRoute: ProductionRoutePolicy,
) => {
  const origin = await exerciseProductOwnedFlow(originPlugin, originRoute);
  const reusableBase = reusableBaseFixtureFrom(origin);
  const reuse = await exerciseProductOwnedFlow(reusePlugin, reuseRoute, { reusableBase });
  assert.equal(reuse.calls.some((call) => call.productStepId === "private-base"), false,
    "a completed exact base must cause zero private-base Provider or persistence actions");
  assert.equal(reuse.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 1,
    "a completed exact base must leave only the formal Provider turn");
  assert.deepEqual(reuse.continuationReads, [{
    lookupKind: "frontier_ref",
    frontierRef: reusableBase.reusableIdentityHash,
    authorization: {
      kind: "current_artifact_read_grant",
      currentAuthorizationRef: reuse.task.business_identity.authorization_ref,
      opaqueReadGrantHash: reusableBase.opaqueReadGrantHash,
    },
  }]);
  return { origin, reuse, reusableIdentityHash: reusableBase.reusableIdentityHash };
};
