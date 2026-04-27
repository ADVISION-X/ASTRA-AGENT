# GrassEye 第一阶段建设方案：法案系统完成态与验收标准

版本：V1.0  
阶段性质：方案性文件 / 阶段完成定义  
适用项目：GrassEye / 草眼 Agent / 种草产品挖掘系统  
当前阶段：Phase One — Law Foundation Only

---

## 1. 第一阶段总定义

GrassEye 第一阶段不是业务实现阶段。

GrassEye 第一阶段的唯一目标是：

> **完成 GrassEye 法案系统的第一版建设，使项目具备清晰、单一、可审计、可迭代的治理根基。**

第一阶段完成后，系统不要求已经具备浏览器自动化、图片识别、OCR、数据存储、UI 页面或执法脚本能力。

第一阶段完成后，系统必须具备以下能力：

1. 知道 GrassEye 是什么。
2. 知道 GrassEye 第一阶段只做什么。
3. 知道哪些方向禁止进入。
4. 知道每个能力域归谁管。
5. 知道后续代码应该落在哪里。
6. 知道后续执法脚本应该按什么 owner 拆分。
7. 知道 AI、平台动作、评论、数据、人工控制、安全隐私之间的边界。
8. 知道下一阶段不能偏航。

---

## 2. 第一阶段核心目标

### 2.1 核心目标一句话

**把 GrassEye 的治理主权先立住，确保后续开发不总仓化、不越权、不滥用平台、不把 AI 判断当事实、不把产品信号误当最终商业决策。**

### 2.2 具体目标

| 序号 | 目标 | 完成后应达到的结果 |
|---|---|---|
| 1 | 建立 Kernel | 系统身份、权威链、主链、红线、禁止方向清楚 |
| 2 | 建立 Index | 能够按路径和任务关键词路由到最窄 module |
| 3 | 建立能力域法案 | 每个核心能力有且只有一个主裁法案 |
| 4 | 建立第一阶段边界 | 明确第一阶段只做法案系统，不做业务实现 |
| 5 | 建立平台安全边界 | 明确禁止账号矩阵、刷量、绕过风控、私信采集等滥用方向 |
| 6 | 建立本地优先边界 | 截图、凭据、评论证据、数据记录默认本地优先、最小保存 |
| 7 | 建立 AI 判断边界 | AI 输出只能作为结构化建议，不能作为事实真相 |
| 8 | 建立产品信号边界 | Product Signal 只是候选机会，不是最终选品结论 |
| 9 | 建立人工控制边界 | 高风险动作、低置信度判断、最终商业决策必须人工复核 |
| 10 | 建立后续执法准备 | 后续可以按一个能力域一个 owner 脚本推进 |

---

## 3. 第一阶段最终完成态

第一阶段完成后，项目应存在以下法案结构：

```txt
.github/instructions/cursor-rules/
├── GRASSEYE-KERNEL.instructions.md
├── grasseye-index.instructions.md
└── modules/
    ├── module-agent-runtime.instructions.md
    ├── module-vision-boundary.instructions.md
    ├── module-platform-action.instructions.md
    ├── module-comment-intelligence.instructions.md
    ├── module-product-signal.instructions.md
    ├── module-local-data.instructions.md
    ├── module-operator-control.instructions.md
    ├── module-security-privacy.instructions.md
    ├── module-code-topology.instructions.md
    ├── module-type-safety.instructions.md
    └── module-audit-system.instructions.md
```

---

## 4. 第一阶段法案文件职责表

| 文件 | capabilityDomain | 第一阶段职责 | 不承担内容 |
|---|---|---|---|
| `GRASSEYE-KERNEL.instructions.md` | kernel | 定义系统身份、权威链、主链、红线、禁止方向 | 不写模块细节、不写施工步骤 |
| `grasseye-index.instructions.md` | routing | 路由到最窄法案 owner | 不定义业务规则、不重复模块法条 |
| `module-agent-runtime.instructions.md` | agent-runtime | 管 Agent 单轮 observe → classify → act → record 闭环 | 不管视觉模型、OCR、评分、存储 schema |
| `module-vision-boundary.instructions.md` | vision-boundary | 管截图输入、本地视觉 AI、结构化输出、置信度边界 | 不管浏览器点击、不管产品评分 |
| `module-platform-action.instructions.md` | platform-action | 管允许的平台动作与反滥用边界 | 不管 AI 如何判断内容 |
| `module-comment-intelligence.instructions.md` | comment-intelligence | 管评论截图、OCR、评论信号、证据绑定 | 不做个人画像、不做最终商业决策 |
| `module-product-signal.instructions.md` | product-signal | 管产品机会信号、初步评分、风险与证据绑定 | 不做采购、上架、广告决策 |
| `module-local-data.instructions.md` | local-data | 管本地数据、最小保存、追溯、去重、删除 | 不管平台动作、不管商业批准 |
| `module-operator-control.instructions.md` | operator-control | 管人工暂停、停止、复核、最终控制权 | 不管截图、OCR、技术实现 |
| `module-security-privacy.instructions.md` | security-privacy | 管凭据、cookie、session、敏感截图、隐私红线 | 不管产品机会好坏 |
| `module-code-topology.instructions.md` | code-topology | 管后续代码路径归属与目录边界 | 不管运行策略、不管评分规则 |
| `module-type-safety.instructions.md` | type-safety | 管 strict、unknown、schema validation、禁止 any | 不管业务判断 |
| `module-audit-system.instructions.md` | audit-system | 管 law home、owner、报告、未来 inspector 边界 | 不管业务逻辑、不写假自动执法 |

