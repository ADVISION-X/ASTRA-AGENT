import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiFeedResult,
  type AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import { CurrentChromeBrowserController } from "../../src/lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../src/lib/browser/local-browser-session.js";
import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import {
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { acceptXuanxueOrderGraphs } from "./xuanxue-ai-production-order-graph-acceptance.js";

const runId = randomUUID();
const runRoot = await mkdtemp(
  path.join(tmpdir(), "xuanxue-ai-production-real-chrome-"),
);
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
  dataDir: runRoot,
});
const browserTarget = browser.createTargetSession("xuanxue-ai-production:real-chrome");
const prepared = await browserTarget.open({
  url: "https://chatgpt.com/",
  title: "prepare ChatGPT for xuanxue production graph acceptance",
  reusePolicy: "reuse-exact-url",
});
assert.equal(prepared.ok, true, prepared.message);

const provider = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browserTarget);

class RecordingRealGateway implements AiInputGatewayAbilityGroup {
  readonly abilityGroupId = "ai-input-gateway" as const;
  readonly requests: AiFeedInput[] = [];
  readonly results: AiFeedResult[] = [];
  readonly tokens = new Map<string, string>();

  listChildCapabilityIds() {
    return provider.listChildCapabilityIds();
  }

  getRuntimeCapacity(): number {
    return provider.getRuntimeCapacity();
  }

  async execute(
    input: unknown,
    options?: Parameters<AiInputGatewayAbilityGroup["execute"]>[1],
  ): Promise<AiFeedResult> {
    const request = input as AiFeedInput;
    this.requests.push(request);
    const token = this.tokens.get(request.taskIdentity.sourceTaskId)
      ?? `XUANXUE_${runId.slice(0, 8)}_${String(this.tokens.size + 1).padStart(2, "0")}`;
    this.tokens.set(request.taskIdentity.sourceTaskId, token);
    const fileCount = request.inputRefs.filter((ref) => ref.filePath).length;
    const actual = await provider.execute({
      ...request,
      expectedOutputSchemaRef: null,
      textPrompt: [
        "这是玄学 AI 生产工厂真实会话拓扑验收。",
        fileCount > 0
          ? `已附加 ${fileCount} 个经过系统校验的文件；请先读取，但不要复述其内容。`
          : "本轮没有附件。",
        "只回复一个 JSON 对象，不要代码块，不要解释。",
        `token 必须逐字等于 ${token}。`,
        `stage 必须逐字等于 ${request.roundId}。`,
      ].join("\n"),
      timeoutMs: Math.max(request.timeoutMs, 600_000),
    }, options);
    assert.equal(
      actual.status,
      "success",
      actual.failureReason
        ?? actual.reviewRequiredReason
        ?? `real provider failed: ${request.taskIdentity.sourceTaskId}`,
    );
    assert.match(actual.rawResponseText ?? "", new RegExp(token, "u"));
    this.results.push(actual);
    return actual;
  }

  async close(): Promise<void> {
    await provider.close?.();
  }
}

const gateway = new RecordingRealGateway();
const store = new XuanxueAiProductionStore(runRoot);
const runtime: XuanxueAiProductionRuntime = {
  dataDir: runRoot,
  aiInputGateway: gateway,
  mediaProcessing: createMediaProcessingAbilityGroupFromFilesystem({
    dataDir: runRoot,
  }),
  store,
};

