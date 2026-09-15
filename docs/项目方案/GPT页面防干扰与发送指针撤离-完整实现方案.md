# GPT 发送指针撤离完整实现方案

> 状态：DESIGN_COMPLETE（仅完成方案，尚未施工、未 READY）  
> Owner：AGENT `local-browser-session`  
> 唯一变更目标：真正 GPT 发送点击释放后，把合成指针一次移离“发送/停止回答”按钮  
> 本轮明确放弃：人工误点隔离、同 attempt 自修复、模型/推理强度发送前复核

## 一、方案纠偏

用户补充了两个决定性事实：

1. 系统不能为了防故障不断拉扯 GPT 页面；
2. “人工误点破坏模型、附件或 Prompt”当前没有发生过。

因此，上一版设计中的 system Tab 人工输入隔离没有达到当前必要性门槛，物理退出本轮方案。不得加入 `Input.setIgnoreInputEvents`，不得增加长生命周期页面锁、重复重申、模型/推理最终复核或任何防打扰状态。

当前系统对人工干扰继续维持现状：

- Prompt hash 与附件集合在发送点击前同包复核；不一致就不发送；
- 模型与推理强度只在各自现役 Child 内验收；本轮不增加发送前复核；
- Target、Document、Tab 或进程异常继续按现役 typed failure 和 Website recovery 裁决；
- 只有出现真实事故证据后，才另立独立方案；不得借本轮预防一个尚未发生的问题。

## 二、现役事故与根因

现役发送动作是：

```text
mouseMoved 到发送按钮
→ mousePressed
→ mouseReleased
→ 等待 2500ms fresh postcondition
```

最后一个合成指针事件仍停在发送按钮坐标。页面开始生成后，同一位置的按钮变成“停止回答”，所以页面持续显示“停止回答”悬浮提示。

当前证据只支持“悬浮提示”，不支持“系统重复点击停止回答”。本轮不得把它升级成重复点击事故，也不得因此增加轮询、重试或页面锁。

## 三、唯一最终方案

只对带有现成 `preClickExactOutgoingTurn` 的真正 GPT submit 点击，在最后一次 `mouseReleased` 后、任何 postcondition 读取前，追加一次无点击指针归位：

```text
Input.dispatchMouseEvent({
  type: "mouseMoved",
  x: 0,
  y: 0,
  button: "none",
  buttons: 0
})
```

`(0,0)` 是 Browser-owned 固定中性停放点；Product、GPT、Website 均不能传入坐标。若真实 Chrome 证明该点仍命中交互控件，只能由 Browser Owner 把它原位替换为另一个经实证的固定中性点，不能开放坐标接口或候选策略。

完整顺序固定为：

```text
同包重验 Prompt hash、附件集合、唯一发送按钮机械资格
→ WAL 标记 DISPATCHED
→ mouseMoved 到发送按钮
→ mousePressed 一次
→ mouseReleased 一次
→ 立即 mouseMoved 到固定中性点
→ 等待现役 2500ms 页面读回闸门
→ fresh 验证新增 user turn 与空 Composer
→ WAL 结算 CONFIRMED
→ 40 秒静默门
→ 进入现役全局 70–90 秒 Provider observation 轮询
```

这不是一次新的页面逻辑访问：

- DOM 读取增量：0
- Tab activation 增量：0
- navigation 增量：0
- timer / polling 增量：0
- Browser FIFO acquisition 增量：0
- WAL row 增量：0
- Provider submit 增量：0
- `physical_input_count` 仍为 1；只有一次按下/释放，归位没有点击

因此它不会持续拉扯 GPT 页面，只在已经发生的发送动作尾部执行一次。

## 四、异常与恢复边界

| 现场 | 唯一处理 |
| --- | --- |
| 点击前资格失败 | `REJECTED + mutation_outcome=no + physical_input_count=0` |
| `mousePressed/mouseReleased` 前失败且能证明零输入 | 保留现役零输入结算，由 Website 决定是否签新 attempt |
| 点击后指针归位失败 | Provider 输入可能已发生，WAL 保持 `DISPATCHED`；只允许同 effect 零 submit 读回，绝不再次发送 |
| 指针归位成功、postcondition 成立 | `CONFIRMED + physical_input_count=1` |
| 已确认 effect 的跨进程恢复 | 只读现有结果；不补做指针归位，不产生任何页面输入 |
| 人工改动 Prompt/附件 | 继续由现役 submit 同包复核失败关闭；本轮不自动修复 |
| 人工改动模型/推理强度 | 本轮不新增防护；保留为未发生、待实证风险 |
| 人工点击“停止回答” | 本轮不建立页面锁；若未来真实发生，按 job/attempt/effect/DOM 日志另案取证 |

“不能留下半截任务”的闭环不变：

```text
Website demand/grant
→ AGENT durable accept
→ Browser 唯一 lane/WAL 至多一次 submit
→ AGENT 得到结果或 typed failure
→ 唯一 Outbox 交付
→ Website Domain Consumer 幂等入库
→ admission receipt 与领域对象精确读回
```

