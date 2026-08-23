export type MediaProcessingRuntimeReadiness = {
  image: {
    available: boolean;
    engine: "sharp";
    reason: string | null;
  };
};

export const MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES = [
  "sharp",
  "@img/sharp-darwin-arm64",
] as const;

export interface MediaProcessingLockedDependencyReadiness {
  readonly status: "ready" | "failed";
  readonly packages: typeof MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES;
  readonly reason: string | null;
  readonly checkedAt: string;
}

export const prepareMediaProcessingRuntimeDependencies = async (): Promise<MediaProcessingRuntimeReadiness> => {
  const available = await import("sharp").then(() => true).catch(() => false);
  return { image: { available, engine: "sharp", reason: available ? null : "sharp_runtime_unavailable" } };
};

export const ensureMediaProcessingLockedDependenciesForUse = async (): Promise<MediaProcessingLockedDependencyReadiness> => {
  const readiness = await prepareMediaProcessingRuntimeDependencies();
  return {
    status: readiness.image.available ? "ready" : "failed",
    packages: MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES,
    reason: readiness.image.reason,
    checkedAt: new Date().toISOString(),
  };
};
