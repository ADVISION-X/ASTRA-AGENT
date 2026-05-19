export type RlogStatus = "PASS" | "FAIL";

export type RlogCheck = {
  checkId: string;
  question: string;
  status: RlogStatus;
  detail: string;
};

export type RuntimeLoggingInspectorResult = {
  checks: RlogCheck[];
  hardFails: number;
  pass: boolean;
};
