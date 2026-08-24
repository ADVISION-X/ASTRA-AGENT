import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
export type XuanxueAiBrowserHash = `sha256:${string}`;

export type XuanxueAiBrowserExecutionBinding = Readonly<{
  kind: "xuanxue";
  ownerPluginId: "xuanxue-ai-production";
  jobId: string;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  localOrderId: string;
  contractManifestHash: XuanxueAiBrowserHash;
  executionRef: string;
  jobRefHash: XuanxueAiBrowserHash;
  executionRefHash: XuanxueAiBrowserHash;
  writerLeaseEpoch: number;
  writerFenceHash: XuanxueAiBrowserHash;
  candidateHash: XuanxueAiBrowserHash;
  commandTtlMs: number;
}>;

export type XuanxueAiBrowserTargetLease = NonNullable<
  NonNullable<Parameters<AiInputGatewayAbilityGroup["execute"]>[1]>["browser"]
>;

export type XuanxueAiExecutionDeadlineBudget = {
  expiresAtMonotonic: number;
  commandTtlMs: number;
};

export type XuanxueAiBrowserAuthorityPort = Readonly<{
  acquireOperatorClaimedTargetLease(
    binding: XuanxueAiBrowserExecutionBinding,
    ownerId: string,
  ): Promise<XuanxueAiBrowserTargetLease>;
  readProductionRuntimeState?(): Readonly<{
    browserAuthorityState: "present" | "absent";
    browserTargetState: "claimed" | "absent";
  }>;
}>;

export interface XuanxueAiProductionRuntime {
  readonly aiInputGateway: AiInputGatewayAbilityGroup;
  readonly candidateHash: XuanxueAiBrowserHash;
  readonly dataDir: string;
  readonly store: XuanxueAiProductionStore;
  readonly browserAuthority?: XuanxueAiBrowserAuthorityPort;
}
