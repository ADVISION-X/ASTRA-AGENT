# GrassEye 唯一启动入口与终端结构化日志终态施工图

status: active
version: 2026-08-22.clean-restart
implements: APEX-STARTUP-001-V3

## 启动顺序

`npm run grasseye:start` 首先由 Node `--env-file-if-exists=.env.local` 向同一启动进程注入可选本地配置，不存在时正常启动，不允许第二 env loader，不允许把 secret/token 写入终端。之后顺序为：检查 Node/npm/依赖 -> 枚举唯一端口全部 listener -> 同批确认 UID、启动时间、cwd 与 App Server 命令身份 -> TERM -> 重新确认同一身份后按需 KILL -> 确认端口无 listener -> 读取 unpacked extension directory/release record/Chrome-profile identity -> 启动唯一 App Server -> 等待 health -> 打开 Workbench -> 输出结构化报告。

端口号只用于发现候选，不构成终止授权。候选必须属于当前用户，cwd 位于本仓库，命令绑定 `src/app/server.ts`，且每次发信号前 PID、UID、启动时间、cwd、命令全部与已确认快照一致。任一候选属于另一仓库、身份缺失、PID 复用、清理后出现未确认 listener 或最终端口不为空，启动必须失败关闭；不得热挂载、不得跨仓杀进程、不得另建守护进程或共享清理服务。

Browser preflight 只输出 ABSENT/PRESENT 的可用性和 redacted failure class；不能连接 extension、生成 pairing、执行 WebSocket frame 或开展业务。

## 预检对象

固定读取 .grasseye-local/browser-build/extension 与 .grasseye-local/browser-release/release-record.json。release record 必须绑定 stable extension ID、releaseBuildId、ExtensionDirectoryHashV1、manifest/protocol/SitePolicy hash 和 Chrome/profile readback。CWS_PAGE_CHANNEL、CWS review、external Port、Native Host、page relay 均为 retired zero。

## 日志

每条启动事件包含 phase、component、eventType、status、durationMs、reason、refs；不得记录 pairing secret、key、token、cookie、raw body、artifact bytes 或 profile secret。启动成功只表示 App health 与 artifact preflight，不表示 Browser session、业务、Chrome、CI 或发布成功。