GPT 页面出现回答、Browser terminal、AGENT 本地成功或 HTTP 200 均不是业务完成。

## 五、法案与施工图裁决

### 5.1 法案不解冻

本轮不改变：

- Browser Owner；
- submit 的两项冻结前置确认；
- Provider effect identity；
- WAL 状态机；
- 一次发送语义；
- Website recovery 主权；
- 1.5 秒普通页面访问门、2500ms 动作读回、40 秒静默门、70–90 秒全局 observation 节拍。

指针归位只是现役 exact submit Browser 命令在 `mouseReleased` 后的无点击机械收尾，不是新业务动作或新恢复路径。因此 `LAW-GPT-002-V17`、`LAW-LOCAL-BROWSER-SESSION-004-V43` 均不解冻、不升版。

### 5.2 只更新 Local Browser 施工图

取得施工授权后，将 `Local Browser Authority V45` 原位升为 V46，只固化：

- exact submit 的事件顺序；
- fixed neutral pointer point；
- 归位不计入 `physical_input_count`；
- 归位失败后不得把可能已发生的 submit 改写为 `mutation_outcome=no`；
- 普通 click、doubleClick、附件、模型、推理、限流确认和恢复读回均不归位。

GPT 施工图、Website 法案/施工图、V6 合同、数据库 schema 和 migration 均不修改。法案 registry 不需要重建，因为 active law corpus 不变；若本仓原生治理要求 Blueprint 版本变化触发 projection 重建，只能使用原生 builder，不得手改生成物。

## 六、代码施工面

唯一生产文件：

`src/lib/browser/chrome-extension/dom-pointer-intent-runtime.ts`

原位修改 `executeClickIntent`：

1. 复用现有 `preClickExactOutgoingTurn` 作为唯一 scope 标志；
2. `dispatchPointerClickSequence` 完成后立即发送一次固定 neutral `mouseMoved`；
3. 然后进入现役 `clickMutationReceipt`；
4. 不修改 `dispatchPointerClickSequence` 的公共语义，避免附件、doubleClick 等调用者连带改变；
5. 删除同文件中已被前序 return 证明恒真的冗余 `preClickExactOutgoingTurn === undefined` 包装，用删除抵消新增逻辑。

明确禁止修改：

- `submit_exact_gpt_turn_once/handler.ts` 及其 input；
- `browser-dom-intent.ts` 公共合同；
- Product Flow、Child 顺序、模型、推理、附件或 Prompt；
- Browser WAL、effect identity、数据库、Website、N、限流冷却与观察间隔；
- debugger attach、Target acquire/park/release 生命周期。

硬门：

- 新增生产文件：0
- 新增 Owner、Child、接口、队列、WAL、表、字段、timer、service：0
- 新增 Browser 逻辑页面周期：0
- 生产代码净行数：目标 `≤ 0`

若无法在该边界内完成，必须停止并证明不可替代的新增量；不得顺手重构相邻模块。

## 七、质检

只原位扩充现有 Browser/GPT acceptance，不创建第二测试体系：

1. exact submit 事件必须严格等于：`move-to-send, press(1), release(1), move-to-neutral`；
2. press/release 各一次，`physical_input_count=1`；
3. neutral move 位于 2500ms postcondition 读取之前；
4. 普通 click、doubleClick、模型、推理、附件与限流确认事件序列完全不变；
5. confirmed-effect recovery 的 pointer 事件增量为 0；
6. neutral move 抛错后 WAL 保留 `DISPATCHED`，第二 submit 增量为 0；
7. submit command 的 `request_hash`、`payload_hash`、`provider_effect_identity` 改造前后完全一致；
8. 不新增 DOM read、Tab activation、navigation、polling 或 timer。

聚焦命令：

```text
npm run acceptance:gpt
npm run acceptance:local-browser-terminal
npm run audit:build
```

若用户随后授权 READY，再使用冻结的 `$ci-full-governance` 执行唯一：

```text
npm run quality:check -- READY
```

READY 不等于 RELEASE；真实生产是否消除悬浮提示，只能在独立 RELEASE 授权下以真实 Chrome 页面观察证明，最终业务完成仍须 Website admission receipt 与领域对象读回。

## 八、当前候选保护

- AGENT：`main@368b3329be027b0376c89c72ea704b89269955e3`
- 当前用户未提交文件 `docs/项目方案/固定文案五语会话压缩任务-完整实现方案.md` 不得触碰。
- Website 当前 `main@266b63e2323f4c9a2984f01ba3fea59d41ad0d23` 虽有未提交工作，但本轮不修改 Website，也不把其 dirty 内容纳入本次候选。
- 施工前重新核对目标文件 Git 状态；出现重叠修改立即停止。

最终裁决：本轮只解决已观察到的“发送后指针悬停”。人工误点防护没有事故证据且会扩大页面控制范围，明确不施工、不预留兼容口、不建立未来接口。
