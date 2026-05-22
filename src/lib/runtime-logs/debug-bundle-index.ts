import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { RuntimeDebugBundleIndex } from "./debug-bundle.js";

export const loadRuntimeDebugBundleIndex = (bundleDir: string): RuntimeDebugBundleIndex =>
  JSON.parse(readFileSync(join(bundleDir, "index.json"), "utf8")) as RuntimeDebugBundleIndex;

export const findRuntimeDebugBundleRound = (
  bundleDir: string,
  roundId: string,
): RuntimeDebugBundleIndex["rounds"][number] | null =>
  loadRuntimeDebugBundleIndex(bundleDir).rounds.find((round) => round.roundId === roundId) ?? null;