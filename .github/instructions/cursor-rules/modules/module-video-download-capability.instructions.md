---
name: "GrassEye Video Download Capability"
description: "Use when defining governed video media download capability boundaries, platform-specific media source extraction, download evidence, or handoff from downloaded video artifacts to AI analysis."
applyTo: ".github/instructions/cursor-rules/modules/module-video-download-capability.instructions.md, docs/法案辅助文件/GrassEye Video Download 视频下载能力组施工图.md, scripts/audit/domains/video-download-capability/**"
---

# GrassEye Video Download Capability

Scope: governs the future `video-download` ability group and its child capabilities.
Boundary: this module governs media-source discovery, download authorization, artifact proof, platform child boundaries, and AI handoff boundaries.
Excludes: product value judgment, AI product-seeding classification, visual mission planning, cookie/session handling, login bypass, and platform business workflows.
Authority: this file is authoritative only for the video-download-capability domain.

## Phase 0 Construction Status

The current construction phase is governance-first.

Before runtime implementation exists, the quality gate must protect these facts:

- no `video-download` child capability may be exposed to MuscleMemoryCatalog or AI action planning;
- no private plugin, DOM helper, or platform profile may implement a shadow video downloader;
- no downloaded-video success may be faked by screenshot, poster image, HTML, or raw page text;
- no cookie, session, token, CAPTCHA, login, risk-control, DRM, or third-party downloader bypass may appear as a positive implementation path.

Runtime implementation requires a later code phase that adds owner contracts, schemas, child registry, execution path, Forensics artifact writing, and stronger inspector coverage.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: video-download is a standalone media artifact capability group, not a DOM helper, product judge, plugin shortcut, or platform workflow.

### 主题

视频下载能力组主权

### 法条

Video Download owns one class of executable ability: obtaining one governed video media artifact from a user-authorized current page or approved page URL and returning local artifact proof.

Required direction:
- The future ability group id must be `video-download`.
- The canonical runtime root must be `src/capabilities/video-download`.
- The group must own schemas, contracts, child catalog, execution boundary, artifact proof, and failure semantics for media download.
- The group may use public browser and DOM contracts as inputs, but must not live inside DOM Automation, Product Video DOM Runtime, PlatformRegistry, Open, Screenshot, or AI.
- The group must return downloaded media artifact refs and metadata only.
- Product value, product-seeding judgment, purchasing judgment, and advertising judgment remain outside this group.

### 禁止

FORBIDDEN:
- implementing video download inside `src/capabilities/dom-automation/**`, `src/plugins/product-video-dom-runtime/**`, or `src/platforms/**` as a private owner;
- treating video download as a DOM snapshot child, product-video plugin child, platform profile field, or AI semantic shortcut;
- returning screenshots, poster images, HTML, visible text, or page metadata as downloaded-video success;
- creating a compatibility, fallback, bridge, duplicate, or shadow downloader beside the video-download owner.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: video download must use only user-authorized local page access and must never bypass credentials, login, CAPTCHA, risk controls, DRM, or platform protections.

### 主题

授权访问与平台安全红线

### 法条

Video Download may use only media resources already available to the user's authorized local browser session or approved public page URL.

Required direction:
- Credentials, cookies, sessions, localStorage, sessionStorage, and tokens must remain undisclosed and unread.
- Login wall, CAPTCHA, 2FA, risk-control wall, private video, permission denial, or DRM must return `review_required` or `failed`.
- Media extraction must be read-only until a validated media candidate is downloaded.
- Platform request headers must be minimal and must not smuggle secrets from browser storage.
- Temporary CDN URLs must be treated as expiring source evidence, not durable product evidence.

### 禁止

FORBIDDEN:
- reading, exporting, logging, injecting, replaying, or persisting cookies, sessions, tokens, browser passwords, localStorage, or sessionStorage;
- bypassing login, CAPTCHA, 2FA, risk control, private-video gates, signed-access gates, or DRM;
- using third-party downloader websites or hidden paid APIs as default runtime paths;
- scraping private messages, private videos, or non-public pages;
- logging full signed media URLs when they contain sensitive or expiring credential material.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Facebook and TikTok downloaders are platform child capabilities that download one target video once and must not become business workflows.

