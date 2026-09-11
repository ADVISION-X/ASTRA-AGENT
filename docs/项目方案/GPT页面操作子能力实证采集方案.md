# GPT 页面操作子能力实证闭环方案

> 版本：V5
> 日期：2026-09-06
> 状态：低成本闭环已冻结；页面快照与工程需求投影已解耦，日常迭代禁止自动重采集
> 性质：工程需求与证据方案，不是 active law、READY、RELEASE 或第二质量裁决

## 一、直接结论

唯一主链固定为：

```text
          稳定真实 Chrome 页面快照（昂贵、低频）
                    ↓
现役法案 / Blueprint / 合同 / 实现 / Product 消费者
                    ↓
     逐 Child 离线需求投影（廉价、每次迭代可重算）
                    ↓
              当前唯一 V5 报告
                    ↓
      admit 对准确候选和目标 Child 强制消费
                    ↓
              Child 修复 + 确定性测试
                    ↓
   离线 refresh / admit / 原生 quality:check
```

报告不进入生产运行时，不成为 selector registry、Browser Authority 或第二质量 verdict。任何页面 Child 开工前未取得 `ADMITTED`，就不得继续迭代。

## 二、分母与 Owner

现役合同共 28 个 Child：22 个页面 Child，6 个 continuation transaction Child。纳入标准不是名字里有没有 DOM，而是职责是否读取、导航、点击、输入、上传、等待、检查点或取得页面媒体。

Owner 不变：

```text
Product：流程、授权、输入和前驱结果
GPT Child：语义意图、私有 query、正反 postcondition
Browser Authority：Target、Document、机械 DOM、动作、WAL 和 readback
Skill 报告：候选绑定的离线工程事实，只供迭代消费
```

不新增 Child、公共 selector registry、第二 observation、第二存储、兼容桥或第二质量结论。

## 三、逐 Child 需求生成

`inventory` 为每个页面 Child 生成唯一 `evidenceDemand`，至少包含：

- 当前合同的语义意图、输入、前置、动作资格、mutation budget、正反 postcondition、replay policy；
- 矩阵声明的 core targets、required live/derived states 和输入引用；
- Child 私有实现的内容 hash 与去注释归一化语义 hash；
- 实际 Product 消费文件的内容 hash 与语义 hash；
- 现役 GPT Blueprint 的内容与语义 hash；
- `Document/revision → pre → typed command → terminal receipt → post → direct postcondition` 证据链要求。

需求 facts 和上述来源共同形成逐 Child `projectionDigest` 与 `childCandidateDigest`。语义来源改变时返回 `REPORT_PROJECTION_STALE`，随后只运行离线 `refresh`；它不得使真实页面快照失效，也不得自动启动 Chrome。

## 四、采集合同

初始快照完成后，只有两种事件可以产生新的 `captureEpoch`：

1. 当前报告已被 Child 的真实 GPT 页面执行实际消费，并由同一次事件的代码、运行日志和页面回读共同确认页面事实冲突，记为 `PAGE_EVIDENCE_CONFLICT_CONFIRMED`；
2. 用户明确要求立即、手动或周期重采集，记为 `HUMAN_REQUESTED_RECAPTURE`。

除此之外固定返回 `RECAPTURE_FORBIDDEN`。编译、测试、候选、合同、实现、Product、法案、Blueprint、矩阵、需求 digest 或 provider build marker 改变均不是重采集理由。实际消费冲突只重采受影响场景；只有用户明确要求全量时才全量采集。

只允许使用 `chrome:control-chrome`，并新建、唯一绑定一个 QA 标签页。不得接管用户已有标签页或 AGENT 生产标签页，不得读取 Cookie、storage、密码、token 或既有会话内容。

两个最小场景：

- `text-main`：clean、profile、model、reasoning、附件、prompt、draft、submit、hydration、稳定富文本和 checkpoint；
- `image-main`：生成中、稳定语义媒体、original content identity 和图片 checkpoint；

每个 required live specimen 必须记录：

- `observationId`、Target/Document hash、revision 和不可重复的 `stateSignature`；
- core 的真实 targets、候选基数、资格、结构、安全属性、computed style、布局和文本投影；
- related 的 owner/ancestor/sibling/linked-node、前后 diff、源码引用和完整 transition chain；
- peripheral 的 page kind、清洗 URL identity、locale、viewport、theme、Chrome/provider build 和页面状态；
- 逐需求事实 `factBindings`：`factId → LIVE observationId → 实际字段路径`。

派生负例必须标记 `DERIVED_FIXTURE`，单次只改变一个事实，并回指同 Child 的 live observation。它不能证明页面真的存在该状态。

以下三个 terminal error 必须是 `LIVE_PAGE`：

- `reconcile_gpt_attachment_set / attachment-terminal-error`
- `wait_for_stable_gpt_text / generation-error`
- `wait_for_stable_gpt_image / image-error-terminal`

无法在真实页面合法取得时保持缺口，不猜 selector，不用 timeout 或派生 fixture 顶替。

## 五、报告与准入

唯一报告：`docs/项目方案/GPT页面操作子能力实证资料.json`。

V5 报告区分：

- `NOT_CAPTURED`：需求盘点完成，没有有效 capture；
- `CAPTURE_PARTIAL`：存在采集，但仍有明确缺口；
- `CAPTURE_COMPLETE`：22 个页面 Child 的采集合同完整。

