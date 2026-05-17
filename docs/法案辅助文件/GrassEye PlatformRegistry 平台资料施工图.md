# GrassEye PlatformRegistry 平台资料施工图

## 文件身份

PlatformRegistry 只保存平台入口资料，不定义动作链，不定义业务流程，不生成运行计划。

Owner boundary: platform-registry
Consumers: commander-console, orchestration, ai, open

## PlatformProfile

```ts
type PlatformProfile = {
  platformId: "facebook-web" | "tiktok-web";
  displayName: string;
  entryUrl: string;
  targetTitle: string;
  allowedHosts: string[];
  supportedAtomicActionCodes: string[];
  visualNotes?: string;
};
```

## 硬边界

PlatformRegistry 只保存：
- platformId
- displayName
- entryUrl
- targetTitle
- allowedHosts
- supportedAtomicActionCodes
- visualNotes

PlatformRegistry 不保存：
- 页面状态判断
- 动作结果判断
- 点击、输入、滚动、截图参数
- 业务流程
- 多动作计划
- 语义动作提示

## 使用规则

- Open 只使用 `entryUrl` 和 `allowedHosts` 做入口打开与 URL 治理。
- AI 只看到平台身份、入口资料、可用原子动作列表和视觉备注。
- Orchestration 只把平台资料作为系统注入上下文，不按平台资料做业务分支。
- MuscleMemoryCatalog 是唯一 actionCode 权威。
