import type { RlogCheck } from "./runtime-log-types.js";

export const pass = (checkId: string, question: string, detail: string): RlogCheck =>
  ({ checkId, question, status: "PASS", detail });

export const fail = (checkId: string, question: string, detail: string): RlogCheck =>
  ({ checkId, question, status: "FAIL", detail });
