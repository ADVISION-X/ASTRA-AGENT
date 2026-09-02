# Browser DOM 生产级方案

> 文档性质：Browser Owner 内部建设方案
>
> 版本：V2（与《生产级子能力稳定性建设规则.md》V5 合并裁定版）
>
> 实证基线：2026-09-02 当前工作树
>
> 状态：已授权按从属工单施工；未授权修改 active law 或 Blueprint；不构成 READY、RELEASE 或生产完成证明

## 一、结论

Browser DOM 必须存在，而且必须建设到生产级。它不是第二个 GPT，也不是第二个调度器；它只有一个职责：

> **在 exact Target 和 current Document 上，提供可验证的机械事实，并在唯一 WAL 门内执行零次或一次已获许可的物理输入。**

Browser DOM 不回答“业务上该不该点”，不安排 27 个 Child 的先后，不决定任务重试，不宣布 Website 已完成。

四份文档合并后采用一个施工链：

    子能力总工单
      ├─ GPT Child / Product / Runtime / Website 集成
      └─ Browser DOM 从属工单
           └─ Browser 内部事实、观察、动作、WAL、Browser 证据

两张工单由同一个施工人执行。Browser 从属工单只把 Browser 原生证据交回总工单；最终仍只有现役唯一 quality verdict。

## 二、边界

| 层 | 唯一责任 | Browser DOM 不得取得 |
| --- | --- | --- |
| Product Plugin | Child 顺序、业务 deadline、跳过和恢复 | Browser 不排序任务、不决定下一步 |
| GPT Child | 一个页面局部语义意图、DONE/ACT/WAIT/FAIL_CLOSED、直接后置 | Browser 不解释 Provider 语义 |
| Browser Authority | exact Target/Document、命令许可、FIFO/park、WAL、Browser terminal | 不持有 Product Flow 或 GPT 合同裁决 |
| Browser Extension | 当前 Document 重绑、机械重验、物理输入零或一次、新鲜机械读回 | 不自行扩展 selector、不选择替代动作 |
| Runtime | attempt/lease/fence、运输、结构化失败与交付 | Browser 不拥有任务重试 |
| Website | claim、撤权、领域接收、入库和业务完成 | Browser 成功不等于订单完成 |

硬边界：

1. 只保留现役 Browser Authority、现役 extension wire、现役 compact mutation WAL。
2. 不增加第二 DOM reader、第二队列、第二 WAL、snapshot service、selector registry、脚本 DSL、兼容桥或 fallback。
3. Browser wire 不承载凭证、Prompt、用户输入、原始 DOM/HTML、资源 URL 或可变本地路径；法案明确允许的生成媒体原始字节例外仍按现役合同处理。
4. Target、Document 和 WAL raw row 只由 Browser Owner 持有；上层只消费安全投影或不可逆 identity hash。
5. Browser terminal、GPT Child 结果、Runtime terminal、Website 业务完成是四层不同事实，不得互相冒充。

## 三、与 27 个 Child 的关系

27 个 Child 的唯一名称、画像和动作预算只维护在《生产级子能力稳定性建设规则.md》及其总工单中。Browser 本文不复制第二份名单。

Browser 只提供三种页面消费能力：

| Child 画像 | Browser 提供 | Browser 不提供 |
| --- | --- | --- |
| DOM_OBSERVATION（总工单分母 6） | 同一同步调用的机械事实包 | 业务成功判断 |
| TARGET_LOCAL_MUTATION（总工单分母 12） | 机械事实包、typed permit、WAL、零或一次输入、新鲜读回 | Product 顺序和 Provider 完成 |
| PROVIDER_EFFECT_ONCE（总工单分母 3） | 上述能力加 exact effect identity、不可重放事实 | Website 业务完成 |
| CONTINUATION_TRANSACTION（总工单分母 6） | 不经过 Browser | session/CAS 能力 |