### 主题

平台子能力边界

### 法条

The first two child capabilities are platform-specific media-source extraction and download actions:

- `download-facebook-video-once`
- `download-tiktok-video-once`

Required direction:
- Each child capability must download at most one target video artifact per invocation.
- Each child must declare explicit input schema, forbidden inputs, output proof, failure policy, and platform host allowlist.
- Facebook extraction may parse current-page DOM, inline script state, performance resource entries, video element state, and public media candidate fields such as native MP4 or DASH references.
- TikTok extraction may parse current-page DOM, script state, performance resource entries, video element state, and media requests that are already available to the user-authorized page.
- Any platform-specific parser must stay under the video-download owner.

### 禁止

FORBIDDEN:
- combining open page, classify product, like, comment, save lead, next video, and download into one child capability;
- adding `download-facebook` or `download-tiktok` as Open child capabilities;
- storing platform-specific media parser logic in DOM Automation or Product Video DOM Runtime;
- using platform names as business-flow packages instead of child media download boundaries.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every media candidate must be validated before download success can be claimed.

### 主题

媒体候选验证

### 法条

Video Download must prove that a candidate is a real video media resource before writing success evidence.

Required direction:
- Candidate hosts must pass platform-owned allowlists or approved media CDN policies.
- Candidate URLs must pass MIME, status, size, and byte-range checks when available.
- Downloaded files must be verified as real media containers with video streams.
- Output metadata must include content type, byte size, duration, dimensions when available, selected quality, and source candidate kind.
- Failed, ambiguous, expired, poster-only, image-only, HTML-only, and DRM-blocked candidates must not become success.

### 禁止

FORBIDDEN:
- treating `.jpg`, `.webp`, poster images, thumbnails, HTML, JSON, screenshots, or empty files as video success;
- skipping media validation because a URL string contains `video` or `mp4`;
- using unbounded download size or unbounded wait;
- returning stale or expired CDN URLs as the only output proof.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-005-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every download attempt must leave Forensics-compatible artifact proof and structured failure evidence.

### 主题

下载证据与元数据

### 法条

Every video download attempt must leave traceable owner evidence for success and failure.

Required direction:
- Success output must include `artifactRef`, `sourcePageUrl`, `platformId`, `videoId` when known, `contentType`, `byteSize`, `durationMs` when known, `width` and `height` when known, `downloadedAt`, `candidateKind`, `status`, and owner proof.
- Failure output must include status, error code, reason, source page URL, platform id, and review-required reason when applicable.
- The media file must be stored as a local artifact through the governed evidence path.
- Logs must redact sensitive query material and must not write cookies, sessions, tokens, or credentials.

### 禁止

FORBIDDEN:
- silent success;
- silent failure;
- returning only an in-memory buffer with no artifact reference;
- storing raw sensitive signed URLs as durable evidence;
- writing downloaded media outside the governed artifact path.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-006-V1

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: downloaded video artifacts may feed AI analysis, but video-download must not own AI product judgment.

### 主题

AI 分析交接边界

### 法条

Video Download may hand a verified local video artifact to downstream AI analysis or Product Video evidence assembly.

Required direction:
- Video Download output may be consumed by AI, Product Video DOM Runtime, or Forensics only through public contracts.
- Downstream AI may judge product visibility, product value, seed quality, purchase intent, or selection value.
- Video Download must stay limited to media acquisition and proof.
- If video cannot be downloaded, downstream analysis may receive a failure or review-required result, not a fake video artifact.

### 禁止

FORBIDDEN:
- video-download deciding whether a video is a product-seeding video;
- video-download scoring product value, profit, procurement, ads, comment intent, or market fit;
- hiding AI analysis prompt logic inside media downloader code;
- treating successful download as successful product discovery.
