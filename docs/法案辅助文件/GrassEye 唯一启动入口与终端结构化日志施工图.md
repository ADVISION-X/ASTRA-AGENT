# GrassEye 唯一启动入口与终端结构化日志终态施工图

status: active
version: 2026-08-21.terminal
implements: APEX-STARTUP-001-V2

## 启动顺序

`npm run grasseye:start` 首先由 Node `--env-file-if-exists=.env.local` 向同一启动进程注入可选本地配置，不存在时正常启动，不允许第二 env loader，不允许把 secret/token 写入终端。之后顺序为：检查 Node/npm/依赖 -> 探测已有 /api/health -> 健康且 source fingerprint 匹配则热挂载 -> 否则清理不健康端口 -> 读取 unpacked extension directory/release record/Chrome-profile identity -> 启动唯一 App Server -> 等待 health -> 打开 Workbench -> 输出结构化报告。

Browser preflight 只输出 ABSENT/PRESENT 的可用性和 redacted failure class；不能连接 extension、生成 pairing、执行 WebSocket frame 或开展业务。

## 预检对象

固定读取 .grasseye-local/browser-build/extension 与 .grasseye-local/browser-release/release-record.json。release record 必须绑定 stable extension ID、releaseBuildId、ExtensionDirectoryHashV1、manifest/protocol/SitePolicy hash 和 Chrome/profile readback。CWS_PAGE_CHANNEL、CWS review、external Port、Native Host、page relay 均为 retired zero。

## 日志

每条启动事件包含 phase、component、eventType、status、durationMs、reason、refs；不得记录 pairing secret、key、token、cookie、raw body、artifact bytes 或 profile secret。启动成功只表示 App health 与 artifact preflight，不表示 Browser session、业务、Chrome、CI 或发布成功。
