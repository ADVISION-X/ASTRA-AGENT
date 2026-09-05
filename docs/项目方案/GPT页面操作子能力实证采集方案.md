# GPT 页面操作子能力实证采集方案

> 版本：V1  
> 日期：2026-09-05  
> 状态：Skill 已建设；静态分母已绑定；真实 Chrome 全量采集尚未执行  
> 方案性质：项目工程方案与证据说明，不是 active law、Blueprint、READY、RELEASE 或第二份 quality verdict

## 一、直接结论

建立一份“Codex 不打开实时 Chrome 也能用”的 GPT 页面操作实证资料是有生产价值的，但必须把它定位准确：

1. 它是页面操作 Child 的离线工程输入，用来改代码、补边界、造确定性 fixture、做回归和评审。
2. 它不能成为生产运行时读取的 DOM 库，不能替代 Browser Authority，也不能成为全局 selector registry。
3. 它不能替代准确候选上的新鲜真实 Chrome 最终证明。
4. 纳入范围不看 Child 是否叫 DOM observation；只要它会读取、导航、点击、输入、上传、等待、检查点或取得页面媒体，就必须采集。

本方案选择一个 Skill、一份矩阵、一份当前报告，不建立第二存储、历史台账、兼容桥或新的生产服务。

## 二、用户原则转换成可执行合同

### 2.1 总目标

采集完成后，Codex 在迭代任一 GPT 页面操作 Child 时，可以仅依靠：

- 当前 Child 合同；
- 当前源码与 Browser typed contract；
- 该 Child 的核心圈、相关圈、外围圈实证；
- 真实页面样本及其单变量派生负例；
- 明确的源码、候选、页面环境与证据绑定；

完成页面判定逻辑设计、实现、离线 fixture、确定性测试和影响分析，而不需要临时打开 Chrome 猜页面。

### 2.2 纳入标准

页面操作包括：

- 读取或判断页面状态；
- 导航、聚焦或核验会话；
- 展开、关闭、选择、点击、输入、上传或提交；
- 等待文本、图片、上传或页面生命周期稳定；
- 从页面建立文本、图片、动作菜单或 fork 关系检查点。

当前静态准入以 `requiredTargetKind !== "none"` 为入口，同时扫描 `src/capabilities/gpt/web/` 的实际实现。合同说“不操作页面”但实现进入 web Owner，或合同说“操作页面”但没有 web 实现，都必须失败关闭。

### 2.3 当前分母

当前 GPT Child 合同共 27 个：

- 页面操作 Child：21 个，全部必须采集；
- 非页面 continuation transaction Child：6 个，不采集页面信息，但仍保留在总分母报告中，防止把它们误算或漏算。

21 个页面操作 Child：

1. `verify_gpt_conversation_identity`
2. `reconcile_gpt_attachment_set`
3. `reconcile_gpt_draft`
4. `reconcile_gpt_turn_submission`
5. `checkpoint_gpt_text_response`
6. `checkpoint_gpt_generated_image`
7. `prepare_clean_gpt_chat`
8. `focus_exact_gpt_conversation`
9. `open_gpt_execution_profile`
10. `open_gpt_model_selector_v2`
11. `select_exact_gpt_model_v2`
12. `ensure_gpt_reasoning_requirement`
13. `close_gpt_execution_profile`
14. `open_gpt_attachment_control`
15. `write_exact_gpt_prompt`
16. `wait_for_stable_gpt_text`
17. `wait_for_stable_gpt_image`
18. `open_gpt_checkpoint_actions_menu`
19. `attach_approved_gpt_files_once`
20. `submit_exact_gpt_turn_once`
21. `fork_exact_gpt_conversation_at_checkpoint`

6 个非页面 Child：

1. `persist_gpt_continuation`
2. `reserve_exact_gpt_continuation_once`
3. `complete_exact_gpt_continuation_reservation_once`
4. `acquire_gpt_continuation_lane`
5. `advance_gpt_continuation_lane`
6. `release_gpt_continuation_lane`

## 三、每个 Child 必须收集的三圈

### 3.1 核心圈：目标自身