try {
  await acceptXuanxueOrderGraphs({
    runtime,
    gateway,
  });

  assert.equal(gateway.requests.length, gateway.results.length);
  for (const [index, result] of gateway.results.entries()) {
    const request = gateway.requests[index]!;
    const expectedMode = request.providerForkRef
      ? "forked_from_checkpoint"
      : request.providerContinuationRef
        ? "same_conversation"
        : "fresh";
    assert.equal(result.providerProof.conversationMode, expectedMode);
    assert.ok(
      expectedMode === "fresh"
        ? result.providerProof.freshConversationProof
        : expectedMode === "same_conversation"
          ? result.providerProof.sameConversationProof
          : result.providerProof.forkedFromCheckpointProof,
      `exact ${expectedMode} proof missing for ${request.taskIdentity.sourceTaskId}`,
    );
  }

  const tokenEntries = [...gateway.tokens.entries()];
  for (const [index, result] of gateway.results.entries()) {
    const ownSource = gateway.requests[index]!.taskIdentity.sourceTaskId;
    for (const [otherSource, otherToken] of tokenEntries) {
      if (otherSource !== ownSource) {
        assert.doesNotMatch(
          result.rawResponseText ?? "",
          new RegExp(otherToken, "u"),
          `provider response for ${ownSource} leaked sibling ${otherSource}`,
        );
      }
    }
  }

  const proofFor = (sourceTaskId: string): AiFeedResult => {
    const index = gateway.requests.findIndex(
      (request) => request.taskIdentity.sourceTaskId === sourceTaskId,
    );
    assert.notEqual(index, -1, `missing request ${sourceTaskId}`);
    return gateway.results[index]!;
  };
  const nm01Author = proofFor("aiprod_nm01:naming_author");
  const nm01Files = nm01Author.providerProof.uploadedFiles ?? [];
  assert.equal(nm01Files.length, 6);
  assert.ok(nm01Files.some((file) =>
    file.inputRefId.endsWith(":typed-participant-manifest")));
  assert.equal(new Set(nm01Files.map((file) => file.fileName)).size, 6);

  const hehunFinal = proofFor("aiprod_hehun_final:final_compatibility");
  const hehunFiles = hehunFinal.providerProof.uploadedFiles ?? [];
  assert.equal(hehunFiles.length, 3);
  assert.ok(hehunFiles.some((file) =>
    file.inputRefId.endsWith(":typed-participant-manifest")));

  const nm02Author = proofFor("aiprod_nm02:naming_author");
  const nm02Files = nm02Author.providerProof.uploadedFiles ?? [];
  assert.equal(nm02Files.length, 6);
  assert.ok(nm02Files.some((file) =>
    file.inputRefId.startsWith("selected-report:")));
  assert.ok(nm02Files.some((file) =>
    file.inputRefId.endsWith(":typed-participant-manifest")));

  const scopeUrls = new Map<string, Set<string>>();
  for (const [index, request] of gateway.requests.entries()) {
    const url = gateway.results[index]!.providerProof.webChatUrl;
    assert.ok(url);
    const urls = scopeUrls.get(request.conversationScopeRef ?? "")
      ?? new Set<string>();
    urls.add(url);
    scopeUrls.set(request.conversationScopeRef ?? "", urls);
  }
  assert.ok([...scopeUrls.values()].every((urls) => urls.size === 1));

  process.stdout.write(`${JSON.stringify({
    marker: "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-GRAPH]",
    runRoot,
    runId,
    requestCount: gateway.requests.length,
    modeCounts: gateway.results.reduce<Record<string, number>>(
      (counts, result) => {
        const mode = result.providerProof.conversationMode ?? "missing";
        counts[mode] = (counts[mode] ?? 0) + 1;
        return counts;
      },
      {},
    ),
    nm01UploadedFiles: nm01Files.map((file) => file.fileName),
    hehunUploadedFiles: hehunFiles.map((file) => file.fileName),
    nm02UploadedFiles: nm02Files.map((file) => file.fileName),
    conversations: gateway.requests.map((request, index) => ({
      sourceTaskId: request.taskIdentity.sourceTaskId,
      conversationScopeRef: request.conversationScopeRef,
      mode: gateway.results[index]!.providerProof.conversationMode,
      url: gateway.results[index]!.providerProof.webChatUrl,
    })),
    status: "PASS",
  }, null, 2)}\n`);
} finally {
  await gateway.close();
}