`CAPTURE_COMPLETE` 仍不是候选准入。目标 Child 必须运行：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs admit \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id \
  --candidate exact_HEAD_or_WORKTREE_digest
```

只有返回 `ADMITTED` 才能施工。完整 Child 消费全部事实；只有明确缺口的单个 Child 才可用 `--facts` 绑定本次修改实际消费的已观察事实，未知、未观察或未声明范围固定拒绝。指定 Child 时逐项准入，只有 `--child all` 才要求 22/22；terminal 现场缺失只阻断对应事实，不得连坐该 Child 已证明的成功观察、下游已绑定的具体成功结果或其余 Child。法案/Blueprint 未点名页面 Child 的其它域变更不得回退为 22 个 Child 全受影响。旧 V1/V2/V3/V4 固定返回 `REPORT_LEGACY_INVALIDATED`。

## 六、反馈更新与 AGENT 闭环

Child 修复顺序：

1. clean → focus → verify；
2. profile → model selector → exact model → reasoning → close；
3. attachment control → attach/reconcile → prompt → draft；
4. submit → submission reconcile；
5. text/image wait → text/image checkpoint；

每个批次完成后必须：

1. 重跑 `inventory`，确认分母仍为 28/22/6；
2. 运行不接收 capture 的离线 `refresh`，廉价重投影全部页面 Child，保持同一 `captureEpoch`；
3. 重跑目标 Child `admit`；
4. 运行该 Child 确定性反例；
5. 运行 AGENT 唯一原生 `quality:check`，不得另报平行质量结论；
6. 若业务任务本身要求真实 GPT 页面执行，再运行目标 Child；只有该次执行报错并取得同一事件三方冲突证据，才允许重采集；
7. 若属于业务完成，再由 Website admission/storage 接收并读回，成功入库才算业务闭环。

## 七、硬验收

闭环达到 95% 以上不是主观打分。以下任一 P0/P1 缺失都不能通过：

- 22/22 页面 Child 有当前 demand；
- 页面 facts 绑定真实 observation 和实际字段；合同、Product、authority 等非页面 facts 绑定当前离线投影；
- required live 状态不重复、不自相矛盾；
- 三个 terminal error 保持真实 Chrome 边界；
- 任何页面 Child 开工前能被 `admit` 强制拦截；
- 修复后有离线重投影、目标确定性测试和原生 quality verdict；真实页面执行按业务任务需要运行，但不得等同于重新采集；
- 自动重采集入口固定拒绝，只有两个合法 trigger 可改变 `captureEpoch`；
- 报告仍只有一份，生产代码没有导入 Skill、报告或 selector 数据。

Skill 自验必须通过完整基线，并拒绝：无 trigger 采集、源码变化触发采集、复制同一 live DOM、unchecked/checked 矛盾、遗漏 fact binding 和派生 terminal substitution；同时证明代码变更后可在相同 `captureEpoch` 离线重投影。

## 八、当前真实状态

- Skill、矩阵、可恢复的 Chrome 场景采集器、capture 装配器、V5 validator/admit、离线 refresh 和对抗性自验：已建设；
- 28/22/6 分母与逐 Child demand：已从修复后当前候选重新生成；
- 旧 V3 `CAPTURE_COMPLETE`：已撤销，固定视为历史失效报告；
- 当前唯一报告：`V5 / CAPTURE_PARTIAL`；已有页面现场保留在同一稳定 epoch，工程变化通过离线投影消费，不再以版本迭代为由重采集；
- 当前 3 个存在真实页面缺口的 Child：`reconcile_gpt_attachment_set`、`wait_for_stable_gpt_image`、`wait_for_stable_gpt_text`；其余 19 个完整；
- 三个强制真实 terminal state 仍缺：附件 terminal error、文本 generation error、图片 error terminal；
- 图片场景已执行三次独立真实提交，其中两次显式选择“创建图片”，最长等待 90 秒；最终均为停止按钮消失、助手回合 0、语义媒体 0、可见错误 0，报告固定记录 `IMAGE_SUBMISSION_WITHOUT_TERMINAL_RECEIPT`，不冒充成功或错误终态；
- 附件初始三文件集合真实成功；移除 JSON 后重新上传，页面卡片 `aria-label` 变为带 `(1)` 的名称，报告固定记录 `ATTACHMENT_REUPLOAD_PROVIDER_RENAMED`；
- 已按报告修复 9 个获准入 Child 的真实 selector 偏差：以 `data-message-author-role` 绑定回合，并移除分支菜单项并不存在的 `tabindex/aria-haspopup` 假设；
- 修复后 `acceptance:gpt` 通过，原生 `quality:check CHANGE` 返回 `CHANGE_PASS`；
- `admit --child all` 与 3 个缺口 Child 的全量准入继续失败关闭；两个 checkpoint 按各自已存在的成功 observation 链准入，不再被上游无关错误状态连坐。缺口 Child 只有显式 `--facts` 的已观察范围可准入。

因此，日常 Child 迭代只重投影和按事实准入；4 个既有现场状态缺口继续如实保留，除非发生实际消费冲突或用户明确触发，否则禁止为了补齐数字自动重采集。
