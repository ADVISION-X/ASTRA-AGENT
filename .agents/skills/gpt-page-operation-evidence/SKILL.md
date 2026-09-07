---
name: gpt-page-operation-evidence
description: 为 AGENT 的 GPT 页面操作子能力执行“稳定页面快照、当前需求离线投影、唯一报告、候选强制消费、反馈更新”的低成本闭环。只要子能力会读取、导航、点击、输入、上传、等待、检查点或获取页面媒体，就纳入；任何页面 Child 迭代前必须先通过候选绑定的 admit。普通运行、非页面 continuation 子能力和最终 RELEASE 验收不使用本 Skill。
---

# GPT 页面操作子能力实证采集

本 Skill 只有一条低成本主链：`稳定页面快照 → 当前需求离线投影 → 唯一报告 → Child 强制消费 → 修复 → 离线反馈重投影`。稳定页面快照证明 GPT 页面的真实结构；当前需求投影证明现役合同、实现、Product 与这些页面事实如何衔接。二者必须分离：代码、合同、矩阵、Product 或候选变化只能使离线投影过期，不能自动使页面快照过期，更不能自动启动 Chrome。报告不是生产运行时 DOM 数据源，也不是第二质量裁决。

## 先决定模式

1. **盘点模式 `inventory-only`**：用户只要求清单、范围、缺口或静态更新时使用。不打开浏览器。
2. **完整采集 `collect-full`**：用户明确要求采集、更新或定期刷新页面实证时使用。它会操作真实页面，只能用专用的新建 QA 标签页。
3. **离线迭代 `offline-iterate`**：用户要求迭代页面操作子能力时，先用现有稳定快照重新生成当前需求投影，再对准确候选和目标 Child 运行 `admit`。未返回 `ADMITTED` 时先修正离线投影或代码；只有命中“重采集铁律”之一才允许采集。
4. **反馈更新 `feedback-update`**：Child 修复后重新运行 `inventory`、离线重投影、`admit`、目标确定性测试和 AGENT 原生质检。需求改变不触发采集；现有快照确实不覆盖新增页面事实时返回 `PAGE_EVIDENCE_GAP`，等待合法重采集触发。

## 重采集铁律

初始基线建立后，新的真实 Chrome 采集批次只允许由以下两种事件触发：

1. **实际消费报错**：当前唯一报告已经被目标 Child 的真实 GPT 页面执行实际消费，并在同一次事件中由生产代码、运行日志与页面回读共同证明“报告中的页面事实与当前页面冲突”。此时记录 `PAGE_EVIDENCE_CONFLICT_CONFIRMED`，只重采受影响场景。
2. **人工明确触发**：用户明确要求立即采集、手动刷新或执行周期采集。此时记录 `HUMAN_REQUESTED_RECAPTURE`。

除这两种事件外一律返回 `RECAPTURE_FORBIDDEN`。编译失败、单元测试失败、候选 digest 改变、合同/实现/Product/Blueprint/矩阵改变、报告投影过期、provider build marker 改变或仅仅怀疑页面变化，都不得打开 Chrome、不得创建 QA 标签页、不得发送提示词、不得上传附件、不得创建分支，也不得执行全量或增量采集。

`schemaVersion` 只在报告字段格式发生不兼容变化时升级；日常工程迭代只更新廉价的 `projectionRevision`。`captureEpoch` 只在上述合法重采集事件发生时更新。同一 `captureEpoch` 可以承载任意多次离线需求重投影与 Child 修复。

## 启动即整轮授权

用户明确要求“启动、运行、刷新或采集”本 Skill 时，即视为已经对本 Skill 合同内的一整轮实证动作完成授权。执行期间不得在每次点击、输入、上传、提交、打开菜单、创建测试分支或关闭本轮 QA 标签页前重复询问授权。

该授权只覆盖：专用新建 QA 标签页、Skill 临时创建的合成提示词和合成附件、合成提示词提交、专用测试会话与测试分支、矩阵规定的菜单/模型/推理档位临时操作、页面观察与操作，以及临时采集文件和唯一报告的更新。执行者必须在 QA 场景结束前恢复能恢复的临时档位，不得把测试选择写成账号级设置。它不覆盖用户已有标签页、真实业务内容、生产 Browser 标签页、账号级设置、测试会话删除及矩阵外动作。

“启动即整轮授权”是本项目的授权合同：凡已明确列入本轮矩阵且只作用于上述合成 QA 边界的发送或页面 mutation，不得再把它当作缺少项目授权而暂停。若宿主运行环境另有不可覆盖的强制安全确认，Skill 不得伪造绕过；除此之外不得重复询问。

若生产 Browser 非空闲、候选漂移、目标标签页不唯一、页面出现敏感信息或动作结果身份不明，应失败关闭并报告具体阻断；这是安全闸门，不是再次索要授权。

## 强制入口

开始前读取：

