import { OpenRequestSchema } from "../schema.js";

const VALID_CHILD_IDS = new Set(["open-tiktok", "open-facebook", "open-local-workbench"]);
const VALID_PLATFORM_IDS = new Set(["tiktok-web", "facebook-web", "local-workbench"]);
const VALID_TARGET_KINDS = new Set(["platform-feed", "local-workbench"]);

export function parseOpenAbilityInput(input: unknown) {
  return OpenRequestSchema.safeParse(input);
}

export function coerceOpenInputSeed(input: unknown) {
  const raw = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const value = (key: string, fallback: string | null = null) => {
    const current = raw[key];
    return typeof current === "string" && current.trim().length > 0 ? current : fallback;
  };
  const childCapabilityId = value("childCapabilityId", "open-local-workbench") ?? "open-local-workbench";
  const platformId = value("platformId", "local-workbench") ?? "local-workbench";
  const targetKind = value("targetKind", "local-workbench") ?? "local-workbench";

  return {
    childCapabilityId: VALID_CHILD_IDS.has(childCapabilityId) ? childCapabilityId : "open-local-workbench",
    platformId: VALID_PLATFORM_IDS.has(platformId) ? platformId : "local-workbench",
    targetKind: VALID_TARGET_KINDS.has(targetKind) ? targetKind : "local-workbench",
    missionId: value("missionId", "invalid-mission") ?? "invalid-mission",
    runId: value("runId", "invalid-run") ?? "invalid-run",
    sessionId: value("sessionId", "invalid-session") ?? "invalid-session",
    roundId: value("roundId"),
    videoVisitId: value("videoVisitId"),
    targetUrl: value("targetUrl", "http://127.0.0.1/invalid") ?? "http://127.0.0.1/invalid",
    targetTitle: value("targetTitle"),
    sourceAbilityGroupId: value("sourceAbilityGroupId", "invalid-input") ?? "invalid-input",
    sourceChildCapabilityId: value("sourceChildCapabilityId"),
    sourceRef: value("sourceRef"),
  };
}