因此 Browser DOM 的消费者分母是 21 个页面 Child，但 Browser 不拥有这 21 个 Child 的语义合同。

## 四、冲突清单与裁定

| 编号 | 旧文档或旧实现冲突 | 裁定 |
| --- | --- | --- |
| C-01 | 旧 Browser 文档仍按 26 个 Child | 退役旧分母；只引用总工单的 27，Browser 不维护第二名单 |
| C-02 | 旧工单绑定 Browser V15、GPT V17 与旧 Git baseline | 绑定现役 Browser V16、GPT V18 和本次施工前 HEAD |
| C-03 | Browser 工单和子能力工单都充当总工单 | 子能力工单是唯一总工单；Browser 工单降为 Owner 内部从属工单 |
| C-04 | fork 仍按一个 Child 或未决接口描述 | 采用现役两 Child 裁定；Browser 只执行两条互相独立的 typed mutation |
| C-05 | 旧方案另造 Browser 公开状态、错误码和调度字段 | 全部取消；复用现役 typed cause、Browser outcome、WAL 和 Runtime 状态 |
| C-06 | 旧工单把所有 REJECTED 都解释成动作已发生 | 资格拒绝为 `REJECTED + mutation_outcome=no`；动作后失败保留真实输入事实 |
| C-07 | `aria-hidden`、`inert` 被混进 layout/visible | 拆成机械渲染事实、语义隐藏事实和动作资格事实 |
| C-08 | 两张工单重复改 observation、mutation、evidence | Browser 源码只由从属工单施工一次；总工单只消费结果 |
| C-09 | GPT 权威要求 Browser 写 exact Prompt、读取 checkpoint DOM、设置获准本地文件；Browser V11 禁止 Prompt、用户输入、DOM/HTML 和可变本地路径进入 wire | 冻结为 `BLK-WIRE-001`；未获 active law 明确裁定前不施工、不绕路、不建立第二 transport |

C-09 是真实法案冲突，不是 Browser DOM 本身不该存在。当前 `fill.approvedText`、`inspect.outerHtml` 和 `file-input.resolvedFilePaths` 分别证明三类冲突已经落到现役 wire。它只挡住需要这些过线内容的 Child，不挡住 Browser 内部机械底座施工。

## 五、生产级机械事实模型

### 5.1 一次观察的最小输入

每个 observation 只接受 Browser 源码冻结的 JSON 结构：

- exact call identity 的安全绑定；
- exact Target 与 current Document 的 Browser 内部绑定；
- 有界 scope selector 和 query selector；
- 明确 cardinality；
- 允许字段枚举；
- 每项最大返回数量和总字节上限。

调用方不能传 JavaScript、正则脚本、任意 predicate tree、评分函数或 selector fallback。

### 5.2 字段必须彼此独立

Browser 对每个候选至少能按命令需要返回以下机械事实：

| 事实组 | 字段 | 规则 |
| --- | --- | --- |
| 身份 | candidate index、stable local identity hash | hash 只绑定本次 observation，不成为长期 selector |
| 连接 | connected | 使用 `isConnected` 真实读值，不得写死 |
| 布局 | layout | 是否存在实际 layout box；没有 box 是正常事实，不是协议失败 |
| 渲染 | display、visibility、effective opacity、hidden | 检查相关祖先链；不把 `aria-hidden` 或 `inert` 混进 layout |
| 语义可达 | aria-hidden、inert、role、accessible name、label | 原样机械采集，解释权属于 GPT Child |
| 控件 | disabled、aria-disabled、checked、value、type | HTML 与 ARIA 分开保留 |
| 识别 | testId、bounded text/name hash | 只返回合同允许的最少字段；证据不落原始页面内容 |
| 动作资格 | viewport、hit-test、pointer facts | 只在 mutation 或明确请求时计算 |

`rendered` 不能简化成“拿得到 box”；`actionable` 也不能简化成 `rendered`。动作资格至少还需要非 inert、非 disabled、唯一命中、viewport 和 hit-test 等命令专属条件。