---

## 5. 第一阶段必须完成的事项

### 5.1 法案文件必须完成

- [ ] Kernel 已存在。
- [ ] Index 已存在。
- [ ] 11 个 module 法案已存在。
- [ ] 所有文件命名稳定。
- [ ] 所有文件路径稳定。
- [ ] 所有 module 都有唯一 capabilityDomain。
- [ ] 所有 module 都声明 Scope / Boundary / Excludes / Authority。
- [ ] 所有 Law ID 使用 `GRASSEYE-` 前缀。
- [ ] 所有法条均为 phase-one active。
- [ ] 所有 module 没有写成总仓。
- [ ] 所有 module 没有越权到其他能力域。

### 5.2 Kernel 必须完成

- [ ] 系统身份清楚。
- [ ] 当前阶段清楚。
- [ ] 权威链清楚。
- [ ] 第一阶段唯一主链清楚。
- [ ] 全局红线清楚。
- [ ] Canonical Paths 清楚。
- [ ] Current Execution Window 清楚。
- [ ] Forbidden Directions 清楚。
- [ ] Fingerprint Index 清楚。

### 5.3 Index 必须完成

- [ ] Kernel 先加载。
- [ ] Index 只负责 routing。
- [ ] 每个 module 路由触发条件清楚。
- [ ] 不使用过宽路径复活未来能力。
- [ ] 不把业务规则写进 Index。
- [ ] 不重复 Kernel 文本。

### 5.4 Module 必须完成

- [ ] Agent Runtime 管单轮运行闭环。
- [ ] Vision Boundary 管截图到结构化视觉结果。
- [ ] Platform Action 管有限平台动作和反滥用边界。
- [ ] Comment Intelligence 管评论 OCR 与需求信号。
- [ ] Product Signal 管证据化产品机会候选。
- [ ] Local Data 管本地最小数据与可追溯。
- [ ] Operator Control 管人工最终控制权。
- [ ] Security Privacy 管凭据、隐私、平台安全红线。
- [ ] Code Topology 管后续代码路径归属。
- [ ] Type Safety 管类型与 schema 验证红线。
- [ ] Audit System 管未来执法 owner 与报告闭环。

---

## 6. 第一阶段禁止完成的事项

第一阶段严禁把以下内容纳入完成目标：

| 禁止事项 | 原因 |
|---|---|
| 浏览器自动化代码 | 第一阶段只立法，不写执行器 |
| 本地 AI 调用代码 | 第一阶段只定义视觉边界，不实现模型调用 |
| OCR 代码 | 第一阶段只定义评论智能边界 |
| 数据库 schema | 第一阶段只定义 local-data 原则 |
| UI 页面 | 第一阶段不做 operator console |
| 执法脚本 | 第一阶段只为后续 owner 执法做边界准备 |
| generated artifacts | 第一阶段不生成机器产物 |
| 平台账号管理系统 | 超出研究型 Agent 范围 |
| 账号池 / 代理池 / 指纹伪装 | 明确违反平台安全边界 |
| 自动评论 / 私信 / 关注 | 明确属于平台滥用风险 |
| 采购 / 上架 / 广告决策系统 | Product Signal 只是候选机会，不是商业决策 |

---

## 7. 第一阶段验收标准

### 7.1 总体验收标准

第一阶段只有在以下条件全部满足时，才算完成：

