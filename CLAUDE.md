# 本仓库治理约束

本仓库有一份冻结的法案系统，入口文件是根目录的 [AGENTS.md](AGENTS.md)（历史上只给 Codex 读，标题写的是 "Codex Governance Entry"，但内容对任何在本仓库施工的 Agent 都同样适用）。

**每个会话开始涉及本仓库的读写任务前，先读一遍 `AGENTS.md`，把它当成本仓库的 canonical 权威，不在本文件复制其条文**（避免出现两份法案正文、彼此漂移）。`AGENTS.md` 内容变化时，以 `AGENTS.md` 为准，不用回来同步这份文件。

涉及生产链架构设计、Owner/边界审查、跨仓改造方案设计，或连续执行 CHANGE→READY→RELEASE 时，额外读取并遵守 `.claude/skills/` 与 `~/.claude/skills/` 下的相关 Skill（`agent-flow-boundary-gatekeeper`、`closed-loop-implementation-design`、`ci-full-governance`）——即使 Skill 工具因为会话快照问题暂时无法正式调用它们，也要把其中的规则当作本会话的硬约束手动执行，不要因为"技术上调不出来"就跳过治理要求。

纯只读查看、纯状态查询、不涉及生产链代码修改的任务不必触发上述流程。
