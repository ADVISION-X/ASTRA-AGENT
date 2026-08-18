import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { FixtureGateway, hash, order } from "./xuanxue-ai-production-fixture.js";

type SurfaceInput = {
  runtime: XuanxueAiProductionRuntime;
  gateway: FixtureGateway;
};

const acceptHashAndPayment = async ({ runtime, gateway }: SurfaceInput): Promise<void> => {
  gateway.bareOutputHashes = true;
  const canonical = order("aiprod_canonical_hash_boundary", "bazi_canonical_base_interpretation", ["base_interpretation"]);
  createXuanxueAiProductionOrder(runtime, canonical);
  const canonicalResult = await executeXuanxueAiProductionOrder(runtime, canonical.orderId);
  gateway.bareOutputHashes = false;
  assert.equal(canonicalResult.status, "completed");
  assert.ok(canonicalResult.stages.every((stage) => /^sha256:[a-f0-9]{64}$/u.test(stage.rawOutputHash ?? "")));

  const payment = order("aiprod_payment_observation", "payment_screenshot_observation", ["payment_screenshot_observation"]);
  createXuanxueAiProductionOrder(runtime, payment);
  assert.equal((await executeXuanxueAiProductionOrder(runtime, payment.orderId)).status, "completed");
};

const acceptReflection = async ({ runtime, gateway }: SurfaceInput): Promise<void> => {
  const reflection = order("aiprod_scheduled_quality_reflection", "scheduled_quality_reflection", ["scheduled_quality_reflection"]);
  createXuanxueAiProductionOrder(runtime, reflection);
  const result = await executeXuanxueAiProductionOrder(runtime, reflection.orderId);
  const request = gateway.requests.find((candidate) => candidate.taskIdentity.taskKind === "scheduled_quality_reflection");
  assert.equal(result.status, "completed");
  assert.equal(reflection.conversationParent, null);
  assert.equal(request?.providerContinuationRef, undefined);
  assert.equal(result.stages.length, 1);
};

const acceptPublicArticle = async ({ runtime, gateway }: SurfaceInput): Promise<void> => {
  const article = order("aiprod_public_article", "public_knowledge_article_pipeline", ["corpus_research", "article_synthesis", "article_image_generation"]);
  article.materials[0]!.inputRefs = [{
    id: "public-corpus-success-fixture",
    kind: "public_knowledge_ready_corpus",
    summary: "governed public knowledge corpus",
    filePath: "/fixture/public-corpus-success.md",
    fileName: "00-本领域READY古籍全集.md",
    mimeType: "text/markdown; charset=utf-8",
    sha256: hash("public-corpus-success-fixture"),
    byteCount: 29,
  }];
  createXuanxueAiProductionOrder(runtime, article);
  const uploads: string[] = [];
  const result = await executeXuanxueAiProductionOrder(runtime, article.orderId, {
    onAttachmentUploadCompleted: async ({ proof }) => {
      uploads.push(proof.uploadAttemptId);
    },
  });
  assert.equal(result.status, "completed");
  const articleRequest = gateway.requests.find((candidate) => candidate.taskIdentity.taskKind === "public_knowledge_article_pipeline" && candidate.roundId === "article_synthesis");
  const research = result.stages.find((stage) => stage.stageId === "corpus_research");
  const synthesis = result.stages.find((stage) => stage.stageId === "article_synthesis");
  const image = result.stages.find((stage) => stage.stageId === "article_image_generation");
  assert.equal(research?.attachmentUploadProof?.status, "attachments_stable");
  assert.deepEqual(uploads, [
    `fixture-upload:${article.orderId}:corpus_research`,
    `fixture-upload:${article.orderId}:article_synthesis`,
    `fixture-upload:${article.orderId}:article_image_generation`,
  ]);
  assert.equal(articleRequest?.providerContinuationRef?.priorTaskId, `${XUANXUE_AI_PRODUCTION_JOB_ID}:${article.orderId}:corpus_research`);
  assert.equal(articleRequest?.maxFileCount, article.materials.find((material) => material.stageId === "article_synthesis")!.maxFileCount + 1);
  assert.equal(synthesis?.aiFeedResult?.providerProof.webChatUrl, research?.aiFeedResult?.providerProof.webChatUrl);
  assert.equal(image?.aiFeedResult?.outputKind, "generated_image");
  assert.equal(image?.aiFeedResult?.outputArtifacts[0]?.width, 1200);
  assert.equal(image?.aiFeedResult?.outputArtifacts[0]?.height, 630);
  assert.equal(image?.aiFeedResult?.providerProof.webChatUrl, synthesis?.aiFeedResult?.providerProof.webChatUrl);
};

export const acceptXuanxueAiProductionSurface = async (input: SurfaceInput): Promise<void> => {
  await acceptHashAndPayment(input);
  await acceptReflection(input);
  await acceptPublicArticle(input);
};
