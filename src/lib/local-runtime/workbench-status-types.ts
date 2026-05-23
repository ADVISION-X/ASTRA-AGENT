export type WorkbenchHealthComponent = {
  name: string;
  ok: boolean;
  detail: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
};

export type WorkbenchHealthReport = {
  status: "healthy" | "degraded" | "unhealthy";
  components: WorkbenchHealthComponent[];
  checkedAt: string;
  sourceFingerprint: string;
};

export type WorkbenchMissionReadinessReport = {
  status: "ready" | "not_ready";
  reason: string;
  components: WorkbenchHealthComponent[];
  checkedAt: string;
};

export type WorkbenchPreflightInput = {
  requestedPlatformId: string | null;
  targetProfileRef: string | null;
  targetUrl: string | null;
  targetTitle: string | null;
  userRequirementRef: string | null;
};

export type WorkbenchPreflightResult = {
  status: "ready" | "blocked" | "warning";
  actionableMessage: string;
  failureReason: string | null;
  recommendedAction: string;
  ownerResponsible: string;
  components: WorkbenchHealthComponent[];
};
