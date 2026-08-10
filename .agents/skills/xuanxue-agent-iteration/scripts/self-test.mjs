import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const validator = join(dirname(fileURLToPath(import.meta.url)), "validate-handoff.mjs");
const fixtureDir = mkdtempSync(join(tmpdir(), "xuanxue-handoff-test-"));
const requestPath = join(fixtureDir, "request.json");
const clone = (value) => structuredClone(value);

const request = {
  protocol: "xuanxue-agent-codex-handoff-v1",
  request_id: "XAH-20260810T120000Z-abcdef12",
  attempt: 1,
  requester_repo: "/Users/nexgen/Documents/xuanxue-web",
  target_repo: "/Users/nexgen/Documents/AGENT",
  user_request_verbatim: "请只在独立 AGENT 仓库迭代接单 Skill。",
  user_authority_verbatim: "授权迭代两仓 Skill，不授权法案或发布。",
  law_change_authority_verbatim: null,
  release_authority_verbatim: null,
  goal: "在 AGENT 仓库完成合法的本地 Skill 迭代。",
  business_reason: "隔离网站与 AGENT 的修改责任。",
  website_evidence: [{ ref: "contract:v1", fact: "网站只提交要求。" }],
  allowed_scope: ["在 AGENT 仓库实现本工单目标。"],
  forbidden_scope: ["禁止修改网站仓库，禁止泄露秘密。"],
  acceptance: ["最终候选通过完整 CI 与合同验证。"],
  verification_requirements: {
    ci_full: "REQUIRED",
    chrome: "NOT_APPLICABLE",
    external_runtime: "NOT_APPLICABLE",
  },
  law_change_authorized: false,
  release_authorized: false,
  secrets_included: false,
  expected_receipt: "xuanxue-agent-codex-receipt-v1",
};

const status = {
  protocol: "xuanxue-agent-codex-status-v1",
  request_id: request.request_id,
  status: "accepted",
  current_phase: "authority",
  summary: "工单已通过硬门，开始读取 AGENT 权威。",
  question_for_user: null,
};

const receipt = {
  protocol: "xuanxue-agent-codex-receipt-v1",
  request_id: request.request_id,
  decision: "completed",
  starting_sha: "1".repeat(40),
  final_sha: "2".repeat(40),
  branch: "codex/xuanxue-agent-iteration",
  worktree_identity: {
    project_root: "/Users/nexgen/Documents/AGENT",
    worktree_path: "/Users/nexgen/.codex/worktrees/agent-abcdef12",
    git_common_dir: "/Users/nexgen/Documents/AGENT/.git",
    task_id: "task-abcdef12",
  },
  authority_read: ["AGENTS.md", "AGENT.MD"],
  changed_files: [".agents/skills/xuanxue-agent-iteration/SKILL.md"],
  checked_not_changed: ["src/plugins/xuanxue-ai-production"],
  law_change_performed: false,
  second_chain_check: "PASS",
  generated_artifact_rule: "PASS",
  secret_boundary: "PASS",
  verification: {
    targeted: ["node scripts/self-test.mjs: PASS"],
    ci_full: "PASS",
    chrome: "NOT_REQUIRED",
    external_runtime: "NOT_REQUIRED",
  },
  release: {
    authorized: false,
    committed: false,
    pushed: false,
    remote_sha: null,
  },
  worktree_clean: false,
  website_change_request: [],
  remaining_items: [],
  final_statement: "本地候选闭合，未发布。",
};

const run = (kind, payload, context = false) => spawnSync(
  process.execPath,
  [validator, kind, ...(context ? [requestPath] : [])],
  { input: JSON.stringify(payload), encoding: "utf8" },
);

const expectPass = (label, kind, payload, context = false) => {
  const result = run(kind, payload, context);
  if (result.status !== 0 || !result.stdout.includes('"status":"PASS"')) {
    throw new Error(`${label} expected PASS: ${result.stderr || result.stdout}`);
  }
};

const expectFail = (label, kind, payload, context = false) => {
  const result = run(kind, payload, context);
  if (result.status === 0 || !result.stderr.includes("HANDOFF_CONTRACT_FAIL")) {
    throw new Error(`${label} expected FAIL: ${result.stderr || result.stdout}`);
  }
};