1. 法案文件结构完整。
2. Kernel、Index、11 个 module 全部存在。
3. 每个 module 只管一个能力域。
4. 所有 module 之间没有主权重叠。
5. 所有红线方向已经写入 Kernel 或对应 module。
6. 平台滥用风险被明确禁止。
7. AI 幻觉风险被明确限制。
8. 本地数据和隐私边界被明确限制。
9. 人工最终控制权被明确写入。
10. 后续代码落位路径被明确写入。
11. 后续执法 owner 边界被明确写入。
12. 没有创建任何业务代码、执法脚本、数据库、UI 或自动化程序。

### 7.2 单一性验收

| 检查项 | 标准 |
|---|---|
| 一个文件是否只做一件事 | 是 |
| 一个 module 是否只管一个 capabilityDomain | 是 |
| Kernel 是否没有写模块细节 | 是 |
| Index 是否只做 routing | 是 |
| Product Signal 是否没有变成采购系统 | 是 |
| Platform Action 是否没有变成刷量工具 | 是 |
| Comment Intelligence 是否没有变成用户画像系统 | 是 |

### 7.3 直接性验收

| 检查项 | 标准 |
|---|---|
| 第一阶段主链是否唯一 | 是 |
| 是否存在第二执行链 | 否 |
| 是否存在平行 owner | 否 |
| 是否存在未来能力提前激活 | 否 |
| 是否存在复杂桥接结构 | 否 |

### 7.4 真实性验收

| 检查项 | 标准 |
|---|---|
| 法案是否对应第一阶段真实需要 | 是 |
| enforcementMode 是否没有假装自动执法 | 是，第一阶段允许 manual-first |
| evidenceMode 是否没有假装已有 AST 脚本 | 是 |
| 是否禁止假 PASS | 是 |
| 是否禁止 AI 判断当事实 | 是 |

### 7.5 可删除性验收

| 检查项 | 标准 |
|---|---|
| 是否没有无主文件 | 是 |
| 是否没有重复法案 | 是 |
| 是否没有旧壳历史能力 | 是 |
| 是否没有未来能力目录 | 是 |
| 删除某个 module 是否会暴露明确缺口 | 是，说明每个 module 都有真实职责 |
| 是否存在删掉更清楚的文件 | 否 |

---

## 8. 第一阶段完成报告格式

Codex 或后续审计者完成第一阶段时，必须输出以下报告：

```md
# GrassEye 第一阶段完成报告

## 1. 本轮目标

## 2. 新增文件清单

## 3. 修改文件清单

## 4. 删除文件清单

## 5. 法案文件完整性检查

## 6. Kernel 审计结论

## 7. Index 审计结论

## 8. Module 审计结论

| 文件 | capabilityDomain | 是否单一 | 是否越权 | 是否通过 |
|---|---|---|---|---|

## 9. 大道至简验收

- 单一：
- 直接：
- 真实：
- 可删除：

## 10. 禁止方向检查

## 11. 未完成项

## 12. 是否达到第一阶段验收标准

## 13. 下一阶段建议
```

---

## 9. 第一阶段完成后的允许动作

第一阶段完成后，只允许进入以下两类后续工作：

### 9.1 第二阶段 A：法案修订轮

适用情况：

- 发现 module 边界重叠。
- 发现某些法条太散文化。
- 发现某些禁止方向不够硬。
- 发现 Index 路由过宽。
- 发现 Kernel 有总仓化倾向。

目标：

> 修正法案，不写业务代码。

### 9.2 第二阶段 B：执法系统设计轮

适用情况：

- 第一阶段法案已人工确认。
- 所有能力域 owner 已稳定。
- 需要开始设计 owner inspector。

目标：

> 按一个能力域一个 owner 脚本原则，设计最小执法系统。

第二阶段 B 仍然不应直接进入完整业务实现。

---

## 10. 第一阶段最终 Definition of Done

GrassEye 第一阶段完成的最终定义：

> **GrassEye 已拥有一套短、硬、单一、边界清楚、禁止方向明确、后续可执法的第一版法案系统。**

更具体地说：

- Kernel 能压住系统不偏航。
- Index 能路由到正确 owner。
- Module 能分别守住 Agent、Vision、Platform Action、Comment、Product Signal、Local Data、Operator、Security、Topology、Type、Audit 的边界。
- 所有危险方向被挡在第一阶段外。
- 所有未来能力没有被提前激活。
- 所有 AI 输出都被限制为证据化、结构化、可复核。
- 所有产品机会都停留在候选池，不自动升级为商业决策。
- 后续 Codex 可以按照法案继续推进，而不是凭感觉扩展系统。

---

## 11. 一句话总纲

**GrassEye 第一阶段，只完成法案系统，不完成业务系统。**

**完成标准不是文件数量，而是治理边界真正立住。**