- `/Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json`（唯一权威矩阵；Skill 与 AGENT 原生质检共同消费）
- `references/evidence-schema.md`
- `references/collection-protocol.md`
- 当前法案注册表绑定的 GPT 法案与 `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`
- 当前 `src/capabilities/gpt/contract.ts`
- `inventory --read-only` 识别出的现役页面 Child 及其源码映射

在采集、合并或离线迭代前先运行 `inventory --read-only`。它检查矩阵是否覆盖当前合同分母、每个 Child 是否有独立实现、页面合同与页面调用是否一致，并从当前合同、实现、Product 消费者、Blueprint 与矩阵生成逐 Child 需求摘要。法案/Blueprint 是需求输入，不由本 Skill 另作质量裁决；其语义变化只使需求投影过期，必须离线重投影，但不使稳定页面快照失效。

若任务进入真实 Chrome，必须再读取并遵守 `chrome:control-chrome` Skill。不得用终端 Playwright、CDP 或其他浏览器通道绕过它。

## 纳入规则

不用“是否有 DOM”来界定。只要 Child 的职责会对页面执行以下任一行为，就必须采集：

- 读取或判定页面状态；
- 导航或聚焦会话；
- 点击、输入、上传或提交；
- 等待页面稳定、生成完成或失败；
- 从页面建立文本、图片、菜单或会话检查点。

现役合同的静态入口是 `requiredTargetKind !== "none"`，但必须同时扫描实现是否调用 Browser 页面 API。合同与实现不一致时以失败关闭，不能漏采。

## 执行顺序

### 盘点模式

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs inventory \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --read-only
```

盘点模式只证明当前分母、独立实现、消费者映射与需求可生成，不写报告，也不能冒充完整采集。用户明确要求从零建立资料时，去掉 `--read-only` 并使用唯一 canonical `--output` 生成 V5 `NOT_CAPTURED` 报告；旧 V1/V2/V3/V4 固定失效，仓库内其它输出路径与第二份 V5 报告失败关闭。

### 完整采集

1. 先证明本次命中 `PAGE_EVIDENCE_CONFLICT_CONFIRMED` 或 `HUMAN_REQUESTED_RECAPTURE`，并把触发类型和作用场景写入批次元数据。否则返回 `RECAPTURE_FORBIDDEN`，不得进入浏览器。命中后再按 `collection-protocol.md` 做准入检查；生产 Browser 正在工作、无法证明空闲、专用标签页不唯一或需要读取敏感信息时，立即停止。
2. 在仓库外临时目录创建合成提示词和附件：

```bash
node /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/make-fixtures.mjs \
  --dir /absolute/path/to/dedicated-temp-dir \
  --run-id YYYYMMDD-HHMMSS
```

3. 用 Chrome Skill 创建并绑定一个新的 QA 标签页。只操作这个标签页；不要接管 AGENT 的系统生产标签页或用户已有标签页。
4. 按触发事件的作用范围采集；人工明确要求全量时才采集全部页面 Child，否则只采集被确认冲突的场景。创建 `chrome-scene-collector.mjs` 时必须传入 run、`captureEpoch`、合法触发记录与 QA tab identity；不得把 candidate、实现 hash 或需求投影 digest 固化为页面快照身份。每次 observation 原子写入仓库外 JSON；损坏 JSON 必须失败，禁止当空数组覆盖。隐藏文件输入使用 `collectHiddenTarget`；发生页面动作必须用 `performAndCollect` 取得真实 pre scene、命令返回与 post scene，普通 `collect` 不得被装配成动作成功。
5. 真实页面状态标 `LIVE_PAGE`；从真实样本生成的负向变体标 `DERIVED_FIXTURE`。二者绝不混称。
6. 为本轮建立临时 scene mapping，并用正式装配器把逐场景节点、当前 inventory、fixture manifest、有明确源文件绑定的 Product Profile hash-only 授权与生产 Browser 空闲前置证据装成 capture。每个 live state 只能消费自己的 `liveStateTargets`，所有 target 必须来自该状态自己的唯一 scene；禁止 support scene 借目标、同一 scene 冒充两个状态、任意 `main` 冒充 route/identity、硬编码候选数量或补造 command/receipt：

```bash
node /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/assemble-live-capture.mjs \
  --inventory /absolute/path/to/inventory.json \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --scenes /absolute/path/to/scenes.json \
  --mapping /absolute/path/to/scene-map.json \
  --fixtures /absolute/path/to/fixture-manifest.json \
  --browser-meta /absolute/path/to/browser-meta.json \
  --output /absolute/path/to/capture.json
```

7. 合并到唯一报告：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs merge \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --capture /absolute/path/to/capture.json \
  --output /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json
```

Child 修复后使用下面的纯离线命令。它不接收 capture，也不打开 Chrome；为防止跨 Child 链引用陈旧，内部会廉价重投影全部页面 Child，但只把 `--child` 作为本次关注范围返回：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs refresh \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --base-report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --output /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id_or_comma_separated_ids
```

旧 scene 可以继续作为稳定页面事实被新投影引用，但不得篡改其原始 `captureEpoch`、现场内容或来源；如果新需求确实找不到所需页面事实，只返回 `PAGE_EVIDENCE_GAP`，不得自动采集。

8. 运行严格校验：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs validate \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json
```

