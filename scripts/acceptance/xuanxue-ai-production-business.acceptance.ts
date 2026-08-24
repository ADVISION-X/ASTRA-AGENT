import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { acceptXuanxueAiProductionConcurrency } from "./xuanxue-ai-production-concurrency-acceptance.js";
import { acceptContinuousRecoveryVersion } from "./xuanxue-ai-production-continuous-reconciliation.js";
import { FixtureGateway } from "./xuanxue-ai-production-fixture.js";
import { acceptXuanxueOrderGraphs } from "./xuanxue-ai-production-order-graph-acceptance.js";
import { acceptXuanxueParentRecovery } from "./xuanxue-ai-production-parent-recovery.js";
import { acceptXuanxueAiProductionRecovery } from "./xuanxue-ai-production-recovery-acceptance.js";
import { acceptStoredOrderContractQuarantine } from "./xuanxue-ai-production-stored-order-quarantine-acceptance.js";
import { acceptXuanxueAiProductionSurface } from "./xuanxue-ai-production-surface-acceptance.js";

type BusinessAcceptanceRuntime = Readonly<{
  dataDir: string;
  gateway: FixtureGateway;
  runtime: XuanxueAiProductionRuntime;
  store: XuanxueAiProductionStore;
}>;

const createGeneratedImageGateway = async (dataDir: string): Promise<FixtureGateway> => {
  const directory = path.join(dataDir, "runtime-data", "ai-input-gateway", "generated-images");
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, "fixture-generated.png");
  const sharp = (await import("sharp")).default;
  await sharp({
    create: { width: 1400, height: 800, channels: 3, background: { r: 200, g: 181, b: 138 } },
  }).png().toFile(filePath);
  const bytes = await readFile(filePath);
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  return new FixtureGateway({
    kind: "generated_image",
    artifactRef: "artifact://fixture/generated-image",
    filePath,
    mimeType: "image/png",
    sha256,
    originalSha256: sha256,
    providerOutputRef: "artifact://fixture/generated-image",
    byteCount: bytes.byteLength,
    width: 1400,
    height: 800,
  });
};

const createBusinessAcceptanceRuntime = async (dataDir: string): Promise<BusinessAcceptanceRuntime> => {
  const gateway = await createGeneratedImageGateway(dataDir);
  const store = new XuanxueAiProductionStore(dataDir);
  return {
    dataDir,
    gateway,
    store,
    runtime: {
      candidateHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      dataDir,
      aiInputGateway: gateway,
      store,
    },
  };
};

const acceptCurrentBusinessChain = async (input: BusinessAcceptanceRuntime): Promise<void> => {
  const graphs = await acceptXuanxueOrderGraphs(input);
  await acceptXuanxueAiProductionSurface(input);
  await acceptXuanxueAiProductionRecovery(input);
  const hehunRecord = input.store.readOrder(graphs.hehun.orderId);
  assert.ok(hehunRecord, "the completed hehun order must remain in the durable ledger");
  await acceptContinuousRecoveryVersion(hehunRecord);
  await acceptXuanxueAiProductionConcurrency(input);
  await acceptXuanxueParentRecovery({
    ...input,
    qimenParent: graphs.qimenFollowupParent,
    qimenParentFinal: graphs.qimenFollowupParentFinal,
  });
};

const dataDir = await mkdtemp(path.join(tmpdir(), "xuanxue-business-acceptance-"));
let store: XuanxueAiProductionStore | undefined;
try {
  await acceptStoredOrderContractQuarantine();
  const acceptance = await createBusinessAcceptanceRuntime(dataDir);
  store = acceptance.store;
  await acceptCurrentBusinessChain(acceptance);
  process.stdout.write("[ACCEPTANCE][XUANXUE-AI-PRODUCTION-BUSINESS] PASS\n");
} finally {
  store?.close();
  await rm(dataDir, { recursive: true, force: true });
}
