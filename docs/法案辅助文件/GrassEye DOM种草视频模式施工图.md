# GrassEye DOM 种草视频模式施工图

status: active
version: 2026-05-20

## 0. 定位

DOM 种草视频模式是 GrassEye 的新增产品视频挖掘模式。

它不是纯视觉模式的补丁，也不是纯视觉 round 的内部扩展。

它是一个平级运行模式：

```txt
DOM-first Product Video Runtime
```

核心原则：

```txt
DOM 负责页面事实；视觉负责画面事实；Evidence Packet 汇总事实；高级 AI 后续做选品/利润/采购/广告判断。
```

---

## 1. 与纯视觉模式的关系

当前纯视觉模式继续保留。

纯视觉模式用于：

- 截图
- 坐标网格
- 单轮 AI 判断
- 单动作执行
- 保存视觉证据

DOM 种草视频模式用于：

- 读取页面结构
- 读取视频标题、文案、标签、作者、互动数据
- 读取商品链接、橱窗入口、评论入口
- 读取评论文本
- 定位下一条视频
- 判断登录/验证码/安全阻断
- 编排产品视频证据包

禁止事项：

- 不得把 DOM 种草视频流程塞进纯视觉 round 内部。
- 不得为了 DOM 模式删除或破坏当前纯视觉模式。
- 不得让纯视觉模式的禁止项反向排斥 DOM 种草视频模式。

---

## 2. 主链路定义

DOM 种草视频模式默认链路：

```txt
open platform page
  -> detect login/security state
  -> read DOM product-video page snapshot
  -> extract video identity and page metadata
  -> detect product/link/comment surfaces
  -> collect DOM evidence
  -> call visual verification only when video-frame semantics are needed
  -> build Evidence Packet
  -> decide next browse action
```

DOM 是默认主链路。

视觉只在以下场景调用：

- 判断画面里是否真实出现产品
- 判断产品类型、外观、使用场景
- 判断视频是否低质搬运/混剪
- 判断包装、品牌、字幕、场景强度
- DOM 不可读或页面异常时作为兜底证据

---

## 3. 能力边界

DOM 种草视频模式允许调用：

- `READ_DOM_SNAPSHOT_ONCE`
- `LOCATE_DOM_ELEMENT_ONCE`
- `CLICK_DOM_ELEMENT_ONCE`
- `VERIFY_DOM_STATE_ONCE`
- `WAIT_FOR_DOM_STATE_ONCE`
- 截图/视觉能力作为证据补充
- forensics/evidence 能力保存证据包

DOM 种草视频模式不得：

- 读取 cookie/token/localStorage/sessionStorage
- 输出完整 HTML
- 绕过登录、验证码、二次验证
- 自动执行付款、下单、退款、删除等危险动作
- 把 TikTok/Instagram/YouTube/Amazon 等平台专用选择器写进通用 DOM 能力组
- 把最终选品、利润、采购、广告判断写进本地 Agent

---

## 4. 建议目录

```txt
src/plugins/product-video-dom-runtime/
  ├─ index.ts
  ├─ product-video-dom.schema.ts
  ├─ product-video-dom.flow.ts
  ├─ product-video-page-snapshot.ts
  ├─ product-video-dom-extractor.ts
  ├─ product-video-comment-extractor.ts
  ├─ product-video-link-detector.ts
  ├─ product-video-visual-verify.bridge.ts
  ├─ product-video-evidence-packet.ts
  └─ README.md
```

说明：

- 该目录属于业务/模式编排层。
- 通用 DOM 读取、定位、点击、验证仍归属 `src/capabilities/dom-automation/**`。
- 平台差异通过 plugin config / hints / profile 处理，不污染 DOM 能力组。

---

## 5. Evidence Packet 建议字段

```ts
type ProductVideoEvidencePacket = {
  packetId: string;
  platformId: string;
  pageUrl: string;
  videoVisitId: string | null;
  videoDomId: string | null;
  author: string | null;
  titleText: string | null;
  descriptionText: string | null;
  hashtags: string[];
  engagement: {
    likesText?: string | null;
    commentsText?: string | null;
    savesText?: string | null;
    sharesText?: string | null;
  };
  productSignals: {
    productLinkVisible: boolean;
    shopEntryVisible: boolean;
    cartEntryVisible: boolean;
    externalLinkVisible: boolean;
    productKeywords: string[];
  };
  commentSignals: {
    sampledComments: string[];
    buyingIntentComments: string[];
    complaintComments: string[];
    questionComments: string[];
  };
  visualSignals?: {
    productVisible: boolean;
    productTypeHint: string | null;
    usageSceneHint: string | null;
    visualConfidence: number;
  };
  evidenceRefs: string[];
  nextActionHint: "next_video" | "open_comments" | "open_product_link" | "save_candidate" | "review_required";
};
```

---

## 6. 人工接管边界

出现以下情况必须 review_required：

- 未登录
- CAPTCHA / 2FA / 安全验证
- 页面结构不可读
- 视频身份无法稳定识别
- 多个商品入口歧义
- 评论区打开失败
- 页面触发危险操作按钮
- DOM 与视觉证据互相冲突

---

## 7. 本轮关闭定义

本轮只完成治理口径解冻与模式入口，不要求实现完整 runtime。

完成标准：

- 纯视觉模式继续保留。
- 法案/施工图不再把纯视觉当作唯一产品视频挖掘路径。
- DOM 自动化能立组可以被 DOM 种草视频模式合法调用。
- 新增 DOM 种草视频模式施工图，明确 DOM 主链路与视觉补充链路。
- 后续实现必须另起插件/模式目录，不得破坏当前纯视觉闭环。
