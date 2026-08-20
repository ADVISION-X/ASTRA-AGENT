# GrassEye 精确标签页浏览器控制建设完成度审计

版本：2026-08-14
审计性质：建设完成度审计，非 CI-FULL
当前结论：`78/100`
CI-FULL 准入：`BLOCKED_BELOW_95`
项目终态：`NOT_COMPLETE`

## 1. 一句话结论

现在不能单独启动 CI-FULL。精确 Tab 内核和 6 个现役插件的干预主链已经大体建成，但方案真相、generated truth、transport 断连身份失效和全量类型合同仍未闭合。这些是建设本身没完成，不是“最后 CI 才处理的普通报错”。

## 2. 本轮边界

- 本轮只做完成度取证和打分。
- 没有运行 `ci:full`，没有调用 CI-FULL Skill，没有修复 CI 结果。
- 没有执行 Chrome 扩展安装、卸载、真实账号流程或发布。
- 用户删除的 6 个产品栏目全部按退役处理，不恢复。
- `video-download` capability 继续作为通用平台视频下载能力保留。

## 3. 完成度评分

| 建设区 | 权重 | 得分 | 审计结论 |
| --- | ---: | ---: | --- |
| Active law、决策记录和施工图 | 15 | 14 | exact target、provider takeover gate、PhysicalFocusLease、本地 xuanxue 和 6 owner 分母已写入权威文件 |
| 项目主方案和 ExecutionManifest | 10 | 2 | 仍保留 WO-012/013/014、23/371/50 旧计数和旧 `D_PASS`，与当前退役分母矛盾 |
| 精确 Tab、协议、Native transport 和焦点租约 | 25 | 21 | opaque refs、origin/document 校验、sequence/nonce、OUTCOME_UNKNOWN、release_target 和连续焦点检查已建；但 transport 断连没有连动使 Controller registry 中所有旧 refs 立即失效 |
| 生产消费者迁移和旧链物理归零 | 15 | 13 | active-tab、9222、first-page 和页面 AppleScript/JXA 主链已删；仅保留获准 native picker；AI provider 仍有 Apple Events JavaScript 旧错误别名和启用指引 |
| 6 个现役插件的 pause/cancel/takeover/resume | 20 | 18 | 6 组 owner state、revision CAS、status/read、显式 route/handle/client、provider target release/resume 已接线；还未得到同候选的确定性执行回执 |
| 质检系统施工（不含 CI 执行） | 10 | 6 | 专项 acceptance 和 local-browser-session owner 已建；但 generated truth 仍指向已删域，且 7 个文件共 17 个 TypeScript 错误 |
| 扩展/Native host 构建与生命周期 | 5 | 4 | install/verify/uninstall、稳定 extension ID、allowed origin、protocol 回读已建；dist 晚于源码一次改动，必须重建 |
| **合计** | **100** | **78** | **低于 95，禁止进入 CI-FULL** |

## 4. 已建成的主体

1. `BrowserTargetRef` 和 `BrowserDocumentRef` 已经是不透明品牌类型，raw Chrome ID 不在公共合同中流通。
2. Controller 可以按 owner 建立精确 target session；同一 raw tab 不能被两个 attached owner 同时占有。
3. MV3 扩展通过 `chrome.debugger` 执行后台 evaluate、click、scroll、text、screenshot 和 DOM file input；新建 tab 为 `active:false`。
4. Native Messaging 四跳链已包含 protocolVersion、nonce、sequence、commandId、deadline、message size 和单连接门。
5. 非幂等动作断连、超时或事后身份不确定会进入 `OUTCOME_UNKNOWN`，不自动重放。
6. DOM snapshot/ref 会携带 target/document；click、fill、upload、wait 会在动作前拒绝外来 target 和 stale document。
7. Take Over 已实现 `release_target`：只解除 debugger，不关闭用户 tab；Resume 后重新 acquire 并签发新 refs。
8. AI Input Gateway 已建立 owner-key gate；任一 takeover owner 未 Resume 时，新 provider 任务和 title housekeeping 都不得重新占用 provider tab。
9. amazon-invoice-upload、amazon-product-mining、xuanxue-ai-production 均已有显式干预入口和状态读取链。
10. 退役产品已从生产 App、Local Runtime、Mediator 和 plugin 主链移除；现役 `plugin-status.json` 只剩 4 个 plugin，其中 3 个需干预，media-processing-artifact 不需干预。

## 5. 阻断 95% 的硬缺口

### P0-1 主方案仍是旧分母

