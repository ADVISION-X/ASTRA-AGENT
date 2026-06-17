import { createHash } from "node:crypto";

import {
  PICK3_LOTTERY_TYPE,
  PICK3_OFFICIAL_SOURCE,
  type Pick3Draw,
} from "./pick3-is-blind-eval.schema.js";

const OFFICIAL_ORIGIN = "https://www.theuaelottery.ae";

type OfficialPhaseRow = {
  lotteryType: number;
  phase: string;
  result?: Array<{ key: string; data: [string, string, string] | string[] }>;
  resultDetail?: unknown;
  totalWinningBetCount?: number;
  expectedPrizeTime?: string;
  expectedPrizeTimestamp?: string;
};

type OfficialHistoryResponse = {
  code: number;
  data?: {
    phaseList?: OfficialPhaseRow[];
  };
};

type OfficialBoundsResponse = {
  code: number;
  data?: {
    defaultShowDrawnResultList?: number[];
    lotteryTypePrizeTimeDto?: {
      lotteryType: number;
      startTime: string;
      endTime: string;
    };
  };
};

export const encodePick3OfficialMessage = (payload: unknown): string =>
  encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString("base64"));

const hashJson = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const officialUrl = (command: 660104 | 660301, payload: unknown): string =>
  `${OFFICIAL_ORIGIN}/qapi/command/execute?command=${command}&lang=en-US&message=${encodePick3OfficialMessage(payload)}`;

const fetchOfficialJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`official_http_${response.status}`);
  }
  return await response.json() as T;
};

const extractPick3Nums = (row: OfficialPhaseRow): [number, number, number] => {
  const data = row.result?.find((item) => item.key === "pick3")?.data;
  if (!data || data.length !== 3) {
    throw new Error(`pick3_result_missing_${row.phase}`);
  }
  const nums = data.map((value) => Number(value));
  if (nums.some((value) => !Number.isInteger(value) || value < 0 || value > 9)) {
    throw new Error(`pick3_result_invalid_${row.phase}`);
  }
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
};

export const normalizeOfficialPick3Row = (row: OfficialPhaseRow): Pick3Draw => {
  const [hundreds, tens, ones] = extractPick3Nums(row);
  const rawJson = JSON.stringify(row);
  return {
    source: PICK3_OFFICIAL_SOURCE,
    lotteryType: PICK3_LOTTERY_TYPE,
    phase: row.phase,
    expectedPrizeTime: row.expectedPrizeTime ?? "",
    expectedPrizeTimestamp: row.expectedPrizeTimestamp ?? row.expectedPrizeTime ?? "",
    resultText: `${hundreds} ${tens} ${ones}`,
    hundreds,
    tens,
    ones,
    totalWinningBetCount: typeof row.totalWinningBetCount === "number" ? row.totalWinningBetCount : null,
    resultDetailJson: JSON.stringify(row.resultDetail ?? []),
    rawJson,
    rawHash: createHash("sha256").update(rawJson).digest("hex"),
  };
};

export const parsePick3Bounds = (response: OfficialBoundsResponse): {
  startTime: string;
  endTime: string;
  defaultShowDrawnResultList: number[];
} => {
  if (response.code !== 0 || response.data?.lotteryTypePrizeTimeDto?.lotteryType !== PICK3_LOTTERY_TYPE) {
    throw new Error("official_bounds_invalid");
  }
  return {
    startTime: response.data.lotteryTypePrizeTimeDto.startTime,
    endTime: response.data.lotteryTypePrizeTimeDto.endTime,
    defaultShowDrawnResultList: response.data.defaultShowDrawnResultList ?? [],
  };
};

export const parsePick3History = (response: OfficialHistoryResponse): Pick3Draw[] => {
  if (response.code !== 0) {
    throw new Error("official_history_invalid");
  }
  return (response.data?.phaseList ?? []).map(normalizeOfficialPick3Row);
};

export const buildPick3LatestHistoryPayload = () => ({
  data: {
    lotteryType: PICK3_LOTTERY_TYPE,
    includeSelf: 1,
    isDesc: 1,
    prePhases: 10,
    alreadyDrawn: 1,
  },
});

export const buildPick3CursorHistoryPayload = (phase: string) => ({
  data: {
    lotteryType: PICK3_LOTTERY_TYPE,
    includeSelf: 0,
    isDesc: 1,
    phase,
    prePhases: 10,
    alreadyDrawn: 0,
  },
});

export const fetchPick3PrizeBounds = async () => {
  const payload = { data: { lotteryType: PICK3_LOTTERY_TYPE } };
  const response = await fetchOfficialJson<OfficialBoundsResponse>(officialUrl(660104, payload));
  return {
    ...parsePick3Bounds(response),
    officialApiResponseHash: hashJson(response),
  };
};

export const fetchPick3HistoryPage = async (payload: unknown) => {
  const response = await fetchOfficialJson<OfficialHistoryResponse>(officialUrl(660301, payload));
  return {
    draws: parsePick3History(response),
    officialApiResponseHash: hashJson(response),
  };
};