### 5.3 raw 与 eligible 必须同时可证明

- raw candidate count：selector 实际命中数量。
- eligible candidate count：按本条 Browser 命令冻结的机械资格过滤后数量。
- 被过滤候选的必要机械原因必须保留在当次安全结果中，不能只返回一个数字。
- GPT Child 从这些事实作局部语义裁决；Browser 不返回 DONE/WAIT 等业务结论。

## 六、同瞬间 observation

1. 一包 observation 只能由一条 Browser-owned `Runtime.callFunctionOn` 同步函数完成。
2. scope、候选和全部请求字段在同一个 JavaScript turn 中采集。
3. 返回包绑定 exact call、Target、Document、observedAt 和 canonical facts。
4. `observationRevisionHash` 必须由 Browser 服务端对 canonical 包计算，不能相信扩展或调用方自报。
5. Document 改变、payload 不完整、字段越界、结果超限或调用异常时整包失败，不允许与旧包拼接。
6. 观察包只在当前调用期有效，不建立长期 snapshot registry。

最小结果形状：

    exactCallIdentityHash
    targetRefHash
    documentRefHash
    observedAt
    observationRevisionHash
    queries[]
      rawCandidateCount
      eligibleCandidateCount
      boundedMatches[]
      nativeCause
      stage

页面文本、selector、原始 DOM 和输入值不得进入持久化 proof。

## 七、typed mutation 与 WAL

### 7.1 单向门

同一个 exact action identity 只能沿以下顺序前进：

    authority/permit 验证
      → WAL PREPARED
      → 命令离开 Browser Authority 前写 WAL DISPATCHED
      → Extension 重绑 current Document 并机械重验
      → 物理输入 0 或 1
      → fresh readback
      → CONFIRMED 或 REJECTED；证据不足则保持 DISPATCHED

DISPATCHED 以后永远不回到动作门。新 Document generation 不是重做许可证。

### 7.2 四种唯一结算

| 现场事实 | Browser outcome | mutation_outcome | 后续许可 |
| --- | --- | --- | --- |
| 目标已满足，命令合同允许零动作成功 | CONFIRMED | no | 返回新鲜读回，不输入 |
| 机械资格不成立 | REJECTED | no | GPT Child 可基于 facts 判 WAIT 或失败；Browser 不重做 |
| 输入发生且直接后置成立 | CONFIRMED | confirmed | 保存 terminal 与 evidence；不可重放 |
| 回复/终局证据不足 | DISPATCHED | dispatched | 仅原 attempt 只读对账；不可重放 |

若输入已经发生但直接后置明确失败，必须真实记录输入事实与 `REJECTED`，不能伪装成零动作资格拒绝。

若原命令因回复缺失停在 `DISPATCHED`，后续 owning plugin 只能凭新鲜只读正反证据终结 Browser outcome；它还必须单独提交可证明的物理事实。只证明后置条件时，`mutation_outcome` 仍为 `dispatched`，不得反推成 `confirmed`。

### 7.3 mutation 命令约束

- click：唯一候选、identity 重验、viewport/hit-test、零或一次 click。
- keypress：只允许源码冻结键；repeat 有明确上限；一条命令内部完成，不拆成多个 dispatch。
- file input：只使用专门 typed 命令与 task-owned file grant；一次设置完整批准集合。
- 不允许任意 evaluate、任意属性写入、隐藏 slider 直接写、caller-authored 脚本或通用 range 命令。

## 八、file input 专项