`docs/项目方案/GrassEye 精确标签页浏览器控制与 Chrome 扩展驱动重构项目实现方案.md` 的 ExecutionManifest 仍有 21 张工作单、338 项操作、21 个 Action 和 46 条验收；其中 WO-012/013/014 仍要建设已删除的三个 Amazon 产品。文档顶部又声称 23/371/50 和 `D_PASS`，同一文件已经出现多套真相。

完成要求：物理重建该 Manifest 和渲染施工区，删除退役 WO/ACT/ACC/操作/依赖/真实 Chrome 场景，重算唯一分母，不得用“备注覆盖旧表”。

### P0-2 Generated audit truth 仍指向已删法案和 inspector

`law-registry.generated.json`、`audit-plan.generated.json` 和 `enforcement-matrix.generated.json` 仍登记 amazon-product-sync、amazon-product-fee-sync 和 amazon-listing-edit-read-sync，但它们的 active law、manifest 和 inspector 已被用户物理删除。

完成要求：先完成法案/index/owner 源真相收口，再只通过现役 builder 重生 generated artifacts；不得手改 generated JSON。

### P0-3 Native transport 断连没有使旧 refs 立即失效

`browser-command-runtime.ts` 只在 Controller `close()` 时调用 `registry.invalidateAll()`。`browser-native-transport-server.ts` 的 socket `close` 只会清理 pending command 和连接状态，没有通知 runtime 把已签发 target/document refs 作废。这与法案“transport restart/detach 后旧 refs 永久失效”冲突。

完成要求：transport 连接世代变化时由 Browser owner 统一 invalidate registry 和 session target；恢复后只能从 owner checkpoint 重新 acquire。

### P0-4 全量 TypeScript 合同未闭合

`npx tsc --noEmit --pretty false` 返回 17 个错误，分布在 7 个文件：

- amazon invoice smoke 仍把普通 string 当作 branded target/document ref：4 个。
- DOM exact-target acceptance 和两个 DOM fixture 仍使用普通 string：6 个。
- local-browser exact-target acceptance 调用签名过期：1 个。
- local-app-shell inspector 引用已删 video download 产品 client/route 变量：5 个。
- xuanxue inspector 引用未定义 `sourceValues`：1 个。

这里不要先跑 CI；应先把质检系统和合同建到能编译。

## 6. P1 收口项

1. 重建 `src/lib/browser/chrome-extension/dist/**`。源 `service-worker.ts` 的修改时间晚于 dist 约 33 秒，当前不能声称 source/dist 同候选。
2. 删除 AI provider 中“Allow JavaScript from Apple Events”和 AppleScript/JXA 旧错误别名。新主链已改用 debugger，不应再指导用户开启旧页面控制权限。
3. 确认 amazon-product-mining 的 `taken_over` 不被终态结果逻辑阻断同任务 Resume，并用 owner 验收回执证明无重放。
4. 重生后复核全仓仅保留 `current-chrome-native-multi-file-picker.ts` 这一条获准 OS 物理动作链，不得恢复页面 AppleScript/JXA、active-tab、9222 或 first-page。

## 7. 进入 CI-FULL 前的唯一施工顺序

1. 重建项目主方案与 ExecutionManifest，得到现役唯一分母。
2. 补齐 transport disconnect/detach 的 target/document 世代失效。
3. 清理 AI provider 旧 Apple Events 页面控制别名，重建 MV3 dist。
4. 修完 17 个类型合同错误，但不运行 CI-FULL。
5. 收口已删 product 的 index/law/owner/acceptance 源真相，仅通过 builder 重生 generated truth。
6. 执行新一轮建设完成度审计。只有审计分数 `>=95`，才可在另一轮启动 CI-FULL 模式。

## 8. 本轮证据

- `plugin-status.json` 现役 plugin 数：7；需干预 owner：6。
- 主方案 ExecutionManifest 当前可解析，但分母为 21 WO / 338 operations / 21 actions / 46 acceptances，仍含 WO-012/013/014。
- 旧页面控制扫描：生产代码仅命中获准 native picker，以及 AI provider 中应删的 Apple Events 旧错误别名。
- generated truth 扫描：仍命中 3 个已删 Amazon 域。
- `npx tsc --noEmit --pretty false`：FAIL，17 errors / 7 files。这是类型合同取证，不是 CI-FULL。
- `git diff --check`：PASS。
- Chrome 安装、真实 Chrome、工作日、commit、push、deploy、release：本轮均未执行。

## 9. 准入裁决

`CI_FULL_ADMISSION = DENIED`

原因不是“CI 可能报错”，而是建设完成度只有 78%。必须先按第 7 节完成施工，然后重新审计。
