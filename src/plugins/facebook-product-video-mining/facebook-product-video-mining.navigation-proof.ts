import type { FacebookNavigationSignature } from "./facebook-product-video-mining.navigation-scripts.js";

const videoUrlIdentity = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.pathname}|${url.searchParams.get("v") ?? ""}`;
  } catch {
    return value;
  }
};

const firstVideo = (signature: FacebookNavigationSignature) => signature.videoFacts[0] ?? null;

const videoShape = (
  video: ReturnType<typeof firstVideo>,
): string => `${video?.duration ?? ""}|${video?.width ?? ""}|${video?.height ?? ""}`;

const appendChangedSignal = (
  changedSignals: string[],
  condition: boolean,
  signal: string,
): void => {
  if (condition) changedSignals.push(signal);
};

export const collectChangedNavigationSignals = (
  before: FacebookNavigationSignature,
  after: FacebookNavigationSignature,
): string[] => {
  const beforeVideo = firstVideo(before);
  const afterVideo = firstVideo(after);
  const changedSignals: string[] = [];
  appendChangedSignal(changedSignals, videoUrlIdentity(before.url) !== videoUrlIdentity(after.url), "sourcePageUrl_or_reel_id");
  appendChangedSignal(changedSignals, (beforeVideo?.currentSrc ?? null) !== (afterVideo?.currentSrc ?? null), "video_current_src");
  appendChangedSignal(changedSignals, videoShape(beforeVideo) !== videoShape(afterVideo), "video_duration_or_size");
  appendChangedSignal(changedSignals, before.metricTexts.join("|") !== after.metricTexts.join("|"), "metric_group");
  appendChangedSignal(changedSignals, before.visibleTextHash !== after.visibleTextHash, "visible_text_hash");
  appendChangedSignal(changedSignals, before.videoCount !== after.videoCount, "video_count");
  return changedSignals;
};

export const hasNavigationProofQuorum = (changedSignals: readonly string[]): boolean =>
  changedSignals.length >= 2;
