# GrassEye 第二阶段验收报告

## 1. 结论

第二阶段目标已完成。

结论声明：GrassEye 第二阶段 TODO 100% 完成。

补充说明：本阶段曾出现两次人工验收驳回。第一次驳回原因不是后端链路未通，而是根页面 `/` 虽然返回了 HTML，但主体仍接近 raw JSON / state dump 体验，不符合 Local Operator Console 的人工可用性要求。第二次驳回原因是 demo/store 数据隔离不充分，Candidate Pool 出现了来自 `video_non_product_001` 语义污染的脏候选，且页面未明确标识当前是 fixture demo 还是 local store，也缺少 reset 能力。本轮已完成这两类问题修复。

当前系统能够在 Mac 本机以 localhost workbench 形态运行，通过本地 operator console、本地 agent service、单平台 fixture adapter、本地 AI gateway、本地 evidence store 与人工处置入口，跑通一个可暂停、可停止、可复核、可追溯、可删除的最小闭环。

---

## 2. 验证命令与结果

| 命令 | 结果 | 说明 |
|---|---|---|
| `npm run typecheck` | PASS | 严格 TypeScript 编译通过 |
| `npm test` | PASS | 19 个测试全部通过，覆盖 schema、gateway、store、adapter、runtime、startup、root page UI、API 边界、demo 隔离与 reset |
| `npm run verify:phase2` | PASS | typecheck + tests 组合验证通过 |
| `npm run ci:full` | PASS | typecheck + tests + audit 全链路验证通过 |
| `npm run build` | PASS | 生成 dist 构建产物 |
| `npm start` | PASS | 本地服务成功监听 `http://127.0.0.1:4173` |
| `npm run launch` | PASS | 通过受治理启动入口完成依赖检查、健康门、页面打开 |
| `curl http://127.0.0.1:4173/ \\| head -n 40` | PASS | 根页面返回 HTML workbench，而不是 JSON dump |
| `curl http://127.0.0.1:4173/api/runtime/health` | PASS | 返回 runtime health JSON |
| `curl http://127.0.0.1:4173/api/runtime/snapshot \\| head -n 20` | PASS | snapshot 保持在 `/api/**` JSON 边界内 |
| `npm run demo:phase2` | PASS | 单平台 fixture 闭环跑通，输出 1 条候选，`candidateCount = 1`，`sourceVideoId = video_product_002` |
| `npm run audit` | PASS | 13 个审计域全部 PASS，无 ENFORCEMENT GAP |

---

## 3. 验收矩阵

| 验收对象 | 结果 | 证据 |
|---|---|---|
| Local Workbench | PASS | `npm start` 与 `npm run launch` 均成功，根页面返回 HTML 工作台 |
| Single Platform Loop | PASS | `npm run demo:phase2` 完成单平台 fixture 闭环并产出候选 |
| Local AI | PASS | Local AI Gateway + Prompt Registry + schema validation 已实现，测试通过 |
| No Cloud Fallback | PASS | 源码搜索未发现 cloud/paid fallback 关键词；audit local-ai-runtime PASS |
| Evidence Store | PASS | 候选、截图、OCR、AI、动作日志可追溯；删除与导出已实现；测试通过 |
| Operator Review | PASS | 控制台支持 Start / Pause / Stop / Demo / candidate approve / reject / archive / note / delete |
| Demo / Store Isolation | PASS | 根页面默认运行在 `Fixture Demo` 模式，默认 demo store 为 `.grasseye-demo-data`，`Run Demo` 每次先 reset，再跑干净 fixture 闭环 |
| Reset Capability | PASS | 控制台已提供 `Reset Demo Data` 与 `Clear Local Store`，测试验证 reset 后候选池与证据链清空 |
| Platform Boundary | PASS | adapter 承接平台动作；audit platform-action PASS |
| Security Privacy | PASS | 绑定 127.0.0.1；根页面默认不展示绝对本机路径；无 cookie/session/token 导出；audit security-privacy PASS |
| Scope Control | PASS | 无 SaaS、无插件主壳、无远程浏览器、无多平台扩张、无桌面业务壳 |
| Type Safety | PASS | strict tsconfig、生效 schema、无显式 any；audit type-safety PASS |

---

## 3.1 UI 人工验收修复

| 项目 | 结果 | 说明 |
|---|---|---|
| `/` 是否 HTML | PASS | 返回完整 HTML workbench |
| 是否包含 Workbench 标题 | PASS | 页面包含 `GrassEye Local Workbench` |
| 是否包含 Operator Controls | PASS | 页面包含 Start / Pause / Stop / Run Demo / Reset Demo Data / Clear Local Store / Refresh / Export |
| 是否明确显示数据模式 | PASS | 页面明确显示 `Data Mode: Fixture Demo` |
| 是否明确显示平台边界 | PASS | 页面明确显示 `Platform: fixture-platform-web` 与 `Real Platform: Not connected` |
| 是否包含 Candidate Pool | PASS | 页面包含候选池区与空状态/候选卡片 |
| 是否避免 raw JSON dump | PASS | root page 不再渲染 raw snapshot JSON 主体 |
| 是否隐藏默认绝对路径 | PASS | root page runtime 与 evidence 视图已做 local-only 脱敏/折叠 |

