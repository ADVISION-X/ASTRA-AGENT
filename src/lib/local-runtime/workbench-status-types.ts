export type WorkbenchHealthComponent = {
  name: string;
  ok: boolean;
  detail: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
};

export type WorkbenchHealthReport = {
  status: "healthy" | "degraded";
  components: WorkbenchHealthComponent[];
  checkedAt: string;
  sourceFingerprint: string;
};

export type WorkbenchInitializationState = {
  status: "initializing" | "ready" | "failed";
  failureReason: string | null;
};
