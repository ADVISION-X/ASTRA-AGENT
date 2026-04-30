import type { InspectorResult } from "./schema.js";

export interface RunnerSummary {
  generatedAt: string;
  phase: string;
  totals: {
    inspectors: number;
    passed: number;
    failed: number;
    blocking: number;
  };
  results: InspectorResult[];
}