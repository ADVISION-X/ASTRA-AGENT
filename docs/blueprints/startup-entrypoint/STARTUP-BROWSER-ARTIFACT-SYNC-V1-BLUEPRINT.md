# AGENT 启动时 Browser Artifact 同步施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "startup-browser-artifact-sync-v1",
  "status": "active",
  "owner": "startup-entrypoint",
  "lawIds": [
    "LAW-STARTUP-ENTRYPOINT-002-V1"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

`grasseye:start` 在服务启动前对固定 unpacked artifact 做只读 preflight。只有 artifact 缺失或与当前
governed extension sources、manifest、pairing page、protocol、site policy 不一致时，才调用唯一
`src/lib/browser/chrome-extension/build.mjs` 重建 `.astra-local/browser-build/extension`，随后必须再次
通过 preflight。启动器不运行 CI、audit、typecheck、acceptance、真实 Chrome，不配对、不认领 Target，
也不直接调用 Extension reload。

正文闭环：终态 Owner 是 `startup-entrypoint`；输入为现役 extension sources 与固定 artifact，输出为通过
preflight 的同一 artifact identity。状态只落在唯一 build 目录，调用方向固定为 `grasseye:start` ->
preflight -> 必要时 build -> 再 preflight。失败恢复仅允许同链重建并保持启动失败，安全边界禁止配对、
Target claim 与审计副作用；验收必须证明一致时不写入、漂移时重建、复检失败时 blocked。

普通启动的 dependency preflight 只读取 `package.json` 声明、实际安装路径、Node engine 与必须的 native
load/query 结果；`package.json`、lockfile、`node_modules/.package-lock.json` 的 mtime 不是 dependency 身份，
不得因为仅修改 scripts 等非 dependency 字段要求操作员重装依赖或阻断 production Shell。

启动器只管理直接spawn的本仓实际Node App进程；spawn时即登记started/closed Promise，快速退出也必须可回读。
停止信号同步禁止后续启动步骤、spawn与开页；只转发一次并等待实际App收尾，不经npm/tsx CLI包装，
不按固定秒数强杀。子进程非零或被signal终止必须报告失败，不能因启动器已在停止就认定成功。
App保持唯一诊断HTTP直到原任务收尾，重复信号加入同一次关闭；初始化中的迟到资源也必须纳入关闭。
验收由现役Startup与Runtime入口证明迟到初始化、快速exit、超过旧五秒的实际子进程及重复停止。

ASTRA 的唯一静态应用身份由 `src/lib/browser/profile/browser-application-identity.ts` 提供，Shell 固定 loopback 4174，独立扩展与设备凭据使用真实仓根下的 `.astra-local`。启动在当前 Chrome 精确复用本仓 Shell Tab，缺席才新开 Shell，无窗口沿原恢复入口。启动与窗口恢复不传 user-data-dir/profile-directory，不强制新实例、不复制登录资料、不接管既存 GPT Tab。扩展身份与任务独占 Target 分开，首次加载扩展仍由独立安装操作完成。缺 ASTRA 独立设备只阻断 execution/claim，不能读回复制设备或连接周天服务。
