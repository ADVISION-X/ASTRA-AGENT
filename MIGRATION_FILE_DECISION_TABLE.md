# Migration File Decision Table

Turn: 2026-05-21  
Rule: every touched existing file in this migration is classified as `DELETE` or `MODIFY`.

| File | Action | Reason | New Owner |
|---|---|---|---|
| package.json | MODIFY | Reduce scripts to build, typecheck, startup, Amazon smoke, and CI. | startup-and-ci |
| src/app/** | MODIFY | Collapse the app surface to the minimal local Amazon workbench. | app-server |
| src/lib/local-runtime/** | MODIFY | Keep only local assembly, status, settings, and workbench handle needed by the Amazon path. | local-runtime-minimal-workbench |
| src/lib/browser/** | MODIFY | Keep local Chrome session, open, wait, screenshot, file-input, and DOM support foundations. | browser-session |
| src/lib/runtime-logs/** | MODIFY | Keep minimal structured runtime logs for FLOW / DEBUG / TRACE. | runtime-log-spine |
| src/types/structured-log.ts | MODIFY | Remove retired owner vocabulary and keep the reduced runtime/action schema. | runtime-log-spine |
| src/plugins/amazon-invoice-upload/** | MODIFY | Make Amazon invoice upload the canonical job-flow script and task service. | amazon-invoice-upload |
| src/plugins/local-workbench-plugin-tasks.ts | MODIFY | Export Amazon task surfaces only. | amazon-invoice-upload |
| src/plugins/product-video-dom-runtime/** | DELETE | Product-video runtime is outside the Amazon-first cut. | none |
| src/capabilities/dom-automation/** | MODIFY | Keep DOM automation as the primary non-business action group. | dom-automation |
| src/capabilities/ai-input-gateway/** | MODIFY | Restrict AI to bounded choice-judge transport and schema validation. | ai-choice-judge-gateway |
| src/capabilities/forensics-persistence/** | MODIFY | Reduce forensics to a minimal evidence store. | evidence-store |
| src/capabilities/ai/** | DELETE | Universal AI owner is retired. | none |
| src/capabilities/nerve-bus/** | DELETE | Central transport bus is retired. | none |
| src/capabilities/orchestration/** | DELETE | Universal mission loop is retired. | none |
| src/capabilities/geometry-guard/** | DELETE | Coordinate governance is not part of the DOM-first Amazon path. | none |
| src/capabilities/mouse-click/** | DELETE | Standalone mouse click owner is retired. | none |
| src/capabilities/mouse-scroll/** | DELETE | Standalone mouse scroll owner is retired. | none |
| src/capabilities/text-input/** | DELETE | Standalone text-input owner is retired. | none |
| src/capabilities/open/** | DELETE | Open belongs to browser support, not a standalone owner. | none |
| src/capabilities/screenshot/** | DELETE | Screenshot evidence is no longer a standalone owner surface. | none |
| src/capabilities/video-download/** | DELETE | Video download is outside the Amazon-first cut. | none |
| src/visual-mission/** | DELETE | Pure visual runtime is retired. | none |
| scripts/startup/** | MODIFY | Keep one startup path that boots the minimal workbench only. | startup-entrypoint |
| scripts/audit/ci-full.ts | MODIFY | Replace old owner-universe CI with typecheck, architecture check, and Amazon smoke. | simple-ci |
| scripts/acceptance/amazon-invoice-upload-smoke.ts | MODIFY | Keep the Amazon upload smoke as the main acceptance gate. | acceptance |
| scripts/acceptance/product-video-dom-smoke.ts | DELETE | Product-video acceptance is retired. | none |
| scripts/acceptance/product-video-dom-runtime-smoke.ts | DELETE | Product-video acceptance is retired. | none |
| scripts/acceptance/product-video-dom-smoke-fixture.ts | DELETE | Product-video acceptance fixture is retired. | none |
| scripts/acceptance/product-video-dom-smoke-judge.ts | DELETE | Product-video acceptance judge is retired. | none |
| scripts/acceptance/product-video-dom-smoke-support.ts | DELETE | Product-video acceptance support is retired. | none |
| scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts | DELETE | Web-chat fixture smoke is outside the Amazon-first cut. | none |
| docs/法案辅助文件/GrassEye 法案冻结基线.md | MODIFY | Freeze the new Amazon-first baseline and retire the old universe. | documentation-active-baseline |
| docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md | MODIFY | Reframe the architecture as job-flow script -> ability groups -> evidence/logs. | documentation-active-baseline |
| docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md | MODIFY | Restrict AI to bounded choice-judge transport. | documentation-ai-choice-judge |
| docs/法案辅助文件/GrassEye_DOM自动化能立组施工图_V1.md | MODIFY | Keep DOM automation as the main action ability group. | documentation-dom-automation |
| docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md | MODIFY | Reduce the doc to simple evidence-store ownership. | documentation-evidence-store |
| docs/法案辅助文件/GrassEye Runtime Log Spine 运行日志脊柱施工图.md | MODIFY | Rewrite runtime logging around the reduced FLOW / DEBUG / TRACE model. | documentation-runtime-log-spine |
| docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md | MODIFY | Keep one startup entry and terminal log contract. | documentation-startup |
| docs/法案辅助文件/GrassEye 执法系统施工图.md | MODIFY | Rewrite enforcement around the reduced CI and architecture guard. | documentation-simple-ci |
| docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md | MODIFY | Align storage documentation with current task.json and forensics NDJSON layout. | documentation-local-storage |
| docs/法案辅助文件/GrassEye 本地应用形态与运行壳施工图.md | MODIFY | Rewrite the app shell doc around the local HTTP workbench. | documentation-local-app-shell |
| docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md | MODIFY | Keep the real Chrome session and login reuse doc as browser infrastructure only. | documentation-browser-session |
| docs/法案辅助文件/GrassEye AI 大脑能力组施工图.md | DELETE | AI brain ownership is retired. | none |
| docs/法案辅助文件/GrassEye Child Capability Strength 子能力强度施工图.md | DELETE | Old sub-capability strength doctrine is not part of the reduced architecture. | none |
| docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md | DELETE | Commander Console is not an active product surface in the Amazon-first cut. | none |
| docs/法案辅助文件/GrassEye DOM种草视频模式施工图.md | DELETE | Product-video DOM mode is retired. | none |
| docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md | DELETE | Geometry Guard is retired with the coordinate-driven path. | none |
| docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md | DELETE | Standalone mouse-click ownership is retired. | none |
| docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md | DELETE | Standalone mouse-scroll ownership is retired. | none |
| docs/法案辅助文件/GrassEye Muscle Memory Catalog 肌肉记忆目录施工图.md | DELETE | Muscle-memory catalog is not an active owner in the reduced architecture. | none |
| docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md | DELETE | Nerve Bus is retired. | none |
| docs/法案辅助文件/GrassEye Open 能力组施工图.md | DELETE | Standalone open owner is retired. | none |
| docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md | DELETE | Universal orchestration is retired. | none |
| docs/法案辅助文件/GrassEye PlatformRegistry 平台资料施工图.md | DELETE | Platform registry is not an active owner. | none |
| docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md | DELETE | Standalone screenshot owner is retired. | none |
| docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md | DELETE | Standalone text-input owner is retired. | none |
| docs/法案辅助文件/GrassEye Video Download 视频下载能力组施工图.md | DELETE | Video download is outside the Amazon-first cut. | none |
| docs/法案辅助文件/GrassEye 本地化施工图.md | DELETE | Duplicate local-form doc retired in favor of the rewritten app-shell blueprint. | none |
| docs/法案辅助文件/GrassEye 简单能力机器总纲施工图.md | DELETE | Old simple-machine universe is retired. | none |
| docs/法案辅助文件/GrassEye 纯视觉单轮闭环总纲施工图.md | DELETE | Pure visual single-round loop is retired. | none |
| docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md | DELETE | Duplicate legacy logging blueprint removed in favor of Runtime Log Spine. | none |
| docs/法案辅助文件/GrassEye-Agent运作流程导航.html | DELETE | Legacy HTML navigation describes the retired universe. | none |
| docs/法案辅助文件/GrassEye-法案系统HTML说明书.html | DELETE | Legacy HTML law book describes the retired universe. | none |