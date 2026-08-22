# GrassEye App Shell UI 终态施工图

status: active
version: 2026-08-21.terminal
implements: APEX-LOCAL-APP-SHELL-001-V2, APEX-LOCAL-APP-SHELL-002-V2, GRASSEYE-APP-SHELL-UI-001-V1, GRASSEYE-APP-SHELL-UI-PHYSICAL-CLEANUP-001-V1

## 唯一责任

src/app/create-workbench-server.ts 保持唯一 4173 listener。新增的 workbench-browser-websocket-upgrade.ts 只注册 /browser-authority/v1 upgrade；它只调用 Browser public contract，不能 import plugin private runtime、capability private runtime 或 browser command implementation。

## 原子切换

1. 冻结 workbench-browser-extension-channel-client.ts、workbench-browser-extension-channel-routes.ts、create-workbench-server.ts、workbench-home-page.ts 的真实 consumer denominator。
2. 静态装配 WebSocket upgrade、origin/path/frame boundary 和 ABSENT state。
3. 同一 work order 中将 create-workbench-server 与 workbench-home-page 迁到 upgrade/status readback。
4. 删除两份旧 relay 文件。
5. 用 AST/route graph、consumer readback 和 real Chrome negative route proof 检查 zero residue。

失败时 Browser Authority 留在 ABSENT；只向前修复新链，不恢复 page relay、Port、polling、SSE 或 dual run。

## UI contract

固定信息结构保持 Top Command Bar、Skill Registry、Workspace、Inspector、Runtime Console。Browser 面板只显示 authority slot、release identity、failure class、evidence ref；不得显示或接受 tab、target、selector、command、permit、raw frame、secret。

## 验收

- owner inspector 证明唯一 listener/upgrade、无旧 route/client/Port/polling/SSE；
- negative requests 到旧 open/inbound/next routes fail closed；
- real Chrome 证明同一 App Server 读取 upgrade status，不证明真实网站业务；
- UI proof 不替代 Browser Authority/Dynamic/business proof。

## 23. Legacy APP User-Demand Authority Physical Absence

旧 `GrassEye APP 用户需求启动施工图` 已由唯一 App Shell 法案和本施工图原子取代，原文件及任何 retired、archived、deprecated、hidden、copy 变体必须物理缺席。`src/app/**`、`package.json`、迁移决策表和非治理文档不得继续引用旧文件或旧标题；发现任一引用即 FAIL，不得以重命名、归档或兼容入口保留。

## 24. Real Chrome Dynamic Proof

唯一生产取证入口是 `scripts/acceptance/capture-app-shell-ui.real-chrome.ts`。它必须真实启动 Chromium，访问精确 URL `http://127.0.0.1:4173/`，并要求同一 Workbench 的 `/api/health` 返回 `healthy` 且 `sourceFingerprint` 精确等于当前磁盘源码候选，然后读取并排它确认下列稳定 DOM：`[data-app-shell]`、`[data-app-shell-sidebar]`、`main[data-app-shell-workspace]`、`[data-app-shell-inspector]`、`[data-runtime-console]` 各恰好一个；`[data-user-demand-startup], [data-legacy-app]` 和精确文本 `用户需求启动` 各为零。它把原始观察文件与整页 PNG 截图写到 `.grasseye-local/dynamic-proof/artifacts/`，再把二者真实字节 hash、浏览器版本、当前源码候选和取证合同 hash 写入唯一 canonical proof `.grasseye-local/dynamic-proof/app-shell-ui-physical-cleanup.v1.json`。

唯一延期动态验证叶是 `scripts/acceptance/app-shell-ui.real-chrome.ts`。它只读 canonical proof，重新计算当前源码候选、取证合同 hash、观察文件 hash 与截图 hash，重新解析精确 DOM 观察，并校验 30 分钟新鲜度。候选漂移、合同漂移、任一 artifact 缺失/替换、路径越权、过期、URL/title 不符、候选不唯一或 legacy surface 非零都返回 `NOT_PRODUCTION_VERIFIED`。App Shell 页面证明不得绑定 Xuanxue Cloud/Provider receipt，也不得接受调用方布尔值或任意 proof root。

`package.json` 与 `ci-acceptance-law-bindings.ts` 同时删除该叶也不得逃逸：CI 必须从 active law 独立重建全部 `real-chrome` / `real-provider` 分母，并要求每个延期动态 facet 恰好一个验证叶。
