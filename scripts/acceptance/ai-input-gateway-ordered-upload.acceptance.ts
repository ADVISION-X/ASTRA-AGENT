import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const manifestName = "00-manifest.json";
const expectedNames = [
  manifestName,
  "01-case.json",
  "02-analysis-contract.json",
  "10-《滴天髓阐微》-di-tian-sui-chan-wei-正文.md",
  "11-《滴天髓阐微》-di-tian-sui-chan-wei-索引.json",
  "20-《蘭臺妙選》-lan-tai-miao-xuan-正文.md",
  "21-《蘭臺妙選》-lan-tai-miao-xuan-索引.json",
  "30-《穷通宝鉴》-qiong-tong-bao-jian-正文.md",
  "31-《穷通宝鉴》-qiong-tong-bao-jian-索引.json",
  "40-《三命通会（四库全书本）》-san-ming-tong-hui-正文.md",
  "41-《三命通会（四库全书本）》-san-ming-tong-hui-索引.json",
  "50-《神峰通考》-shen-feng-tong-kao-正文.md",
  "51-《神峰通考》-shen-feng-tong-kao-索引.json",
  "60-《五行精紀》-wu-xing-jing-ji-正文.md",
  "61-《五行精紀》-wu-xing-jing-ji-索引.json",
  "70-《子平真诠》-zi-ping-zhen-quan-正文.md",
  "71-《子平真诠》-zi-ping-zhen-quan-索引.json",
] as const;

const baseInput = {
  providerKind: "gpt-web-chat" as const,
  promptPackageId: "acceptance:ordered-upload",
  promptContractId: "acceptance:ordered-upload-v1",
  expectedOutputSchemaRef: null,
  textPrompt: "只用于逐文件上传验收。",
  modelName: null,
  timeoutMs: 30_000,
  maxInputChars: 1_000,
  maxFileCount: 1,
  maxFileBytes: 1_000,
  requestedBy: "acceptance-test" as const,
  missionId: "acceptance",
  runId: "ordered-upload",
  roundId: "ordered-upload:1",
};

const adapter: AiProviderAdapter = {
  providerKind: "gpt-web-chat",
  async feed(request) {
    return {
      rawText: "{}",
      modelName: null,
      runtimeName: "ordered-upload-acceptance",
      transport: "web-chat",
      webChatUrl: "https://chatgpt.com/c/ordered-upload-acceptance",
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: true,
      uploadedFiles: request.inputRefs.filter((ref) => ref.filePath).map((ref, index) => ({
        inputRefId: ref.id,
        step: index + 1,
        expectedAttachmentCount: index + 1,
        detectedAttachmentCount: index + 1,
        fileName: ref.fileName ?? "",
        sha256: ref.sha256?.startsWith("sha256:") ? ref.sha256 as `sha256:${string}` : `sha256:${ref.sha256}`,
        byteCount: ref.byteCount ?? 0,
      })),
      outputRefs: ["https://chatgpt.com/c/ordered-upload-acceptance"],
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "acceptance",
    };
  },
};

const attachmentRef = (input: {
  filePath: string;
  fileName: string;
  sha256: string;
  byteCount: number;
}) => ({
  id: "manifest",
  kind: "manifest",
  summary: "attachment manifest",
  mimeType: "application/json",
  ...input,
});

const assertDomCounting = async (): Promise<void> => {
  const source = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts"),
    "utf8",
  );
  for (const token of [
    "const explicitTiles = new Set()",
    "findAttachmentTileRoot(node)",
    "result.count > expectedCount",
    "result.count === expectedCount",
    "GPT_ATTACHMENT_COUNT_MISMATCH",
    "GPT_ATTACHMENT_FILENAME_MISMATCH",
    "missingFileNames",
    "unexpectedFileNames",
  ]) {
    assert.equal(source.includes(token), true, `ordered attachment counter must contain ${token}`);
  }
  assert.equal(expectedNames.length, 17);
};

const assertLocalIdentity = async (): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "grasseye-ordered-upload-"));
  try {
    const filePath = path.join(directory, manifestName);
    const bytes = Buffer.from('{"files":17}', "utf8");
    const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    await writeFile(filePath, bytes);
    const gateway = createAiInputGatewayAbilityGroup({
      dataDir: directory,
      adapters: { "gpt-web-chat": adapter },
    });
    const valid = await gateway.execute({
      ...baseInput,
      inputRefs: [attachmentRef({ filePath, fileName: manifestName, sha256, byteCount: bytes.byteLength })],
    });
    assert.equal(valid.status, "success");
    assert.equal(valid.providerProof.uploadedFiles?.[0]?.sha256, sha256);
    assert.equal(valid.providerProof.uploadedFiles?.[0]?.byteCount, bytes.byteLength);

    await assert.rejects(gateway.execute({
        ...baseInput,
        roundId: "ordered-upload:wrong-name",
        inputRefs: [attachmentRef({ filePath, fileName: "wrong-name.json", sha256, byteCount: bytes.byteLength })],
      }), /AI_FEED_FILE_NAME_MISMATCH/u);
    await assert.rejects(gateway.execute({
        ...baseInput,
        roundId: "ordered-upload:wrong-hash",
        inputRefs: [attachmentRef({ filePath, fileName: manifestName, sha256: `sha256:${"0".repeat(64)}`, byteCount: bytes.byteLength })],
      }), /AI_FEED_FILE_SHA256_MISMATCH/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

await assertDomCounting();
await assertLocalIdentity();

process.stdout.write("[ACCEPTANCE] ai-input-gateway ordered one-by-one upload PASS\n");
