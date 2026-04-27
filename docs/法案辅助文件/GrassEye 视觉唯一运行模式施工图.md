# GrassEye 视觉唯一运行模式施工图

## 1. 定位

GrassEye real-platform mode 是视觉唯一运行模式。
浏览器只提供页面、截图、几何、坐标输入。
页面理解只能来自截图、OCR、本地视觉 AI、视觉目标识别。
不得通过 DOM/BOM 读取网页内容。

## 2. 核心链路

真实平台运行主链：

截图 -> 本地视觉 AI -> 视觉目标识别 -> 坐标动作 -> 动作后截图验证 -> 结构化日志证明

1. local real Chrome with persistent profile
2. open target page
3. screenshot viewport / video area
4. local AI product presence judgment
5. visual target detection
6. geometry guard
7. coordinate action
8. post-action screenshot verification
9. structured action log
10. Browse Ledger / Evidence Packet finalization

## 3. 禁止 DOM/BOM 内容读取

禁止：
- querySelector / locator / getByText 作为真实平台目标定位
- textContent / innerText 作为评论或指标来源
- DOM tree crawling
- accessibility tree crawling as page understanding
- selector-based button click
- DOM semantic fallback
- DOM scrape metrics
- DOM scrape comments
- DOM scrape product info
- Playwright storageState as login persistence
- cookies/session/token read/export/inject

## 4. 允许的浏览器基础能力

允许：
- launch local real Chrome
- persistent userDataDir
- open URL
- get current URL
- get viewport / geometry
- screenshot
- coordinate mouse click / scroll / keyboard
- browser health check
- close / stop browser process

这些能力属于 browser infrastructure，不属于 DOM reading。

## 5. 视觉动作能力

所有施工图动作必须视觉化：
- like/save marker -> visual target
- open comments -> visual target
- close comments -> visual target
- click not interested -> visual target
- scroll next -> visual action and screenshotHash/videoVisitId verification
- collect metrics -> screenshot OCR/visual extraction
- comment reading -> comment screenshot + OCR/local AI
- login/captcha/safety detection -> screenshot visual detection

## 6. 失败策略

如果视觉无法确认：
- 不 DOM fallback
- 不 selector fallback
- 不盲点
- 记录 failureReason
- 进入 skip / review_required
- 写 StructuredActionLog

## 7. 验收原则

真实平台动作只有满足以下条件才算生产级：
- before screenshot exists
- visual target exists
- boundingBox exists
- confidence >= threshold
- geometry guard passed
- coordinate action executed
- after screenshot exists or unable_to_verify reason exists
- StructuredActionLog exists