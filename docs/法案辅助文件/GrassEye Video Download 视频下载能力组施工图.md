# GrassEye Video Download 视频下载能力组施工图

status: active
version: 2026-05-21

## 0. 定位

Video Download 是 GrassEye 的第 13 个能力组。

它解决的问题是：

```txt
截图容易截到垃圾段；
下载完整视频后再交给 AI 分析，证据更完整、更稳定。
```

它不是 DOM 自动化的子能力，不是 Product Video DOM Runtime 的私有脚本，也不是 AI 判断能力。

一句话：

```txt
Video Download 只把当前目标视频下载成受治理的本地媒体 artifact；
AI 和产品分析链路再基于 artifact 判断价值。
```

## 1. 当前能力组位置

当前能力组列表应收口为：

1. `commander-console`
2. `orchestration`
3. `nerve-bus`
4. `ai`
5. `open`
6. `screenshot`
7. `geometry-guard`
8. `mouse-click`
9. `text-input`
10. `mouse-scroll`
11. `forensics-persistence`
12. `dom-automation`
13. `video-download`

Video Download 的执行维度是媒体资产获取。

它只执行：

- 发现当前目标视频的媒体候选；
- 验证候选是可下载视频；
- 下载一个视频文件；
- 写入本地 artifact；
- 输出元数据和证据引用。

它不执行：

- 产品判断；
- 点赞、评论、下一条；
- 页面流程编排；
- 登录、验证码、风控绕过；
- 第三方下载站调用；
- cookie/session/token 读取或导出。

## 2. Phase 0 建设边界

本轮只建设：

- 法案文件；
- 施工图文件；
- 质检 owner manifest；
- Phase-0 inspector。

本轮不建设：

- `src/capabilities/video-download/**` runtime；
- MuscleMemoryCatalog 暴露；
- AI 可规划动作；
- 实际下载代码。

Phase 0 inspector 只保护：

- 法案存在；
- 施工图存在；
- 代码中没有私有影子下载器；
- catalog 中没有提前暴露 video-download；
- 没有 cookie/session/token/DRM/CAPTCHA bypass 正向实现；
- 没有截图/封面图冒充下载成功。

## 3. 未来目录

代码阶段建议目录：

```txt
src/capabilities/video-download/
  ├─ index.ts
  ├─ ability-group.ts
  ├─ contract.ts
  ├─ schema.ts
  ├─ registry.ts
  ├─ children/
  │  ├─ download-facebook-video-once.ts
  │  └─ download-tiktok-video-once.ts
  ├─ runtime/
  │  ├─ candidate-extraction.ts
  │  ├─ candidate-validation.ts
  │  ├─ media-download.ts
  │  ├─ media-metadata.ts
  │  ├─ proof.ts
  │  └─ result.ts
  ├─ providers/
  │  ├─ facebook-video-source.ts
  │  └─ tiktok-video-source.ts
  └─ ports/
     ├─ browser-media-source-port.ts
     └─ artifact-storage-port.ts
```

## 4. 子能力

首批只允许两个子能力。

### 4.1 Facebook 视频下载

```txt
actionCode: DOWNLOAD_FACEBOOK_VIDEO_ONCE
abilityGroupId: video-download
childCapabilityId: download-facebook-video-once
```

输入建议：

```ts
type DownloadFacebookVideoInput = {
  platformId: "facebook-web";
  sourcePageUrl: string;
  pageSnapshotRef?: string;
  currentBrowserPageRef?: string;
  preferredQuality?: "hd" | "sd" | "best_available";
  missionId: string;
  runId: string;
};
```

允许候选来源：

- 当前页面 DOM 中的内联 Relay 数据；
- `browser_native_hd_url`;
- `browser_native_sd_url`;
- `dash_manifest_url`;
- 当前页面 `video` 元素状态；
- 当前页面 performance media resources。

禁止：

- 读取 cookies/localStorage/sessionStorage；
- 登录绕过；
- 第三方下载站；
- 把封面图当视频；
- 把临时 CDN URL 当永久证据。

