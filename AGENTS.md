# Codex Entry Law

任何 Codex 任务在修改代码、审计脚本、生成器、页面、配置、CI 或文档化执行规则前，必须先完成入口遍历。

## Mandatory Entry Scan

执行前必须完成并输出：

```text
[PRE-TASK-LAW-SCAN]
```

扫描必须覆盖：

1. 法案系统
   - `.github/instructions/agent-rules/grasseye-index.instructions.md`
   - `.github/instructions/agent-rules/GRASSEYE-KERNEL.instructions.md`
   - 与任务命中域相关的 `.github/instructions/agent-rules/modules/*.instructions.md`
   - `scripts/audit/generated/law-registry.generated.json`

2. 质检系统
   - `scripts/audit/ci-full.ts`
   - `scripts/audit/build-audit-artifacts.ts`
   - `scripts/audit/core/run-generated-plan.ts`
   - 任务命中域对应的 `scripts/audit/domains/<domain>/manifest.json`
   - 任务命中域对应的 `scripts/audit/domains/<domain>/inspector.ts`
   - 相关 `docs/audit/*.md`

3. 施工图
   - 与任务命中域相关的 `docs/法案辅助文件/*.md`
   - 施工图只能作为实现地图，不能高于 active law。

## Authorization Gate

入口遍历后必须输出：

```text
[TASK-AUTHORIZATION]
```

内容必须说明：

- 允许修改范围
- 禁止修改范围
- owner 边界
- generated artifact 规则
- 是否存在 `LAW-GAP`

没有 `[TASK-AUTHORIZATION]` 之前，禁止改文件。

## Hard Command Gate

完整质检入口只能使用：

```bash
npm run ci:full
```

`ci:full` 必须先运行 `npm run codex:entry-gate`。入口闸门失败时，不得报告任务完成。

## Absolute Bans

- 禁止绕过法案直接按记忆施工。
- 禁止手工编辑 generated artifacts 作为源真相。
- 禁止新增 bridge、fallback、shadow、第二实现或平行质检链。
- 禁止把施工图当作高于 active law 的授权来源。
- 禁止把 warning、partial pass、soft pass 当成完成。
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
