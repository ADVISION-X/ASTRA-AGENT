# GrassEye 第三阶段 TODO 计划

## 目标

建立 Vision-first Coordinate Mode 作为真实平台主模式，并以 audit + build + launch + manual live run 作为验收主链。

## 当前状态

- [x] P3-18 已新增 Visual-Only Runtime law、blueprint、type contract、verify 与 audit owner 接线。
- [x] P3-19 已禁止 DOM/BOM content reading 作为真实平台生产路径，并保留 browser infrastructure 边界。
- [x] P3-01 当前仓库无 tests 目录，package 也无 test 脚本，不再以 tests 作为验收主链。
- [x] P3-02 已强化 platform-action、vision-boundary、agent-runtime、code-topology、audit-system 与 index 路由。
- [x] P3-03 已建立 screen capture、OS input、visual target、geometry guard、coordinate action policy 骨架。
- [x] P3-04 已将 TikTok real-platform adapter 收束到视觉唯一主路径，不再保留 DOM / Playwright semantic fallback 作为生产验收路径。
- [x] P3-05 Workbench / snapshot 已展示 Real Platform Mode、viewport、geometry guard、calibration、失败原因、最新 screenshot/AI/action、no-candidate-reason。
- [x] P3-06 已扩充执法脚本，检查 coordinate mode、guard、fallback 与无 stealth/anti-detect 漂移。
- [x] P3-07 已增加非 tests 验证脚本并更新 package 命令：`verify:coordinate`、`verify:delivery`、`verify:phase3`。
- [x] P3-08 已完成真实平台本机闭环：page-ready 识别、geometry guard 校准、真实 screenshot/AI/action log 落盘、review gate 可见。
- [x] P3-09 第三阶段验收报告已刷新，并按最小可交付标准更新为 PASS。
- [x] P3-10 browse flow blueprint 已升级为单条视频生命周期状态机，并补齐原子动作表、like/save marker policy、comment sampling policy、round completion contract。
- [x] P3-11 已新增 `verify:browse-flow`，并将其接入 `verify:phase3`。
- [x] P3-12 已新增 Evidence Packet 取证施工图、module-evidence-packet 法案、packet type contract、actionPurpose 与 dataQualityFlags。
- [x] P3-13 已新增 `verify:evidence-packet`，并将其接入 `verify:phase3` 与 audit phase gate。
- [x] P3-14 已修正 Browse Ledger vs Evidence Packet 冲突：product_no 默认轻量流水，Evidence Packet 只面向产品相关或审计必要 round。
- [x] P3-15 已新增 Structured Logging law、施工图、type contract、audit owner 与 `verify:structured-logging`，并接入 `verify:phase3` 与 `ci:full`。
- [x] P3-16 已新增 Local Browser Session law、真实 Chrome 持久化 profile 施工图、type contract、audit owner 与 `verify:local-browser-session`，并接入 `verify:phase3` 与 `ci:full`。
- [x] P3-17 已新增 Visual Action Capability law、视觉目标施工图、visual-action type contract、audit owner 与 `verify:visual-action-capability`，并接入 `verify:phase3` 与 `ci:full`。
- [x] P3-18 已新增 Local Persistence Schema law、本地取证存储结构施工图、local-persistence type contract、audit owner 与 `verify:local-persistence-schema`，并接入 `verify:phase3` 与 `ci:full`。
- [x] P3-20 已新增 Multi Frame Evidence law、施工图升级、type contract、verify 与 audit owner 接线，并把 `verify:multi-frame-evidence` 接入 `verify:phase3` 与 `ci:full`。
- [x] P3-21 已把已删除浏览器降级路径固化为排他性禁入项：`verify:local-browser-session` 与 local-browser-session owner inspector 现已改为 AST 级排他检查，并通过一次故意生产回归注入验证可真实失败。
- [x] P3-22 已新增 Agent Mechanical Skills law、施工图、skill catalog、Active Skill Matrix、skillId 日志字段与 audit owner，并提供 `audit:agent-mechanical-skills` 单域执法入口。

## 本轮已验证

- [x] `npm run verify:coordinate`
- [x] `npm run verify:delivery`
- [x] `npm run verify:evidence-packet`
- [x] `npm run verify:browse-flow`
- [x] `npm run verify:local-browser-session`
- [x] `npm run verify:local-browser-session` 故意注入 `GRASSEYE_BROWSER_PROFILE_REF` 生产回归后失败，回滚后重新 PASS
- [x] `npm run verify:phase3`
- [x] `npm run grasseye:start -- --no-open`
- [x] `GRASSEYE_PLATFORM_TARGET=tiktok-web GRASSEYE_PORT=4273 npm run grasseye:start -- --no-open`

## 当前剩余项

- [ ] verify:visual-only-runtime、verify:multi-frame-evidence、audit、verify:phase3、ci:full 仍需在本轮变更后重新跑通并更新结果。
- [ ] runtime 仍待把 product presence 第一问从 single_frame_fallback 实际升级为真实 3s / 6s / 10s 多帧采样与 contact sheet 生成。
- [ ] comment extraction 仍需继续收敛到 comment screenshot + OCR/local AI 的真实 visual-only runtime 闭环。
- [ ] visual target detection 仍需从 heuristic viewport box 继续推进到更强的 model-backed visual target detection。
- [x] real-platform 页面识别不再卡在 `about:blank` / `platform page structure not recognized`。
- [x] geometry guard 已完成自动校准。
- [x] 历史登录墙场景仍可进入 `review_required`。
- [ ] 真实 TikTok 样本上的点击类动作分支仍待实测命中。
- [ ] 真实 comment evidence、comment signal 与 evidence-backed candidate 仍待在合适样本上命中。
- [ ] runtime 仍待真正写出 Browse Ledger entry、Browse Session Summary 与 Advanced AI export set，而不是仅完成类型与执法边界。
- [ ] runtime 仍待把每轮 packet finalization 真正接入浏览主循环持久化，而不只是类型与存储入口齐备。
- [ ] runtime 仍待真正写出 StructuredRuntimeEvent 与 StructuredActionLog，并把 live proof 序列接入真实浏览主循环持久化。
- [ ] evidence-store-service.ts 仍待真实实现 SQLite structured store 与 evidence file store 写入，而不是继续把 state.json 当长期真相。
- [ ] runtime 还需要逐个把 open_comments / click_not_interested / like_or_save / scroll_next / comment screenshot 接入生产级视觉动作能力，而不是只完成治理合同与 TikTok 最小接线。
- [ ] login state 检测当前仍以本地 URL / title 启发式为主，平台专属登录态判定仍待继续收紧。
- [ ] `maxRuntimeMinutes` 和更明确的 real-mode operator controls 仍待补齐。