1. GPT Child 必须先证明唯一 active 菜单/面板与唯一上传入口。
2. 目标合同只允许 Browser 接收已批准文件 grant 和数量/hash 等安全字段，不接收可变本地路径作为业务参数；但当前唯一 extension wire 无法从 grant 自行解析本地路径，现役命令实际携带 `resolvedFilePaths`，因此本专项受 `BLK-WIRE-001` 阻断，裁定前不得实现替代 resolver 或第二 transport。
3. Extension 在 current Document 内重新证明唯一 file input、accept/multiple/disabled 等机械条件。
4. 一个命令设置全部批准文件；禁止逐文件多次 dispatch。
5. fresh observation 必须证明全部且仅批准集合进入预期状态。
6. 上传中属于 GPT Child 的有界等待语义；Browser 不决定 deadline，也不切换到下一个任务。

## 九、错误与证据

### 9.1 错误

只使用现役 Browser typed cause。Browser 内部必须区分：

- 正常 no-layout 事实；
- Target/Document 失效；
- payload/schema 损坏；
- CDP/native 调用失败；
- cardinality 或动作机械资格拒绝。

不得再造一套公开错误词典，也不得靠固定英文错误全文分类。安全 root cause 与 stage 可以作为受控字段保留，但不得泄漏页面内容或敏感输入。

### 9.2 Browser 原生证据

Browser 只证明：

- exact Target/current Document 绑定；
- 一次同步 observation 的 canonical hash；
- raw/eligible cardinality 与请求字段；
- WAL PREPARED/DISPATCHED/terminal；
- 物理输入零或一次；
- mutation outcome 与 Browser outcome 正交；
- extension build/runtime 与 Browser-only current Chrome 事实。

它不证明 GPT 语义正确、Provider 业务接受、Runtime terminal 或 Website 入库。

## 十、恢复与调度边界

Browser lane 只序列化已经取得 Product 调用资格的物理命令：

- 正在执行的不可逆动作不得被下一任务抢占。
- Provider 等待由 Product 给出 `nextCheckAt`；park 释放 Browser capacity，但不表示 Child 完成。
- reacquire 后必须重新绑定 current Document 和 fresh facts。
- Browser 不创建订单优先级、不轮询 Website、不挑选 50 个订单谁先谁后。
- 同 exact action 已有 DISPATCHED/CONFIRMED/REJECTED 事实时，新任务或新 generation 都不得触发重复输入。

## 十一、施工范围

Browser 从属工单只允许施工：

1. 机械事实读取与字段分离。
2. 单次 coherent observation 与 canonical revision。
3. typed mutation permit、扩展重验和四种结算。
4. compact WAL 无损演进与只读恢复。
5. file-input 专门命令。
6. local-browser-session 原生 acceptance、mutant 和 Browser-only current Chrome 证据。

以下内容只能由总工单或各自 Owner 施工：

- 27 个 Child 的语义合同、handler 和画像；
- Product 调用顺序、wait/deadline 与恢复；
- GPT prompt/checkpoint 业务语义；
- Session CAS；
- Runtime delivery；
- Website 入库；
- active law、Blueprint 与唯一 quality verdict。

`BLK-WIRE-001` 未解决前，任何需要 Prompt、用户输入、原始 DOM/HTML 或可变本地路径穿过 Browser wire 的动作保持阻断。不得把阻断改名、吞错或用旁路伪装完成。

## 十二、完成标准

Browser DOM 只有同时满足以下条件，才能在自己的证据层声明生产级：

- 机械字段分离并能杀死 `connected` 常量、box=visible、ARIA/inert 混合和英文报错依赖等旧实现 mutant。
- 两个真实 GPT 消费者使用同一同步 observation，不再拼接多次读取。
- mutation 四种结算、extension crash、回复丢失、新 generation、非空 WAL 迁移均有确定性验收。
- file input 一条 typed command 完成，局部 scope 和 exact approved set 可证明。
- 当前 Chrome 上 Browser-only 证据通过，operator tab 未被污染，WAL 无未解释的可重放动作。
- touched production source 遵守现役 code-purity 红线，无第二 Owner、第二路径或第二 verdict。

即便以上全部通过，也只表示 Browser 物理层通过。27 个 Child、Provider、Runtime、Website 与最终唯一质量裁决仍必须由总工单分别证明。
