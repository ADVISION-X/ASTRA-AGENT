# GPT 稳定会话地址恢复完整实现方案

## 需求、终点与范围

需求 Owner 为 AGENT。目标是让一次 GPT submit 只有在取得可跨进程恢复的稳定 `/c/<opaque>` 地址后才写入唯一 Browser WAL；进程重启只能按该地址零提交读回，临时 `/c/WEB:<opaque>` 永远不得成为 canonical locator。成功终点是新 submit 的 WAL recovery payload 含稳定地址，重启恢复的 Provider submit 增量为零且能继续读取同一 turn。

只修改 AGENT 的 GPT submit、Browser canonical URL 校验、同一 postcondition 等待和既有验收。Website、数据库合同、Product Prompt、模型档位、法案正文、Browser 协议、第二恢复链均不在范围内。当前 candidate 为 `main@8358b046c0e26a72deafead008bba712ec9d46e7`；本地化模型档位的既有 dirty overlay 与本方案无关，必须保留。

## 输入证据与四维对齐

- 事故 WAL 的 confirmed recovery payload 保存了 `https://chatgpt.com/c/WEB:763bb062-cc31-4986-8839-6c63c5f23d36`；重启后恢复导航报 `BROWSER_ORIGIN_REJECTED`，随后结算报 `GPT_BROWSER_LIFECYCLE_FAILED`。
- 重启前同一 attempt 已完成模型、极高推理档位、附件、Prompt 与一次 submit，因此模型档位不是首错。
- `LAW-GPT-001-V48` 的 `FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 要求 WAL 保存能定位同一 confirmed effect 的 canonical URL；无需解冻法案。
- `GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` 与 `LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` 已规定 confirmed readback 只按 WAL canonical URL 零次或一次导航，不得搜索、猜测或重发；无需修改施工图。
- 当前实现第一次直接断裂在 submit postcondition：DOM 查询与 Prompt hash 一旦满足便接受当时的 `currentUrl`，而 GPT 与 Browser 两份 URL validator 仅检查 `/c/` 后非空，错误接受包含冒号的 `WEB:` 临时 segment；Browser recovery payload 又原样持久化该值。
- 唯一原生质量入口仍为 `npm run quality:check`；聚焦验收使用现有 `acceptance:gpt` 与 `acceptance:local-browser-terminal`，不建立第二 verdict。

## Identity spine 与有限闭环

```text
job/result_revision/provider_effect_identity
→ submit Browser WAL PREPARED/DISPATCHED
→ 页面出现精确新 user turn + Composer 为空
→ 同一现有 postcondition 继续等待 currentUrl 从临时 WEB segment 落定为稳定 segment
→ Browser WAL CONFIRMED 并保存稳定 URL + userTurnId
→ 进程重启按同一 WAL receipt 取得 system Target
→ URL 相同零导航，不同最多一次精确导航
→ 同一 userTurnId 回答读取
```

分支只有三条：稳定地址在既有期限内出现则 CONFIRMED；期限内仍为临时地址则保持现实 mutation 已发生的 rejected/typed failure，绝不重发；历史 WAL 已含临时地址时在导航前拒绝该 locator，诚实失败并释放正常可结算的 lease，Website 只能以新 result revision 决定后续执行。

## 唯一施工链

1. Browser 与 GPT 各自在现有 Owner 内把 canonical conversation segment 收窄为 `[A-Za-z0-9_-]+`，拒绝 `WEB:`，不新增共享全局合同。
2. submit 的现有 coherent postcondition 在 `preClickExactOutgoingTurn` 场景中，同时要求当前 URL 已通过 Browser canonical validator；临时 URL 只使同一次有界 postcondition 继续观察，不产生第二 Child、timer、WAL 或轮询器。
3. Browser WAL recovery payload 写入前再次使用 Browser canonical validator，防止任何调用方绕过 postcondition污染持久事实。
4. GPT fresh submit 与 confirmed readback 均使用收窄后的 GPT validator；历史坏 WAL 在任何导航前失败，避免再次把 system TAB 拉回首页并破坏 Document。
5. 在现有 Browser DOM mutation、Browser terminal 与 GPT proof 验收中加入临时 URL 负例、临时到稳定的单次等待正例、历史坏 recovery 零 Browser 动作负例。

## 删除审判

- 保留两份 Owner 内 validator：Browser 必须独立保护物理导航和 WAL，GPT 必须独立保护 Child 输入/输出；删除任一份都会让其 Owner 接受未经本域验证的 locator。
- 保留现有有界 postcondition：它已有真实消费者、期限和一次点击语义；删除会重新产生“submit 已发生但稳定 locator 尚未取得”的缺口。
- 不新增稳定器 Child、恢复状态机、后台修复器、侧栏搜索、历史记录扫描、fallback、数据库字段或兼容桥。这些结构都无法证明比复用现有 postcondition 更短。
- 不修改模型档位；运行证据已证明它成功，不属于故障链。

## 验收、停止与回退

- `/c/WEB:<opaque>` 在 Browser 与 GPT canonical validator 中均失败；普通稳定 `/c/<opaque>` 继续通过。
- submit 第一次观察到临时 URL 时不确认、不重复点击；同一 command 后续观察到稳定 URL时只产生一次 physical submit 并保存稳定 recovery payload。
- recovery payload 无法持久化临时 URL；历史坏 payload 在 `Page.navigate` 前失败。
- confirmed recovery 的 physical submit delta 为零；稳定 URL 精确恢复后读取同一 `userTurnId`。
- `acceptance:gpt`、`acceptance:local-browser-terminal` 和唯一 `quality:check CHANGE` 必须通过；这些只构成代码候选证据，不冒充真实 Chrome、READY、RELEASE 或 Website 入库。
- 若现役 fixture 证明合法 Provider segment 必须包含冒号，停止施工并回到法案/合同裁决，不放宽为 fallback。
- 回退仅撤销本方案直接修改；不得触碰既有本地化模型 dirty overlay。历史错误 WAL 不覆盖、不改写；由 Website 新 result revision 或管理员清除未完成任务决定后续。
