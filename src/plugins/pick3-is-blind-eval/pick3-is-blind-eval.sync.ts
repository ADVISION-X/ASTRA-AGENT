import { randomUUID } from "node:crypto";

import {
  buildPick3CursorHistoryPayload,
  buildPick3LatestHistoryPayload,
  fetchPick3HistoryPage,
  fetchPick3PrizeBounds,
} from "./pick3-is-blind-eval.official-api.js";
import type { Pick3Draw } from "./pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";

const dateKey = (draw: Pick3Draw): string => draw.expectedPrizeTime.slice(0, 10);

const dateDay = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`pick3_invalid_official_date_${date}`);
  }
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const verifyPick3FullHistoryCoverage = (input: {
  bounds: { startTime: string; endTime: string };
  drawsAscending: readonly Pick3Draw[];
}): void => {
  const first = input.drawsAscending[0];
  const last = input.drawsAscending[input.drawsAscending.length - 1];
  if (!first || !last) {
    throw new Error("pick3_full_history_empty");
  }
  if (dateKey(first) > input.bounds.startTime) {
    throw new Error(`pick3_full_history_missing_earliest_${input.bounds.startTime}_got_${dateKey(first)}`);
  }
  if (dateKey(last) < input.bounds.endTime) {
    throw new Error(`pick3_full_history_missing_latest_${input.bounds.endTime}_got_${dateKey(last)}`);
  }
  const coveredDates = new Set(input.drawsAscending.map(dateKey));
  for (let day = dateDay(input.bounds.startTime); day <= dateDay(input.bounds.endTime); day += 1) {
    const expectedDate = new Date(day * 86_400_000).toISOString().slice(0, 10);
    if (!coveredDates.has(expectedDate)) {
      throw new Error(`pick3_full_history_date_gap_${expectedDate}`);
    }
  }
};

export const syncOfficialDraws = async (dataDir: string) => {
  const storage = openPick3Storage(dataDir);
  try {
    const runId = `pick3_sync_${randomUUID()}`;
    const bounds = await fetchPick3PrizeBounds();
    let rowsSeen = 0;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    let latestHash: string | null = null;
    let payload: unknown = buildPick3LatestHistoryPayload();
    const seenPhases = new Set<string>();

    for (let page = 0; page < 200; page += 1) {
      const { draws, officialApiResponseHash } = await fetchPick3HistoryPage(payload);
      latestHash = officialApiResponseHash;
      const freshDraws = draws.filter((draw) => !seenPhases.has(draw.phase));
      for (const draw of freshDraws) seenPhases.add(draw.phase);
      rowsSeen += freshDraws.length;
      const upsert = storage.upsertDraws(freshDraws);
      rowsInserted += upsert.inserted;
      rowsUpdated += upsert.updated;
      const oldest = freshDraws[freshDraws.length - 1];
      if (!oldest || freshDraws.length === 0) break;
      payload = buildPick3CursorHistoryPayload(oldest.phase);
      if (dateKey(oldest) <= bounds.startTime) break;
    }

    const allDraws = storage.listDrawsAscending();
    verifyPick3FullHistoryCoverage({ bounds, drawsAscending: allDraws });
    return {
      storage,
      summary: {
        runId,
        status: "success" as const,
        officialStartTime: bounds.startTime,
        officialEndTime: bounds.endTime,
        rowsSeen,
        rowsInserted,
        rowsUpdated,
        newestPhase: allDraws[allDraws.length - 1]?.phase ?? null,
        oldestPhase: allDraws[0]?.phase ?? null,
        reason: null,
        officialApiResponseHash: latestHash,
      },
    };
  } catch (error) {
    storage.close();
    throw error;
  }
};
