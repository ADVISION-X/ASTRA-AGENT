# 玄学 AGENT Codex 接单与回执合同

## 合法请求

只接受严格 JSON。下面使用 YAML 仅为方便阅读，真实工单必须通过本 Skill 的验证脚本：

```yaml
protocol: xuanxue-agent-codex-handoff-v1
request_id: XAH-YYYYMMDDTHHMMSSZ-<8hex>
attempt: <positive integer>
requester_repo: /Users/nexgen/Documents/xuanxue-web
target_repo: /Users/nexgen/Documents/AGENT
user_request_verbatim: <原文>
user_authority_verbatim: <原文或明确无>
law_change_authority_verbatim: null
release_authority_verbatim: null
goal: <结果>
business_reason: <原因>
website_evidence: []
allowed_scope: []
forbidden_scope: []
acceptance: []
verification_requirements:
  ci_full: REQUIRED
  chrome: REQUIRED | NOT_APPLICABLE
  external_runtime: REQUIRED | NOT_APPLICABLE
law_change_authorized: false
release_authorized: false
secrets_included: false
expected_receipt: xuanxue-agent-codex-receipt-v1
```

`law_change_authorized` 或 `release_authorized` 只有在对应专项授权原文为无否定词的正向原话、且逐字包含在 `user_authority_verbatim` 中时才有效；未授权时专项原文必须为 `null`。网站提供的文件建议不构成 AGENT 文件范围授权，网站提供的实现建议不构成法案。

`allowed_scope`、`forbidden_scope`、`acceptance` 都必须是非空字符串数组。`website_evidence` 每项严格为 `{ref, fact}`。机器门会扫描秘密形态、跨仓写范围和绕过权威/CI/验收的指令，自报布尔值不能覆盖扫描结果。

以下任一项必须拒绝或请求用户裁决：字段缺失、路径不精确、协议未知、request id 冲突、携带秘密、要求修改网站、要求跳过权威/CI/真实验收、要求复制第二链、授权原文与布尔值矛盾。

## 状态结构

```yaml
protocol: xuanxue-agent-codex-status-v1
request_id: <same>
status: accepted | in_progress | needs_user | blocked
current_phase: authority | implementation | verification | release
summary: <当前事实>
question_for_user: <没有则为 null>
```

状态必须与原工单一起校验且 request id 相同。`needs_user` 必须有非空问题；`accepted/in_progress` 不得夹带问题。

## 最终回执

所有字段必须存在：

```yaml
protocol: xuanxue-agent-codex-receipt-v1
request_id: <same>
decision: completed | incomplete | blocked | rejected
starting_sha: <40hex>
final_sha: <40hex>
branch: <name>
worktree_identity:
  project_root: /Users/nexgen/Documents/AGENT
  worktree_path: <独立 AGENT worktree 绝对路径，不得等于项目根>
  git_common_dir: /Users/nexgen/Documents/AGENT/.git
  task_id: <稳定 AGENT 任务身份>
authority_read: []
changed_files: []
checked_not_changed: []
law_change_performed: false
second_chain_check: PASS | FAIL
generated_artifact_rule: PASS | FAIL
secret_boundary: PASS | FAIL
verification:
  targeted: []
  ci_full: PASS | FAIL | NOT_RUN
  chrome: PASS | FAIL | NOT_REQUIRED | NOT_RUN
  external_runtime: PASS | FAIL | NOT_REQUIRED | NOT_RUN
release:
  authorized: false
  committed: false
  pushed: false
  remote_sha: null
worktree_clean: false
website_change_request:
  - target_repo: /Users/nexgen/Documents/xuanxue-web
    target: <另开网站任务的公开目标>
    reason: <原因>
    public_contract_impact: <公开合同影响；无则明确写无>
    acceptance: [<网站侧可复核要求>]
remaining_items: []
final_statement: <不超过证据的结论>
```

## 完成判定

状态和回执必须与原工单一起验证。回执机器门强制同 request id、AGENT 仓路径边界、法案授权、发布授权和验收适用性一致。

本地施工的 `completed` 要求目标全部闭合、targeted 非空、最终候选 `ci_full=PASS`、工单标为 `REQUIRED` 的验收为 `PASS`、标为 `NOT_APPLICABLE` 的验收为 `NOT_REQUIRED`、三项边界 PASS 且无 remaining items。

如果用户授权并要求发布，`completed` 还要求 committed、pushed、remote SHA 与最终 SHA 一致、工作树干净。未授权发布时，committed/pushed 必须为 false、remote SHA 必须为 null，这不把本地验证冒充发布。
