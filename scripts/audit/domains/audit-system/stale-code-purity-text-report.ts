import { execFileSync } from "node:child_process";

type Finding = { code: string; detail: string; path: string };

export const inspectStaleCodePurityReport = (root: string): Finding[] => {
  const tracked = execFileSync("git", ["ls-files", "-z", "scripts/audit/reports", "scripts/audit/generated"], { cwd: root }).toString().split("\0").filter(Boolean);
  const forbidden = tracked.filter((path) => path !== "scripts/audit/generated/law-registry.generated.json");
  return forbidden.map((path) => ({ code: "AUDIT_STALE_REPORT_TRACKED", detail: path, path }));
};