### 4.2 TikTok 视频下载

```txt
actionCode: DOWNLOAD_TIKTOK_VIDEO_ONCE
abilityGroupId: video-download
childCapabilityId: download-tiktok-video-once
```

输入建议：

```ts
type DownloadTikTokVideoInput = {
  platformId: "tiktok-web";
  sourcePageUrl: string;
  pageSnapshotRef?: string;
  currentBrowserPageRef?: string;
  preferredQuality?: "best_available";
  missionId: string;
  runId: string;
};
```

允许候选来源：

- 当前授权页面中已经可播放的 `video` element source；
- 页面脚本状态中已暴露的 media candidates；
- performance media resources；
- 已通过页面授权可访问的 media response。

禁止：

- 外部 TikTok downloader 网站；
- 去水印第三方接口；
- 风控/CAPTCHA/登录绕过；
- DRM 或私密视频绕过；
- 下载失败时假成功。

## 5. 输出合同

成功输出建议：

```ts
type VideoDownloadSuccess = {
  status: "success";
  platformId: "facebook-web" | "tiktok-web";
  sourcePageUrl: string;
  videoId: string | null;
  artifactRef: string;
  contentType: "video/mp4" | "video/webm" | "application/dash+xml";
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  selectedQuality: "hd" | "sd" | "best_available" | "unknown";
  candidateKind: "native_hd" | "native_sd" | "video_element" | "dash_manifest" | "media_resource";
  downloadedAt: string;
  proofRef: string;
};
```

失败输出建议：

```ts
type VideoDownloadFailure = {
  status: "failed" | "review_required";
  platformId: "facebook-web" | "tiktok-web";
  sourcePageUrl: string;
  errorCode:
    | "candidate_not_found"
    | "candidate_not_video"
    | "download_expired"
    | "login_required"
    | "captcha_or_2fa_required"
    | "drm_or_private_video"
    | "permission_denied"
    | "network_failed"
    | "metadata_validation_failed";
  reason: string;
  proofRef: string;
};
```

## 6. 质检建设

Phase 0：

```txt
scripts/audit/domains/video-download-capability/
  ├─ manifest.json
  └─ inspector.ts
```

Phase 0 inspector 必须阻断：

- law 文件缺失；
- blueprint 文件缺失；
- `src/capabilities/video-download` 已存在但没有后续 runtime inspector 扩展；
- catalog 里提前暴露 `DOWNLOAD_FACEBOOK_VIDEO_ONCE` 或 `DOWNLOAD_TIKTOK_VIDEO_ONCE`；
- `src/plugins/product-video-dom-runtime/**` 出现私有下载实现；
- `src/capabilities/dom-automation/**` 出现私有下载实现；
- `src/platforms/**` 出现下载逻辑或媒体解析逻辑；
- 代码中出现 cookie/session/token/localStorage/sessionStorage 正向下载依赖；
- 代码中出现 bypass CAPTCHA/DRM/risk-control 的正向实现；
- 代码中出现第三方 downloader 服务调用。

代码阶段 inspector 必须扩展为：

- 检查 runtime root；
- 检查 public contract/schema/registry；
- 检查两个 child capability；
- 检查 Forensics artifact path；
- 检查 MIME/Range/metadata 验证；
- 检查失败分支；
- 检查 sensitive URL redaction；
- 检查没有产品判断。

## 7. 验收定义

Phase 0 完成标准：

- 法案文件存在并含 6 条 active law；
- 施工图存在并明确 Phase 0 与代码阶段边界；
- CI-FULL 能看到 video-download owner step；
- 质检在未实现 runtime 时不假装能力已存在；
- 质检能阻断影子实现和提前 catalog 暴露。

代码阶段完成标准：

- Facebook Reel 可下载真实 MP4 artifact；
- TikTok 可下载授权页面中可访问的真实 video artifact，或明确失败/人工复核；
- 下载结果可交给 AI 视频分析；
- 没有截图冒充完整视频；
- 没有 cookie/session/token/DRM/CAPTCHA 绕过。