- 清洗后的目标结构与 `outerHTML`；
- 安全属性、ARIA、disabled、hidden、inert、contenteditable；
- connected、布局、视口、computed visibility、pointer events；
- 动作目标的 hit-test 和操作资格；
- 当前语义 scope、候选基数、选中原因、拒绝候选及原因；
- 合成文字原文，白名单 UI 标签，其他文字只保存哈希和长度。

### 3.2 相关圈：为什么它在这里成立

- 祖先链、直接兄弟、所属 composer、turn、panel、menu、attachment card 或 media container；
- trigger 与 panel、source turn 与 actions menu、assistant turn 与 media 的绑定；
- 动作前后归一化 DOM diff；
- 实际事件顺序、正反 postcondition、unknown outcome readback；
- Child 合同、实现文件、私有 query 规格以及 Browser command/WAL 的安全投影。

### 3.3 外围圈：什么环境使它变成这样

- page kind 和哈希化 conversation identity；
- locale、viewport、theme、Chrome 版本和 provider build marker；
- 账号 UI、模型 UI、reasoning 档位规模；
- overlay、dialog、hydration、generation、rate-limit 等现场状态；
- 当前 contract version、源码/法案/Blueprint/Manifest/registry/矩阵/采集器的内容寻址绑定哈希。

三圈缺任何一圈，该 specimen 都不能算完整。

## 四、真实样本与派生负例

### 4.1 真实页面证据

只有在本次专用 QA Chrome 标签页直接观察到的状态才标记 `LIVE_PAGE`。全量采集以三个合成场景覆盖 21 个 Child：

- `text-main`：clean chat、profile、model、reasoning、附件、prompt、draft、submit、稳定富文本和 checkpoint；
- `image-main`：图片生成、稳定语义媒体、original identity 和图片 checkpoint；
- `focus-fork`：准确会话 focus、身份核验、source turn 菜单、fork 与父子关系。

### 4.2 确定性负例

由清洗后的真实样本单变量派生，并标记 `DERIVED_FIXTURE`：

- missing、duplicate/ambiguous；
- hidden、aria-hidden、inert、disabled、no-layout；
- stale/revision drift、Document drift；
- 每个 Child 自己的业务负例，例如 wrong turn、wrong conversation、selection did not stick、upload pending、submit unknown outcome、thumbnail only。

派生 fixture 只能支撑离线回归，不能冒充“页面上真的发生过”。

## 五、唯一 Owner 与禁止接线

生产 Owner 不变：

```text
Product：流程、授权、输入、截止时间
    ↓
GPT Child：语义意图、局部合同、私有 query 规格、正反 postcondition
    ↓
Browser Authority：物理 Target、Document、selector 解析、动作、FIFO、WAL、readback
```

Skill 和报告：

- 不被 `src/` 生产代码 import；
- 不向 Browser 公共接口传 selector、JavaScript 或坐标；
- 不生成第二个页面事实 Owner；
- 不把持久化报告当成生产时 coherent packet；
- 不建立 fallback、dual-read、shadow path 或第二质量结论。

## 六、隐私与页面安全

真实采集只允许：

- Skill 临时生成的唯一 marker、提示词、`.txt`、`.json` 和真实 UTF-8 `.zip`；
- 本次新建且唯一绑定的 QA Chrome 标签页；
- 本次创建的测试会话。

禁止采集：

- 原始 conversation ID；
- Cookie、localStorage、sessionStorage、密码、Authorization header、access/refresh token；
- 用户已有会话、提示词、回复、附件名或媒体；
- AGENT 系统生产标签页和用户已有标签页。

原始会话 URL 必须在进入资料前变成 `/c/sha256:<digest>`。结束时只关闭本次 QA 标签页；服务端测试会话不自行删除，除非用户另行授权。

## 七、产物

### 7.1 Skill

目录：`/Users/nexgen/.codex/skills/gpt-page-operation-evidence/`

