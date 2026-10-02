import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROOT, fail, norm, validGitObjectId } from "./governance-runtime.js";

const byteCompare = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));

export const gitCommit = (): string => {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (!validGitObjectId(commit)) fail("SOURCE_PARSE_FAILED", "git commit");
  return commit;
};

const trackedChanges = (base: string): Array<{ status: string; path: string }> => {
  const raw = execFileSync("git", ["diff", "--name-status", "-z", base, "--"], { cwd: ROOT })
    .toString().split("\0").filter(Boolean);
  const changes: Array<{ status: string; path: string }> = [];
  for (let index = 0; index < raw.length;) {
    const status = raw[index++]!;
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = norm(raw[index++]!);
      const newPath = norm(raw[index++]!);
      if (status.startsWith("R")) changes.push({ status: "D", path: oldPath });
      changes.push({ status: "A", path: newPath });
    } else changes.push({ status: status[0]!, path: norm(raw[index++]!) });
  }
  return changes;
};

export const diffPaths = (base = "HEAD"): Array<{ status: string; path: string }> => {
  const changes = trackedChanges(base);
  const tracked = new Set(changes.map((change) => change.path));
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: ROOT })
    .toString().split("\0").filter(Boolean).map(norm);
  for (const path of untracked) if (!tracked.has(path)) changes.push({ status: "A", path });
  return changes.sort((left, right) => byteCompare(left.path, right.path) || byteCompare(left.status, right.status));
};

export const gitWorktreeStatus = (): string => execFileSync("git",
  ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: ROOT }).toString();

export const worktreeCandidateFingerprint = (): string => JSON.stringify([
  gitCommit(), gitWorktreeStatus(),
  execFileSync("git", ["diff", "--cached", "--binary", "HEAD", "--"], { cwd: ROOT }).toString("base64"),
  diffPaths().map((change) => [change.status, change.path,
    change.status === "D" ? null : readFileSync(resolve(ROOT, change.path)).toString("base64")]),
]);
