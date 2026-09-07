# 真实 Chrome 采集协议

## 1. 准入

已有初始页面快照后，只有以下两个触发器允许进入真实页面：

- `PAGE_EVIDENCE_CONFLICT_CONFIRMED`：现有报告已被 Child 的真实 GPT 页面执行实际消费，并由同一次事件的代码、日志和页面回读共同证明报告页面事实与当前页面冲突；
- `HUMAN_REQUESTED_RECAPTURE`：用户明确要求立即、手动或周期重采集。

其它原因全部返回 `RECAPTURE_FORBIDDEN`。候选、源码、合同、Product、法案、Blueprint、矩阵、需求 digest 或 provider build marker 改变，都只能触发离线投影刷新，不能进入真实页面。

开始前必须证明：

1. `inventory --read-only` 证明当前 28 个合同中 22 个页面 Child 全部映射到各自独立实现；合同与页面调用不一致时报告精确 Child 并停止。
2. 本批次元数据包含合法触发器。`PAGE_EVIDENCE_CONFLICT_CONFIRMED` 还必须包含同一事件的代码、日志、页面回读三份 hash-only 证据和受影响场景；`HUMAN_REQUESTED_RECAPTURE` 必须包含用户要求的范围。每个 scene 只绑定同一 run、`captureEpoch` 与 QA tab identity，不绑定 candidate、实现 hash、矩阵 digest 或需求投影 digest。
3. AGENT 的生产 Browser 当前没有正在执行、已 claim 未终结或等待恢复的动作。
4. 可以新建并唯一绑定一个 QA Chrome 标签页；不会操作用户已有标签页或系统生产标签页。
5. 当前账号允许使用必要的模型、reasoning、附件、图片与 fork 功能。
6. 页面内容输入均来自 `make-fixtures.mjs` 的 V2 合成 manifest；模型和推理要求只来自当前 Product Profile 的 hash-only 授权事实；跨 Child 输入只来自 `chainInputs` 声明的前驱安全 evidence ref/hash。

法案与 Blueprint 是需求来源，不由本 Skill 另设质量裁决。它们、合同、实现语义、Product 消费者或矩阵改变时，只使离线投影过期。必须先刷新投影再消费，但稳定页面快照保持有效；新投影找不到必需页面事实时返回 `PAGE_EVIDENCE_GAP`，仍不得自动采集。

无法证明任一项时失败关闭，不要用“看起来空闲”替代证据。

## 2. 标签页与隐私边界

- 用 `chrome:control-chrome` 创建一个新标签页并记录本次 tab identity。
- 只在这个标签页上导航和操作。页面自己产生的新 fork 标签页必须立即绑定为本次 QA 子标签页并记录父子关系。
- 不读 Cookie、浏览器存储、密码框、token、Authorization、扩展私有数据或其他标签页内容。
- 不采集现有会话；创建专用测试会话，并使用唯一 run marker。
- 原始会话 URL 在进入 capture JSON 前必须替换为 `/c/sha256:<digest>`。
- 页面文字只保留合成 fixture 或白名单 UI 标签；其余只保留哈希和长度。
- 使用 `chrome-scene-collector.mjs` 后，每个场景必须原子写入仓库外 scenes JSON；文件损坏时失败关闭，禁止清空覆盖。隐藏但真实参与 file chooser 的 input 用 `collectHiddenTarget`；真实动作使用 `performAndCollect`，普通 `collect` 没有 command/receipt 权利。
- capture 必须记录不可变 `captureEpoch` 与合法 `recaptureTrigger`；scene 只能绑定该 epoch、run 与 QA tab。candidate、matrix 和逐 Child 需求属于可反复重算的离线投影，不得写成 scene 的有效期。browser 元数据必须明确记录 `controlSkill: chrome:control-chrome`、`qaTabCreatedByRun: true`、`livePageObserved: true`，并附带非空的 `productionBrowserIdleEvidence`。

## 3. 场景

一次完整刷新使用最少的三个场景，不为每个 Child 各建一套重复环境。

### A. `text-main`

覆盖 clean chat、会话身份、execution profile、模型、reasoning、附件菜单、三类附件、prompt、draft、submit、hydration、稳定文本、富文本语义投影与 checkpoint。

合成响应必须同时覆盖：标题、粗体、斜体、行内代码、有序和无序列表、中文、英文、emoji、JSON code block、段尾换行。

### B. `image-main`

