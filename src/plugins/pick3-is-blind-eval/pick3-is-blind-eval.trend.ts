import { PICK3_WINDOW_SIZE, type Pick3Draw, type Pick3Position } from "./pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";

export type Pick3TrendDraw = {
  expectedPrizeTime: string;
  expectedPrizeTimestamp: string;
  index: number;
  numbers: string;
  phase: string;
  positions: Record<Pick3Position, number>;
};

export type Pick3TrendSnapshot = {
  drawCount: number;
  draws: Pick3TrendDraw[];
  latestPhase: string | null;
  latestWindowStartIndex: number;
  source: "pick3_draws";
  windowSize: typeof PICK3_WINDOW_SIZE;
};

const toTrendDraw = (draw: Pick3Draw, index: number): Pick3TrendDraw => ({
  expectedPrizeTime: draw.expectedPrizeTime,
  expectedPrizeTimestamp: draw.expectedPrizeTimestamp,
  index,
  numbers: draw.resultText,
  phase: draw.phase,
  positions: {
    hundreds: draw.hundreds,
    tens: draw.tens,
    ones: draw.ones,
  },
});

export const listPick3TrendSnapshot = (dataDir: string): Pick3TrendSnapshot => {
  const storage = openPick3Storage(dataDir);
  try {
    const draws = storage.listDrawsAscending().map(toTrendDraw);
    return {
      drawCount: draws.length,
      draws,
      latestPhase: draws[draws.length - 1]?.phase ?? null,
      latestWindowStartIndex: Math.max(0, draws.length - PICK3_WINDOW_SIZE),
      source: "pick3_draws",
      windowSize: PICK3_WINDOW_SIZE,
    };
  } finally {
    storage.close();
  }
};