日常校验允许报告诚实保持 `CAPTURE_PARTIAL`；只有人工审计全量采集闭合时才增加 `--require-complete`。

9. 只关闭本次创建的 QA 标签页。临时文件可删除；ChatGPT 服务端测试会话不得自行删除，除非用户另行授权。

## 强制消费闸门

任何页面 Child 代码迭代前，必须运行：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs candidate \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id_or_comma_separated_ids

node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs admit \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id_or_comma_separated_ids \
  --candidate exact_CHILDSET_digest_from_candidate_command
```

完整 Child 使用上面的全 Child 准入。若 Child 只有明确的未观察状态，而本次修改只消费已经观察到的具体事实，则 `candidate` 与 `admit` 必须同时增加 `--facts`，只允许单个 Child：

```bash
node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs candidate \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id \
  --facts live-state:observed_state,target:observed_target

node --import tsx /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.mjs admit \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --child child_id \
  --facts live-state:observed_state,target:observed_target \
  --candidate exact_scoped_CHILDSET_digest
```

`--facts` 不是绕过：未知事实、未观察事实或遗漏范围固定拒绝。运行原生质检时，用同一事实集合提供 `GPT_PAGE_EVIDENCE_SCOPE` JSON；不完整 Child 没有显式范围时失败关闭。完整 Child 无需该变量。法案或 Blueprint 中未点名任何页面 Child 的其它域变更只刷新离线投影，不得回退成 22 个 Child 全受影响。

只有返回 `ADMITTED` 才能施工。`--child all` 要求 22/22 完整；指定一个或一组 Child 时只审查这些 Child，某个 terminal 现场缺失不得连坐其余 Child。完整 Child 消费全部事实；不完整 Child 只能消费 `--facts` 明确列出的已观察事实。它同时强制：

- 22 个页面操作 Child 全部在分母内；
- 每个 Child 的合成输入或 Product Profile hash-only 授权输入与矩阵精确一致；
- 目标 Child 的合同、需求摘要、实现语义、Product 消费者、Blueprint 与矩阵仍绑定当前候选；
- 全量准入时目标 Child 的必需真实状态、必需派生负例、三圈资料和需求事实绑定 100% 齐全；事实范围准入时只允许报告已经绑定的观察事实；
- required live 状态具有不同的现场签名；状态断言与页面字段一致；三个真实 terminal error 不得由派生 fixture 代替；
- 报告无原始会话 ID、凭据、Cookie、存储或用户历史内容；
- 报告没有把派生 fixture 冒充实时页面事实。
- 动作链已绑定当前 Document/revision、目标/owner 关系、typed command、terminal receipt 与直接后置；纯观察 Child 明确标记 command/receipt 不适用。

通过只代表“该报告的稳定页面快照已被准确候选的当前需求投影正确消费”。它不等于 `READY`、`RELEASE`、生产发布或 Website 入库。Child 修复后必须重新运行离线重投影、`admit`、目标确定性测试和 AGENT 唯一 `quality:check`；不得把“每次修复后重新真实 Chrome 采集”设为常规门禁。若业务任务本身要求真实 GPT 页面执行，可以运行目标 Child；只有该执行报错并满足 `PAGE_EVIDENCE_CONFLICT_CONFIRMED` 的三方证据条件时，才转入重采集。

## 更新原则

- 当前报告只有一份；更新时原子替换，不在仓库里另建第二资料库或兼容轨道。
- 历史 schema 不冒充当前格式；但同一当前 schema 下，代码版本或投影版本变化绝不能被伪装成页面快照失效，更不能借升级 `schemaVersion` 触发重采集。
- 合同、矩阵、实现语义、Product 消费者或 Blueprint 改变时，`admit` 对受影响 Child 返回 `REPORT_PROJECTION_STALE`，随后只允许离线 `refresh`。刷新后若稳定快照覆盖需求即可继续消费；否则返回 `PAGE_EVIDENCE_GAP`。
- provider build marker 只是一条风险信号，不是页面已变的证明，也不是重采集触发器。
- 只有 `PAGE_EVIDENCE_CONFLICT_CONFIRMED` 或 `HUMAN_REQUESTED_RECAPTURE` 可以刷新页面快照；前者只刷新确认冲突的场景，后者按用户明确范围执行。
- Skill、矩阵或报告不得被生产代码导入，不得向 Browser 公共调用传入 selector、JS 或坐标。
- 任何不确定页面事实都应变成明确缺口，不能变成臆测 selector。

## Skill 自验

每次修改本 Skill、矩阵或校验器后，必须运行：

```bash
node /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/report-tool.acceptance.mjs
node /Users/nexgen/.codex/skills/gpt-page-operation-evidence/scripts/pipeline.acceptance.mjs
```

它必须证明完整基线可以准入，并证明复制 live 状态、`unchecked`/`checked` 矛盾、遗漏需求绑定、用派生数据替代真实 terminal 和伪造候选绑定都会失败。
