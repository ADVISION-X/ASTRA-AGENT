| File | Action | Reason | New Owner |
|---|---|---|---|
| package.json | MODIFY | Remove universal-agent and product-video scripts; keep minimal build, startup, Amazon smoke, and CI | startup-and-ci |
| src/lib/local-runtime/workbench.ts | MODIFY | Remove nerve-bus, orchestration, commander dashboard coupling, and product-video handles | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-assembly.ts | MODIFY | Assemble only browser, DOM, evidence, runtime logs, and optional AI choice judge | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-capability-support.ts | MODIFY | Remove deleted ability-group factories and keep only evidence, DOM, and optional AI choice judge support | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-browser-support.ts | MODIFY | Collapse open and screenshot owners into browser support helpers | local-runtime-browser-support |
| src/lib/local-runtime/workbench-facade.ts | MODIFY | Shrink public surface to Amazon upload and minimal runtime settings/status | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-handle.ts | MODIFY | Remove commander-console ownership from the public workbench handle | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-launch-contract.ts | MODIFY | Keep launch contract but point to the minimal workbench handle only | local-runtime-minimal-workbench |
| src/lib/local-runtime/workbench-nerve-bus-dispatcher.ts | DELETE | NerveBus is removed from the active architecture | none |
| src/plugins/local-workbench-plugin-tasks.ts | MODIFY | Export Amazon upload tasks only | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/** | MODIFY | Keep the mainline and make the flow script the canonical sample of the new architecture | amazon-invoice-upload |
| src/plugins/product-video-dom-runtime/** | DELETE | Product-video runtime is not part of the Amazon-first cut | none |
| src/capabilities/dom-automation/** | MODIFY | Keep DOM automation as the primary ability group and remove AI-plan or registry residue | dom-automation |
| src/capabilities/ai-input-gateway/** | MODIFY | Restrict the gateway to bounded choice-judge transport and schema validation | ai-choice-judge-gateway |
| src/capabilities/forensics-persistence/** | MODIFY | Reduce forensics to a minimal evidence store for traces, artifact refs, and failures | evidence-store |
| src/capabilities/ai/** | DELETE | Universal AI judge ownership is removed | none |
| src/capabilities/nerve-bus/** | DELETE | Central dispatcher is removed | none |
| src/capabilities/orchestration/** | DELETE | Universal mission loop is removed | none |
| src/capabilities/geometry-guard/** | DELETE | Coordinate governance is not part of the DOM-first Amazon path | none |
| src/capabilities/mouse-click/** | DELETE | DOM click replaces standalone mouse click ownership | none |
| src/capabilities/mouse-scroll/** | DELETE | Standalone mouse scroll ownership is removed | none |
| src/capabilities/text-input/** | DELETE | DOM fill replaces standalone text input ownership | none |
| src/capabilities/open/** | DELETE | URL opening belongs to browser support, not a standalone owner | none |
| src/capabilities/screenshot/** | DELETE | Screenshot evidence belongs to browser or evidence support, not a standalone owner | none |
| src/capabilities/video-download/** | DELETE | Video download is outside the Amazon-first cut | none |
| src/visual-mission/** | DELETE | Pure visual runtime is removed from the active architecture | none |
| src/lib/browser/** | MODIFY | Keep local browser session, open, wait, capture, and upload foundations | browser |
| src/app/server.ts | MODIFY | Boot only the minimal Amazon workbench server | app-server |
| src/app/create-workbench-server.ts | MODIFY | Remove product-video routes and commander-dashboard-only root rendering | app-server |
| src/app/product-video-dom-record-api-handlers.ts | DELETE | Product-video record API is removed with the runtime | none |
| src/app/product-video-plugin-api-handlers.ts | DELETE | Product-video plugin API is removed with the runtime | none |
| src/app/plugin-task-api-handlers.ts | MODIFY | Keep only Amazon upload plugin endpoints and minimal CORS handling | app-server |
| src/app/** | MODIFY | Trim the app shell to Amazon upload entry, task status, logs, and settings | app-server |
| scripts/audit/ci-full.ts | MODIFY | Replace owner-universe CI with typecheck, forbidden-import checks, and Amazon smoke | simple-ci |
| scripts/audit/domains/nerve-bus-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/orchestration-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/geometry-guard-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/mouse-click-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/mouse-scroll-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/text-input-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/screenshot-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/open-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/video-download-capability/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/pure-visual-round/** | DELETE | Retired owner audit domain | none |
| scripts/audit/domains/capability-group-governance/** | DELETE | Retired owner audit domain | none |
| scripts/acceptance/amazon-invoice-upload-smoke.ts | MODIFY | Keep the Amazon smoke as the main acceptance gate | acceptance |
| scripts/acceptance/amazon-invoice-agent-start-smoke.ts | DELETE | Extra Amazon start-only smoke is outside the minimal acceptance gate | none |
| scripts/acceptance/amazon-invoice-upload-complete-smoke.ts | DELETE | Extra Amazon complete-only smoke is outside the minimal acceptance gate | none |
| scripts/acceptance/product-video-dom-smoke.ts | DELETE | Product-video acceptance is retired | none |
| scripts/acceptance/product-video-dom-runtime-smoke.ts | DELETE | Product-video acceptance is retired | none |
| scripts/acceptance/product-video-dom-smoke-fixture.ts | DELETE | Product-video acceptance fixture is retired | none |
| scripts/acceptance/product-video-dom-smoke-judge.ts | DELETE | Product-video acceptance judge is retired | none |
| scripts/acceptance/product-video-dom-smoke-support.ts | DELETE | Product-video acceptance support is retired | none |
| scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts | DELETE | Web-chat fixture smoke is not part of the Amazon-first cut | none |
| scripts/acceptance/ai-input-gateway-smoke.ts | MODIFY | Keep only if needed for bounded choice-judge transport proof | ai-choice-judge-gateway |
| scripts/startup/** | MODIFY | Keep one startup path and wire the minimal workbench only | startup |
| .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md | MODIFY | Set the job-flow constitution as the only active architecture | governance |
| .github/instructions/cursor-rules/grasseye-index.instructions.md | MODIFY | Route governance only through Amazon, DOM, browser, AI choice judge, evidence, and runtime logs | governance |
| .github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md | MODIFY | Ban universal planner, NerveBus, orchestration loop, and workflow truth outside flow scripts | governance |
| .github/instructions/cursor-rules/modules/module-dom-automation.instructions.md | MODIFY | Make DOM automation the primary non-business action group | governance |
| .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md | MODIFY | Restrict AI to bounded choice judging only | governance |
| .github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md | MODIFY | Restrict the gateway to choice-package transport only | governance |
| .github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md | MODIFY | Convert forensics law to minimal evidence-store ownership | governance |
| .github/instructions/cursor-rules/modules/module-RuntimeLogSpine.instructions.md | MODIFY | Keep structured runtime logs while removing owner-matrix baggage | governance |
| .github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-open-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-video-download-capability.instructions.md | DELETE | Retired governance route | none |
| .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md | DELETE | Separate local-AI-runtime governance route is retired | none |# Migration File Decision Table

Every listed file is governed as DELETE or MODIFY for the 2026-05-21 GrassEye job-flow turn. Directory-wide DELETE rows mean the file is physically removed in this migration.

| File | Action | Reason | New Owner |
|---|---|---|---|
| .github/instructions/cursor-rules/.DS_Store | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/grasseye-index.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/.DS_Store | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-RuntimeLogSpine.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| .github/instructions/cursor-rules/modules/module-audit-system.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-code-purity.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-code-topology.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-dom-automation.instructions.md | MODIFY | DOM automation is the main action ability group. | dom-automation |
| .github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md | MODIFY | Reduced to simple evidence store. | evidence-store |
| .github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| .github/instructions/cursor-rules/modules/module-local-persistence-schema.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-open-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-security-privacy.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-structured-logging.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| .github/instructions/cursor-rules/modules/module-type-safety.instructions.md | MODIFY | New flow-script constitution and supporting law. | governance |
| .github/instructions/cursor-rules/modules/module-video-download-capability.instructions.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| docs/法案辅助文件/.DS_Store | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye AI 大脑能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Child Capability Strength 子能力强度施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye DOM种草视频模式施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Muscle Memory Catalog 肌肉记忆目录施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Open 能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye PlatformRegistry 平台资料施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Runtime Log Spine 运行日志脊柱施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye Video Download 视频下载能力组施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 执法系统施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 本地化施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 本地应用形态与运行壳施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 法案冻结基线.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 简单能力机器总纲施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 纯视觉单轮闭环总纲施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye-Agent运作流程导航.html | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye-法案系统HTML说明书.html | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| docs/法案辅助文件/GrassEye_DOM自动化能立组施工图_V1.md | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| package.json | MODIFY | Script set reduced to build/typecheck/start/Amazon smoke/CI. | package-scripts |
| scripts/acceptance/ai-input-gateway-smoke.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/amazon-invoice-agent-start-smoke.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| scripts/acceptance/amazon-invoice-upload-complete-smoke.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| scripts/acceptance/amazon-invoice-upload-smoke.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| scripts/acceptance/delivery-smoke-browser-proof.mjs | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/delivery-smoke-support.mjs | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/delivery-smoke.mjs | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/dom-automation-smoke.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/acceptance/dom-smoke-browser.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| scripts/acceptance/muscle-memory-manual-smoke.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/product-video-dom-runtime-smoke.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/product-video-dom-smoke-fixture.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/product-video-dom-smoke-judge.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/product-video-dom-smoke-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/acceptance/product-video-dom-smoke.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/.DS_Store | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/build-audit-artifacts.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/ci-full.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/anti-escape.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/ci-full-plan.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/ci-full-timeouts.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/filesystem.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/generated-artifact.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/generated-provenance.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/import-graph.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/law-registry.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/owner-manifests.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/path-roots.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/paths.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/result.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/schema.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/ts-morph.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/core/yaml.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/.DS_Store | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/ai-capability/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/ai-capability/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/ai-input-gateway/ai-input-gateway-ast-evidence.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| scripts/audit/domains/ai-input-gateway/inspector.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| scripts/audit/domains/ai-input-gateway/manifest.json | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| scripts/audit/domains/ai-input-gateway/run-inspector.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| scripts/audit/domains/audit-system/.DS_Store | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/anti-escape.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/ast-symbol-enforcement.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/ci-full-coverage.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/inspector-quality-gate.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/law-census.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/owner-inspector-matrix.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/components/owner-manifest-census.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/audit-system/run-inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/capability-group-governance/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/capability-group-governance/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/code-purity/config.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/forbidden-surfaces.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/rules-anti-escape.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/rules-boundary.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/rules-generated.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/rules-structure.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/run-inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/scope.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/code-purity/types.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/commander-console-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/commander-console-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/dom-automation/.DS_Store | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/README.md | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/collect-dom-automation-project.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/dom-automation-module-resolution.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/dom-automation-project-types.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/dom-automation-static-strings.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/dom-automation-validation-result.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/runtime-contract-support.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-audit-plan-coverage.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-catalog-registry.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-ci-entry.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-runtime-contracts-actions.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-runtime-contracts-basic.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-runtime-contracts-states.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-runtime-contracts.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/components/validate-structure.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-audit-plan.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-binary-constants.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-binary-outcome.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-binary-types.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-blueprint-checks.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-law-binary-checks.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-law-checks-001-005.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-law-checks-006-010.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-law-enforcement-matrix.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-law-enforcement-types.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-path-constants.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-policy-helpers.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-shape-helpers.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/dom-automation-source-helpers.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/inspector.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/manifest.json | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/dom-automation/run-inspector.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| scripts/audit/domains/forensics-persistence-capability/inspector.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| scripts/audit/domains/forensics-persistence-capability/manifest.json | MODIFY | Reduced to simple evidence store. | evidence-store |
| scripts/audit/domains/geometry-guard-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/geometry-guard-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/mouse-click-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/mouse-click-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/mouse-scroll-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/mouse-scroll-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/nerve-bus-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/nerve-bus-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/open-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/open-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/pure-visual-round/config.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/pure-visual-round/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/pure-visual-round/run-inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/quality-kernel/config.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/quality-kernel/file-counts.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/quality-kernel/forbidden-surfaces.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/quality-kernel/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/quality-kernel/run-inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/runtime-logging/config.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/run-inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-ai-checks.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-boundary-checks.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-emit.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-event-resolution.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-foundation-checks.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-result.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-source.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/runtime-logging/runtime-log-types.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/screenshot-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/screenshot-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/security-privacy/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/security-privacy/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/shared/manifest-owner-helper.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/shared/run-manifest-owner.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/text-input-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/text-input-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/type-safety/inspector.ts | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/type-safety/manifest.json | MODIFY | Simplified architecture check and CI runner. | simple-ci |
| scripts/audit/domains/video-download-capability/inspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/video-download-capability/manifest.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/domains/video-download-capability/video-download-ast-evidence.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/active-law-census.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/all-law-enforcement-matrix.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/audit-artifact-provenance.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/audit-system-summary.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/ci-full-summary.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/dom-automation-binary-result.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/owner-inspector-matrix.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/generated/quality-kernel-summary.generated.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-context.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-domain-state.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-generated-drift.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-law-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-matrix.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-result-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/all-law-enforcement-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/clause-parser.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/owner-verdicts.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/audit/law-enforcement/source-discovery.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| scripts/startup/.DS_Store | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/launch-grasseye.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/dependency-check.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/dependency-package-utils.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/dependency-state-analysis.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/health-check.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/open-commander-console.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/port-listener-ops.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/process-control.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/service-process.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-failure-bundle.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-failure-handler.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-log-helpers.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-main-support.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-registry-readiness-probe.ts | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/startup-registry-readiness.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/terminal-structured-log.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| scripts/startup/lib/terminal-structured-runtime-relay.mjs | MODIFY | Minimal local workbench bootstrap. | startup |
| src/app/app-settings-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/create-workbench-server.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/plugin-task-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/product-video-dom-record-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/product-video-plugin-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/runtime-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/runtime-api-response.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/runtime-read-model-api-handler.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/server.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/task-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/task-start-api-handler.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/user-requirement-history-api-handlers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/app/workbench-api-helpers.ts | MODIFY | Minimal Amazon workbench HTTP surface. | app-server |
| src/capabilities/.DS_Store | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/ai-input-gateway/ability-group.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/contract.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/contracts/ai-feed-input.contract.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/contracts/ai-feed-result.contract.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/index.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/manifest.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/providers/gemini-api.adapter.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/providers/web-chat-shared.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/ai-feed-output-parser.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/ai-feed-rate-guard.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/feed-gemini-api-once.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/feed-gemini-web-chat-once.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/feed-gpt-web-chat-once.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai-input-gateway/schema.ts | MODIFY | Limited to bounded AI choice judge transport. | ai-choice-judge |
| src/capabilities/ai/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/assets/grid-cell-zone-reference.zh.png | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/assets/grid-cell-zone-reference.zh.svg | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/children/visual-mission-judge-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/children/visual-mission-logs.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/children/visual-mission-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/children/visual-mission-retry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/prompt/prompt-contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/prompt/visual-mission-judge-prompt.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/runtime/json-extract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/runtime/model-call.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/runtime/result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/ai/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/commander-console/ability-group.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/context.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/emergency-stop/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/emergency-stop/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/envelope.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/failure.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/issue-human-command.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/issue-human-command/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/issue-human-command/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/mark-review-required.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/mark-review-required/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/mark-review-required/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/mission-control.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/pause-mission/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/pause-mission/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/resume-mission/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/resume-mission/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/show-mission-status.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/start-payload.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/stop-mission/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/children/stop-mission/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/contract.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/envelope.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/idempotency.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/index.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/registry.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/result.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-command-policy.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-runtime-proof-schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-schema-base.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-schema-foundation.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-transport-schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/commander-console/shared/commander-view-schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/capabilities/dom-automation/.DS_Store | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/contracts/dom-action-result.contract.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/contracts/dom-element-ref.contract.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/contracts/dom-review-required.contract.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/contracts/dom-snapshot.contract.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/index.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/manifest.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-action-result.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-click.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-evidence.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-fill.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-locator.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-snapshot.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-upload.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-verify.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/runtime/dom-wait.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/schema.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/tests/dom-locator.fixture.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/tests/dom-snapshot.fixture.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/dom-automation/tests/dom-upload.fixture.ts | MODIFY | DOM automation is the main action ability group. | dom-automation |
| src/capabilities/forensics-persistence/ability-group.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/children/append-artifact.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/children/append-record.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/children/proof-support.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/children/read-record-ref.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/contract.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/index.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/schema.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/storage-adapter.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/forensics-persistence/storage-port.ts | MODIFY | Reduced to simple evidence store. | evidence-store |
| src/capabilities/geometry-guard/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/children/validate-bbox-grid-region.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/children/validate-click-grid-cell.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/geometry-io-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/geometry-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/bounds.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/child-normalization.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/child-runtime.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/normalize.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/proof.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/runtime/result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/schema-constants.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/schema-input.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/schema-output.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/schema-primitives.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/geometry-guard/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/children/double-left-click-browser-viewport.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/children/left-click-browser-viewport-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/children/right-click-browser-viewport-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/ports/mouse-click-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/runtime/execute-click.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/runtime/idempotency.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/runtime/policy.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-click/shared/constants.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-browser-viewport/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-browser-viewport/implementation.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-browser-viewport/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-desktop-screen/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-desktop-screen/implementation.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-desktop-screen/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-region/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-region/implementation.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/children/scroll-region/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/ports/mouse-scroll-clock-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/ports/mouse-scroll-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/geometry-scroll-proof-gate.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-ability-group-factory.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-blocked-result-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-blocked-result-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-clock.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-dispatch-failure.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-context.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-reservation.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-stage-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-validator.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-executor.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-failure-seed.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-idempotency-registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-idempotency-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-input-gate.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-primitive-result-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-proof-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/mouse-scroll-runtime-context.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/pre-scroll-safety-gate.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-failure-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-frame.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-iteration-proof.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-port-call.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-runner-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-runner-result.types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-runner-state.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-runner-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-runner.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-single-iteration.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/primitive-scroll-success-builder.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/scroll-delta-resolver.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/runtime/scroll-policy-gate.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/mouse-scroll-failure.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/mouse-scroll-policy.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/mouse-scroll-proof.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/mouse-scroll-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/mouse-scroll-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/mouse-scroll/shared/scroll-magnitude.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/runtime/dispatch-ability-command.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/runtime/dispatch-human-command.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/runtime/envelope-builders.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/runtime/request-ai.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/runtime/timeout.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/nerve-bus/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/browser-open-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/open-target.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/open/url-policy.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/children-context.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/children.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-action.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-executor.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-forensics.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-geometry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-log.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-payload.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/dispatch-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/loop-guard.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-ai.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-artifacts.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-decision.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-evidence.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-open.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-round.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-runner.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-save.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-loop-screen.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/mission-state.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/runtime/product-video-dom-round.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/orchestration/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/adapters/browser-controller-capture-adapter.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/children/capture-browser-viewport.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/children/capture-grid-region.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/children/render-coordinate-grid.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/ports/artifact-storage-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/ports/browser-capture-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/runtime/artifact-write.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/runtime/grid-renderer.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/runtime/proof.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/runtime/structured-ref-store.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/schema-artifact.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/schema-capture.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/schema-grid.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/schema-ids.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/schema-render.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/screenshot/workbench-screenshot-ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/children/clear-focused-input-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/children/press-approved-key-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/children/type-approved-text-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/ports/text-input-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/runtime/execute-text-input.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/text-input/shared/constants.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/ability-group.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/children/download-facebook-video-once.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/manifest.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/ports/browser-media-source-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/ports/video-artifact-storage-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/artifact-storage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/candidate-validation.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/facebook-candidates.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/facebook-page-probe-script.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/media-download.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/runtime/result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/capabilities/video-download/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/browser-controller.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-action-result.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-click-probe.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/current-chrome-browser-controller-execution.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-controller-primitives.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-controller-runtime.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-controller.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-screenshot.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-browser-scroll-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/current-chrome-browser-text-input.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/current-chrome-cdp-file-input.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-native-file-input.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/current-chrome-window-control.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/local-browser-session.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/browser/mouse-click-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/mouse-scroll-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/text-input-browser-primitive-port.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/browser/text-input-runtime-ports.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/CommanderAppRouter.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/CommanderMacShell.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/CommanderMacShellScripts.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/ai-provider-settings-client.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/app-run-limit-settings-client.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/clients/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-app.types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-app.view-model.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console-dashboard.types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console-shell-client-events.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console-shell-client-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console-shell-client.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console-view-model.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console.copy.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-console.tokens.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/commander-shell-render-state.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/InspectDebugBundle.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/InspectDeveloperRefs.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/InspectError.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/InspectMission.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/InspectResult.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/inspect/renderInspectItemHtml.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/LeftSidebar.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/MacShellFrame.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/MacTitleBar.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/MacToolbar.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/MainWorkspace.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/PageHeader.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/RightInspector.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/layout/RuntimeStatusStrip.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/locale.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/ActionableErrorBanner.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/CapabilityHealthList.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/CurrentMissionCard.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/CurrentStepCard.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/DebugDrilldownButton.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/ResultSummaryCard.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/ReviewSummaryCard.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/StructuredLogList.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/modules/VisualMissionPromptLauncher.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/AiProviderSettingsPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/AmazonInvoiceUploadPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/HealthPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/HomeStartPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/MissionPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/ResultsPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/pages/ReviewPage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/render-advanced-utils.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/render-commander-console-page.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/render-helpers.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/render-utils.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/styles/commander-console-styles-tail.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/styles/commander-console-styles.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-http-helpers.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-binding-contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-debug-writer.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-dispatch-result.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-flow.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/task-start-visual-mission-binding.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-helper-actionable-errors.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-helpers.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-model/inspect-items.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-model/policy-sections.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-model/primary-pages.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-model/status-sections.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-app-shell/view-model/summary-sections.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/app-run-limit-settings-types.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/contract.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/default-data-dir.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/ids.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/index.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/runtime-resource-usage.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/settings-types.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/settings.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/structured-log-bus.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/structured-log-terminal.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-assembly.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-browser-support.ts | MODIFY | Browser session foundation for flow scripts and evidence. | browser |
| src/lib/local-runtime/workbench-capability-support.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-commander-console.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-commander-snapshot-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-commander-snapshot.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-commander-status.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-commander-transport.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-commander-types.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-facade.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-handle.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-launch-contract.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-nerve-bus-dispatcher.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/lib/local-runtime/workbench-status-types.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench-status.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/local-runtime/workbench.ts | MODIFY | Minimal workbench assembly and handle. | local-runtime |
| src/lib/online-ai/config.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/lib/online-ai/gemini-client.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/lib/online-ai/gemini-visual-mission-schema.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/lib/online-ai/index.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/muscle-memory/catalog-merge.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/muscle-memory/catalog.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/muscle-memory/generated-catalog.json | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/muscle-memory/manual.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/muscle-memory/schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/builtins/facebook-web.profile.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/builtins/tiktok-web.profile.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/platform-profile.schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/platforms/platform-registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/.DS_Store | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/plugins/amazon-invoice-upload/README.md | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-dom-hints.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-dom-step-trace.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.types.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.types.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/amazon-result-detector.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/index.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/amazon-invoice-upload/mission.schema.ts | MODIFY | Main Amazon invoice upload flow and smoke path. | amazon-invoice-upload |
| src/plugins/local-workbench-plugin-tasks.ts | MODIFY | Existing file must serve the new Amazon flow architecture if retained. | new-architecture |
| src/plugins/product-video-dom-runtime/README.md | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/index.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-comment-extractor.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-extractor.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-judge.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-round-contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-round-support.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-round.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom-text.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom.flow.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-dom.schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-evidence-packet.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-judge-prompt.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-judge.contract.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-next-action.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-store.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-task-service.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/plugins/product-video-dom-runtime/product-video-task-storage.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/types/visual-mission-action-plan.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/visual-mission/.DS_Store | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/visual-mission/action-plan/action-field-classifiers.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/visual-mission/action-plan/action-field-policy.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/visual-mission/platform-target-registry.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
| src/visual-mission/round/pure-visual-round-output.schema.ts | DELETE | Retired universal/visual/old-owner surface removed by new job-flow architecture. | none |