覆盖图片生成中的页面、稳定图片、语义媒体节点、original-content identity 和图片 checkpoint。不得把缩略图、预览图或错误卡片当作原始媒体。

### C. `focus-fork`

覆盖从根页面到准确会话的 focus、身份核验，以及三个独立 Child：第一步打开 source turn 动作菜单，第二步打开 fork destination 菜单，第三步点击最终 fork 叶子并证明 child conversation 与父子关系。采集器按当前 Child 合同与实现记录真实动作、页面变化和最终 Target/Tab 现场，不解释或裁决治理文件。

## 4. 每个 live 状态的采集顺序

1. 读取当前 document identity 与 page kind。
2. 在 Child 自己的语义 scope 中枚举候选，并记录基数。
3. 对每个候选记录资格或拒绝理由。
4. 对目标记录核心圈。
5. 记录祖先、兄弟、关联控件、panel/turn/card/media 等相关圈。
6. 记录 locale、viewport、theme、overlay、hydration、generation 等外围圈。
7. 若为动作 Child，记录动作前 observation、typed command、terminal receipt、动作后 observation 与直接 postcondition；若为纯观察 Child，command/receipt 明确写 `NOT_APPLICABLE`。
8. 立即重新读取 document identity；发生漂移则该 specimen 失败，不能把前后两个 Document 拼成一份证据。
9. 为 required live 状态记录由现场关键事实计算的唯一 `stateSignature`；复制同一份 DOM 或只改 stateId 不得形成多个状态。

页面 scene 不记录当前 `demandDigest`。装配和离线投影阶段为每个 Child 记录当前 `projectionDigest`、与矩阵精确相等的 `inputRefs`，以及覆盖需求事实的 `factBindings`。合成输入引用存在于同一 `captureEpoch` 的 fixture manifest；授权输入和前驱引用作为投影输入单独绑定。缺少、多出、hash 非法、字段指针不存在或 binding 不指向本 Child live observation 都不得完成。

`core.targets.<target>` 只有在该 live state 自己的唯一 scene 中枚举到恰好一个合格候选时才能写入；必须同时包含 `observed: true`、selector 相关清洗 attributes、有效 `identityHash`、真实 `nodeIndex`、`sourceSceneId` 与 `sourceSceneSignature`。禁止跨 scene 拼接、support scene 借目标或同一 scene 映射两个 required state。

每个 public Browser 调用仍由 Browser Authority 自己解析物理 selector。capture 可以保存清洗后的页面结构与 Child 私有 query 的源码引用，但不能向 Browser 公共接口注入 selector、JS 或坐标。

## 5. 派生负例

每个 Child 都从 LIVE_PAGE 样本生成下列确定性 fixture：

- `candidate-missing`
- `candidate-duplicate-or-ambiguous`
- `candidate-hidden`
- `candidate-aria-hidden`
- `candidate-inert`
- `candidate-disabled`
- `candidate-no-layout`
- `stale-or-revision-drift`
- `document-drift`

再叠加矩阵的 `childSpecificDerivedStates`。派生时只改变被测试的一个关键事实，并保存从哪个 live specimen 派生、变更字段和预期失败码。

## 6. 完成与失败

完成条件：22 个页面操作 Child 的全部 required input、live/derived 状态、三圈、动作证据链与需求事实绑定齐全，隐私扫描通过，`validate --repo --require-complete` 与 `admit --child all` 都通过。

出现以下任一情况整次刷新不能标记完成：

- 分母与当前 28 个合同不一致；
- 实现调用页面但合同仍写 `requiredTargetKind: none`；
- 专用标签页失去唯一性或误触其他标签页；
- 页面变体无法覆盖必需状态；
- 发现任何敏感信息或真实用户内容；
- 页面动作效果不明确、unknown outcome 未先 readback 就重放。
- 三个 terminal error 没有真实 Chrome 页面状态，却被派生 fixture 或超时替代；
- required live 状态签名重复、状态断言与实际字段矛盾，或需求覆盖低于 100%；

只允许报告缺口和精确失败原因，不能用旧截图、旧报告或派生 fixture 补成实时成功。

## 7. 定期运行

自动化不得按源码变化触发整份资料刷新。只有用户明确要求定期页面复核时，才可先做 `inventory --read-only`，再按既定页面场景采集；无页面事实变化时保持安静，完成、采集失败或需要用户介入时才通知。不得创建第二份历史库，也不得在生产代码内接入报告。