try {
  writeFileSync(requestPath, JSON.stringify(request), { mode: 0o600 });
  expectPass("valid request", "request", request);
  expectPass("valid status", "status", status, true);
  expectPass("valid receipt", "receipt", receipt, true);

  const needsUser = { ...status, status: "needs_user", question_for_user: "是否授权修改法案？" };
  expectPass("valid needs_user", "status", needsUser, true);
  const websiteRequest = clone(receipt);
  websiteRequest.website_change_request = [{
    target_repo: request.requester_repo,
    target: "公开合同适配",
    reason: "AGENT 输出合同已有合法变化。",
    public_contract_impact: "新增一个公开枚举值。",
    acceptance: ["网站侧另开任务并通过完整 CI。"],
  }];
  expectPass("valid website change request", "receipt", websiteRequest, true);

  const authorizedReleaseRequest = clone(request);
  authorizedReleaseRequest.user_authority_verbatim = "我授权提交并推送这次 Skill 变更。";
  authorizedReleaseRequest.release_authorized = true;
  authorizedReleaseRequest.release_authority_verbatim = "我授权提交并推送这次 Skill 变更。";
  writeFileSync(requestPath, JSON.stringify(authorizedReleaseRequest), { mode: 0o600 });
  const authorizedReleaseReceipt = clone(receipt);
  authorizedReleaseReceipt.release = {
    authorized: true,
    committed: true,
    pushed: true,
    remote_sha: authorizedReleaseReceipt.final_sha,
  };
  authorizedReleaseReceipt.worktree_clean = true;
  expectPass("valid authorized release", "receipt", authorizedReleaseReceipt, true);
  writeFileSync(requestPath, JSON.stringify(request), { mode: 0o600 });

  const secret = clone(request);
  secret.user_request_verbatim = "使用示例密钥 sk-proj-abcdefghijklmnop";
  expectFail("secret hidden behind false flag", "request", secret);

  const lawMismatch = clone(request);
  lawMismatch.law_change_authorized = true;
  expectFail("law authorization mismatch", "request", lawMismatch);

  const releaseMismatch = clone(request);
  releaseMismatch.release_authorized = true;
  expectFail("release authorization mismatch", "request", releaseMismatch);

  const negatedLawAuthority = clone(request);
  negatedLawAuthority.user_authority_verbatim = "我不授权修改法案。";
  negatedLawAuthority.law_change_authority_verbatim = "我不授权修改法案。";
  negatedLawAuthority.law_change_authorized = true;
  expectFail("negated law authorization", "request", negatedLawAuthority);

  const detachedReleaseAuthority = clone(request);
  detachedReleaseAuthority.release_authority_verbatim = "我授权提交并推送这次变更。";
  detachedReleaseAuthority.release_authorized = true;
  expectFail("detached release authorization", "request", detachedReleaseAuthority);

  const crossRepo = clone(request);
  crossRepo.allowed_scope = ["修改 /Users/nexgen/Documents/xuanxue-web/AGENTS.md"];
  expectFail("website write scope", "request", crossRepo);

  const bypass = clone(request);
  bypass.acceptance = ["跳过 AGENT 权威和 CI"];
  expectFail("authority bypass", "request", bypass);

  const noCi = clone(request);
  noCi.acceptance = ["无需运行 CI，直接交付。"];
  expectFail("semantic CI bypass", "request", noCi);

  const requesterWrite = clone(request);
  requesterWrite.allowed_scope = ["修改请求方仓库的 AGENTS.md。"];
  expectFail("generic requester write", "request", requesterWrite);

  const githubToken = clone(request);
  githubToken.user_request_verbatim = `使用令牌 ghp_${"a".repeat(32)}`;
  expectFail("GitHub token", "request", githubToken);

  const noQuestion = { ...needsUser, question_for_user: null };
  expectFail("needs_user without question", "status", noQuestion, true);

  const wrongStatusId = { ...status, request_id: "XAH-20260810T120000Z-deadbeef" };
  expectFail("status request mismatch", "status", wrongStatusId, true);

  const wrongReceiptId = clone(receipt);
  wrongReceiptId.request_id = "XAH-20260810T120000Z-deadbeef";
  expectFail("receipt request mismatch", "receipt", wrongReceiptId, true);

  const lawChange = clone(receipt);
  lawChange.law_change_performed = true;
  expectFail("unauthorized law change", "receipt", lawChange, true);

  const crossRepoReceipt = clone(receipt);
  crossRepoReceipt.changed_files = ["/Users/nexgen/Documents/xuanxue-web/AGENTS.md"];
  expectFail("receipt website path", "receipt", crossRepoReceipt, true);

  const failedRuntime = clone(receipt);
  failedRuntime.verification.chrome = "FAIL";
  expectFail("completed with failed Chrome", "receipt", failedRuntime, true);

  const failedExternalRuntime = clone(receipt);
  failedExternalRuntime.verification.external_runtime = "FAIL";
  expectFail("completed with failed external runtime", "receipt", failedExternalRuntime, true);

  const unauthorizedPush = clone(receipt);
  unauthorizedPush.release.committed = true;
  unauthorizedPush.release.pushed = true;
  unauthorizedPush.release.remote_sha = unauthorizedPush.final_sha;
  expectFail("unauthorized release", "receipt", unauthorizedPush, true);

  const malformedWebsiteRequest = clone(receipt);
  malformedWebsiteRequest.website_change_request = ["请直接改网站"];
  expectFail("malformed website change request", "receipt", malformedWebsiteRequest, true);

  const fakeWorktree = clone(receipt);
  fakeWorktree.worktree_identity = {
    project_root: request.target_repo,
    worktree_path: request.requester_repo,
    git_common_dir: `${request.requester_repo}/.git`,
    task_id: "task-fake",
  };
  expectFail("fake worktree identity", "receipt", fakeWorktree, true);

  const wrongTarget = clone(request);
  wrongTarget.target_repo = "/Users/nexgen/Documents/xuanxue-web";
  expectFail("wrong target", "request", wrongTarget);

  expectFail("status without request context", "status", status);
  process.stdout.write("HANDOFF_CONTRACT_SELF_TEST_PASS: 6 positive, 19 negative cases\n");
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}
