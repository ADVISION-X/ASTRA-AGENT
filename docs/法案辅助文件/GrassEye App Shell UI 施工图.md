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