---

## 3.2 数据干净性与 Demo 隔离补丁

| 项目 | 结果 | 说明 |
|---|---|---|
| non-product 视频是否进入候选池 | PASS | 运行时与控制台测试均验证 `video_non_product_001` 不会进入 candidates |
| demo 结果是否确定性 | PASS | `Run Demo` 与 `demo:phase2` 均稳定只产出 1 个产品候选 |
| Demo 数据是否与历史 store 隔离 | PASS | 本地服务默认使用 `.grasseye-demo-data` 作为 fixture demo store，不再直接复用旧 `.grasseye-data` |
| reset 后页面是否清空脏候选 | PASS | 测试验证 reset 后 root page 不再显示旧候选 |
| 数据模式是否可见 | PASS | 根页面显示 `Fixture Demo` / `fixture-platform-web` / `Not connected` |

---

## 4. 关键实现结果

| 模块 | 完成结果 |
|---|---|
| Local App Shell | 本地 HTTP server + operator console 已建立 |
| Agent Runtime | observe → classify → act → record 有界主循环完成 |
| Platform Adapter | 单平台 fixture adapter 完成 open / observe / capture / comments / continue |
| Browser Controller | open / scroll / click / screenshotRegion / wait / close 原子能力完成 |
| Local AI | vision / OCR cleanup / comment intent / product signal 四类任务走统一本地 gateway |
| Local Data | JSON state store + SVG artifacts + candidate export/delete 完成 |
| Operator Control | start / pause / stop / demo / disposition / delete 可见且可操作 |
| Audit Alignment | 相关 owner inspector 已对齐到真实实现路径 |

---

## 5. 修复记录

本轮收口期间修复了以下关键缺陷：

1. 修复了 server 模板字符串与入口文件损坏问题，恢复可启动的本地控制台。
2. 修复了 JSON state store 并发读写导致的半截 JSON 问题，改为串行化写入与原子替换。
3. 修复了生产启动脚本路径错误，确保 `npm start` 指向真实 dist 入口。
4. 修复了 server 入口在带空格仓库路径下的 `import.meta.url` 判断，确保构建产物可启动。
5. 修复了 vision classification 对 `no product` / `non-product` 的误判，并补充回归测试。
6. 修复了 demo 默认复用历史数据目录导致的脏验收结果，改为默认临时数据目录。
7. 修复了 audit 中 vision/comment/product/operator 四个域的 owner surface 漂移，审计结果已全 PASS。
8. 修复了根页面将 snapshot JSON 作为主体渲染的问题，重建为真正的 Local Operator Console。
9. 修复了根页面默认暴露本机绝对路径的问题，改为 local-only 脱敏与折叠展示。
10. 补充了 root HTML / API JSON 边界测试，以及 local-app-shell / operator-control 的最小真实审计检查。
11. 修复了本地服务默认复用历史 `.grasseye-data` 导致的 Candidate Pool 脏数据问题，默认切换到受控 `.grasseye-demo-data` fixture demo store。
12. 修复了 `Run Demo` 复用当前 store 的问题，改为每次先 reset 当前 demo store，再从干净 fixture 闭环执行。
13. 增加 `Reset Demo Data` 与 `Clear Local Store` 能力，reset 会同步清空 candidates、evidence、logs、taskRuns 与 agent task state。
14. 补充运行时与 root page 回归验证，确保 `video_non_product_001` 不会进入 candidate pool，且 demo 始终只导出 `video_product_002`。

---

## 6. 风险清零检查

| 检查项 | 结果 |
|---|---|
| TODO / FIXME / HACK / XXX 占位残留 | 已检查，无代码实现残留 |
| `any` / `as any` / hidden any | 已检查，无实现层显式逃逸 |
| Cloud AI fallback / paid AI SDK / API key | 已检查，无实现层命中 |
| Proxy pool / account pool / fingerprint spoofing / captcha bypass | 已检查，无实现层命中 |
| Electron / Tauri / SwiftUI 业务壳提前建设 | 已检查，无实现层命中 |

---

## 本地化验收

- English / 中文 手动切换：PASS
- UI 文案通过 localization dictionary：PASS
- API 数据不被翻译：PASS
- 云端翻译 API 未引入：PASS

## 7. 最终声明

第二阶段建设目标方案中的验收标准全部 PASS。

第二阶段 TODO 100% 完成。