- `SKILL.md`：模式、边界、执行顺序和离线闸门；
- `references/page-operation-matrix.json`：21 个 Child 的采集状态合同，不保存 selector；
- `references/evidence-schema.md`：三圈和报告 schema；
- `references/collection-protocol.md`：真实 Chrome 采集协议；
- `scripts/report-tool.mjs`：盘点、合并、绑定和严格校验；
- `scripts/make-fixtures.mjs`：生成纯合成提示词与三类附件；
- `agents/openai.yaml`：Skill UI 元数据。

### 7.2 项目报告

当前唯一机器资料：`docs/项目方案/GPT页面操作子能力实证资料.json`

它记录：

- 27/21/6 分母；
- 每个 Child 的当前 contract、源码引用和 Product 消费者；
- 法案、Blueprint、GPT/Browser 源码与矩阵的绑定哈希；
- 每个页面操作 Child 的 required/optional 状态；
- 未来 capture 的三圈 specimen 和离线就绪缺口；
- `claimsQualityVerdict: false` 与 `productionRuntimeConsumer: false`。

只保留当前一份报告。刷新时重新绑定当前候选并原子替换，不在项目中累积第二资料库。

绑定模型固定为 `content-addressed-v1`：报告只绑定矩阵、现役法案/Blueprint/Manifest/registry、GPT/Browser 源码与采集器自身的实际内容，不把 Git HEAD、dirty 状态或报告自身写进有效性哈希。这样报告随同相同内容提交后，可在 clean commit 上原样复验；任何受绑定内容变化仍会立即失效。

## 八、生产价值验收

### 8.1 本次建设验收

- Skill 可以从现役合同自动盘点 27 个 Child；
- 自动确认 21 个页面操作 Child 与 6 个非页面 Child；
- 合同与 web 实现分母不一致会失败；
- 报告与当前源码、Browser 源码、法案、Blueprint、Manifest、registry、矩阵及采集器内容绑定；
- 临时 fixture 可重复生成并带 SHA-256；
- 初始报告如实标记 `NOT_CAPTURED`。

### 8.2 完整采集验收

只有同时满足以下条件才标记 `CAPTURE_COMPLETE`：

- 21 个页面操作 Child 全覆盖；
- 每个 required live state 都有 `LIVE_PAGE`；
- 每个 required negative state 都有 `DERIVED_FIXTURE`；
- 每个 specimen 的核心圈、相关圈、外围圈非空；
- 专用 Chrome QA 标签页身份已哈希绑定；
- 隐私扫描与当前源码绑定通过；
- 严格校验通过。

这时可以说“离线工程资料完整”，仍不能说 READY、RELEASE 或已经生产发布。

### 8.3 离线迭代验收

Codex 针对一个 Child 开工前运行严格校验：

- 报告完整且绑定未漂移：可以不打开 Chrome 迭代；
- 报告不完整：列出准确缺失状态，不猜页面；
- 修改了合同、页面 query、Browser typed contract 或 authority：旧报告立即失效，先刷新实证；
- 实现完成后仍需在准确候选上做真实 Chrome 最终证明。

## 九、定期运行建议

定期自动化应先生成临时 inventory 与当前报告比对：

1. 没有绑定漂移且严格校验有效：保持安静。
2. 有合同、源码、矩阵或 provider 页面漂移：进入专用 QA 标签页刷新。
3. 只有完成、失效、失败或需要用户介入时通知。
4. 定期刷新不得与 AGENT 生产 Browser 同时操作页面。

建议在首次人工完整采集并确认账号功能覆盖后，再创建定时自动化。这样定期任务复用的是已经跑通的采集合同，而不是定时重复试错。

## 十、当前如实状态

- Skill：已建设。
- 21 个页面操作 Child 矩阵：已建设。
- 当前合同/源码/权威静态绑定：由报告工具生成。
- 真实 Chrome 页面实证：尚未执行。
- 离线迭代完整就绪：否；原因是缺少首次全量 `LIVE_PAGE` 与 `DERIVED_FIXTURE` 资料。
- `acceptance:gpt:real-proof`：现役入口明确未准入，不能拿它伪装成本采集器。

下一阶段应执行一次受控人工全量采集。首次通过后，才适合把同一 Skill 接到定期自动化。
