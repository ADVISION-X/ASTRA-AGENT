# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

施工图只作为实现地图，不高于 active law。

## 唯一流程

```txt
USER QUESTION
   ↓
INPUT ATTACHMENT INTAKE
   - App page file picker / paste / drop
   - stage files under Workbench dataDir
   - produce governed inputAttachments manifest
   - delivery stays on AI Input Gateway file-ref path
   ↓
AI RESEARCH PLAN JSON
   - N subQuestions
   - each subQuestion has its own promptBundle
   - finalAdjudicationPromptBundle
   - htmlReportPromptBundle
   - planIntegrityCheck
   - inputAttachments sent with the decomposition prompt package
   ↓
PERSIST RAW DECOMPOSITION + RESEARCH PLAN
   ↓
FOR EACH SUBQUESTION
   - subQuestion.promptBundle
   - runtime N format shell
   - AI answer body between ANSWER_TEXT_BEGIN / ANSWER_TEXT_END
   - optional retrieval-only index JSON between INDEX_JSON_BEGIN / INDEX_JSON_END
   - inputAttachments sent with every subQuestion prompt package
   - send to AI
   - persist rawResponseText
   - persist parsed answerText from the delimited answer body
   - persist parsedJsonIndex / indexNotes only when the retrieval block is valid
   ↓
BUILD FULL CASE FILE
   - all prompts
   - all raw responses
   - inputAttachments manifest
   - structured index
   - parse failures with raw
   ↓
FINAL ADJUDICATION
   - finalAdjudicationPromptBundle
   - structuredIndex
   - fullCaseFile
   - fullCaseFileMarkdown
   - inputAttachments sent with the final adjudication prompt package
   - runtime final format shell
   - persist rawFinalAnswerText
   - persist parsedJsonIndex only when available
   ↓
HTML REPORT
   - htmlReportPromptBundle
   - rawFinalAnswerText
   - fullCaseFile
   - fullCaseFileMarkdown
   - inputAttachments sent with the HTML report prompt package
   - runtime HTML format shell
   - bind report to current fullCaseFile.job.jobId
   - visible summary answer
   - visible forensics process
   - final conclusion before N-stage appendix
   - N-stage questions and answers after the conclusion
   - each N-stage item cites raw response hash
   - N-stage appendix visible text preserves at least 80% of persisted N-stage source material
   - persist business-report.html
   ↓
EXPORT
   - full-case-file.json
   - full-case-file.md
   - final-adjudication-raw.md
   - business-report.html
   - evidence-index.json
   - structured-index.json
```

## Format Shell Boundary

系统只拼接格式壳、安全壳、持久化说明和传输约束。格式壳只规定如何保存、追溯、导出、展示，不规定业务结论结构。

允许：

```txt
ResearchPlan JSON contract
delimited N-stage answer body plus optional retrieval-only index JSON
rawFinalAnswerText persistence notice
complete self-contained HTML artifact constraints
forbidden control commands
```

禁止：

```txt
system-owned JSON answer envelope that wraps the whole N-stage answer body
system-owned business conclusions
system-owned confidence
system-owned verdict/ranking fields
system-owned final summary
system-owned report section logic
```

## N-Stage Clean Body Capture

N 阶段必须把长正文与索引分离。

允许的最小结构：

```txt
ANSWER_TEXT_BEGIN
完整正文。这里允许自然段、Markdown、小标题、列表、证据解释。
ANSWER_TEXT_END

INDEX_JSON_BEGIN
{
   "indexNotes": ["短索引，仅用于检索"]
}
INDEX_JSON_END
```

禁止把完整正文塞进 `answerText` JSON 字符串字段。`answerText` 是数据库中的解析结果，不是 runtime 壳要求 AI 返回的 JSON 包裹字段。

## Final Adjudication Raw Sovereignty

Final 阶段主产物是 `rawFinalAnswerText`。

成功条件：

```txt
rawFinalAnswerText is non-empty
```

失败条件：

```txt
rawFinalAnswerText is empty
```

系统不得把 final adjudication 转成固定 summary/confidence schema，不得从第一句话造 summary，不得生成 confidence。AI 如果输出 JSON，只能额外保存为 `parsedJsonIndex`，不能替代 raw。

## PromptBundle Field Consistency

PromptBundle schema、ResearchPlan schema、decomposition prompt、parser 只使用：

```txt
supplementalContent
```

不得存在字段别名。`supplementalContent` 是补充指导，不代表第二路径。

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

本地输入附件必须进入案卷附件清单：

```txt
id
filePath
mimeType
summary
fileHash
fileSizeBytes
sourceKind
```

附件清单只是 Deep Research 输入材料 manifest。文件实际传输不得绕过 AI Input Gateway，不得新增 provider 上传链路。

最终裁决必须接收：

```txt
structuredIndex
fullCaseFile
fullCaseFileMarkdown
finalAdjudicationPromptBundle
```

HTML report 必须接收：

```txt
rawFinalAnswerText
fullCaseFile
fullCaseFileMarkdown
htmlReportPromptBundle
```

GPT web-chat 生成 `business-report.html` 时，AI Input Gateway 必须返回真实 HTML artifact 内容作为 raw output：

```txt
1. primary: assistant 正文 `下载 business-report.html` 文件入口
2. secondary: 预览框右上角 `下载代码文件`
3. proof: raw output ref + provider outputRefs
```

Deep Research 不得保留从 assistant 文本、代码 fence、摘要文本中猜测 HTML 的获取方式。

## Web Chat Prompt Paste Truth

Deep Research 通过 web-chat 投喂 prompt 时，发送按钮可用不等于 prompt 已经正确进入 composer。

生产提交前必须按同一条 AI Input Gateway web-chat 路径完成以下证明：

```txt
focus composer
clear stale composer when no attachments are present
paste prompt through governed clipboard path
read untruncated visible composer text from the real provider page
compare normalized expectedPrefix + expectedSuffix + expectedLength
accept provider pasted-text card only when card exists and send is ready
submit only after verified paste
verify generation / assistant progress / composer cleared after verified paste
```

判定规则：

- `expectedPrefix` 使用 prompt 归一化后的前 80 字符。
- `expectedSuffix` 使用 prompt 归一化后的后 80 字符。
- `expectedLength` 使用完整归一化 prompt 长度。
- composer 真值必须优先读取 rich-text editor 的 `innerText`，再兜底 `textContent`；不得用 `textContent` 拼接段落后的结构文本作为主裁。
- fresh provider conversation 的 composer readiness 等待预算不得低于 60000ms；超时诊断必须带最后一次 provider 状态。
- prefix 命中可作为成功。
- suffix 命中且 composer 长度与 expectedLength 接近可作为成功。
- ChatGPT pasted text card 存在且 send ready 可作为成功。
- `sendReady` 单独存在不得作为成功。
- failure / review diagnostics 必须输出 `composerChars`、`expectedChars`、`prefixVisible`、`suffixVisible`、`pastedCard`、`sendReady`。

禁止：

- 用截断 composer 文本做 prompt presence 主裁。
- 用 send button ready 证明 prompt 已粘贴。
- paste 失败后新增 retry/fallback/第二 provider 提交流程掩盖失败。
- 没有真实 Chrome 页面验证就声称 web-chat 提交生产可用。

ChatGPT HTML artifact 捕获必须允许真实页面延迟：

```txt
1. AI 回复稳定后，artifact 入口、预览下载按钮、浏览器下载文件仍可能异步延迟出现。
2. capture 必须用真实浏览器 viewport click 点击 `下载 HTML 报告` / `business-report.html` 主入口，不能只执行 DOM target.click()。
3. primary 入口未立即产出文件时，必须继续尝试预览框 `下载代码文件`。
4. download/read 检查必须按 1s -> 2s -> 4s -> 8s -> 16s -> 30s 指数退避重试，直到捕获到有效 `business-report.html` 或阶段超时。
5. 每次下载候选都必须拒绝 ChatGPT shell HTML；只有真实业务 HTML 文档可以进入 raw output proof。
```

## Export

只允许导出：

```txt
full-case-file.json
full-case-file.md
final-adjudication-raw.md
business-report.html
evidence-index.json
structured-index.json
```

`structured-index.json` 只是导航索引，不是 full case file，也不是最终裁决真相源。

## Business HTML Full-Process Reviewability

`business-report.html` 不是只给最终裁决改写一个漂亮网页。

它必须是一个人类可复核的全过程案卷页：

```txt
Summary Answer
-> Forensics Process
-> Business Report Body
-> Final Conclusion
-> N-stage Questions and Answers
```

固定 HTML section id：

```txt
summary-answer
forensics-process
business-conclusion
n-stage-questions-and-answers
```

达标标准：

1. `summary-answer` 可以放在顶部，给快速阅读者看结论摘要。
2. `forensics-process` 必须紧跟总结区下方，说明拆解、N 阶段、原始回答、解析状态、最终裁决、导出/证据引用等取证链。
3. `business-conclusion` 必须保留最终裁决含义，位于正文靠后位置，并出现在 N 阶段问答附录之前。
4. `n-stage-questions-and-answers` 必须逐条展示已持久化的子问题、问题文本、清洁答案或 raw-preserved 状态、解析状态与可用原文摘要。
5. 如果 structured answer 缺失但 raw response 存在，HTML 必须显示 raw-preserved / parse status，不得把该问题隐藏。
6. HTML 必须显式绑定当前 `fullCaseFile.job.jobId`。如果捕获到的 HTML 是另一个 job 的报告，即使 section id 齐全也必须拒绝。
7. `n-stage-questions-and-answers` 中每个 N 阶段条目必须引用该条持久化 raw response hash，作为可复核引用。
8. `n-stage-questions-and-answers` 的可见正文不能成为极简领导式摘要。按当前案卷计算，N 阶段可见文本长度必须不低于持久化 N 阶段源材料的 80%。源材料优先使用 structured `answerText`，缺 structured 但 raw 存在时使用 raw response。
9. 这些是展示与追溯结构，不是业务判断 schema；不得引入 runtime-owned `confidence`、`finalVerdict`、`rankedConclusions`、`directAnswer` 等业务字段。

## App 页面：Deep Research Case Reader

App 页面不是单纯报告展示页。

App 页面是完整案卷阅读器。

固定结构：

```txt
History
-> Final Adjudication Raw
-> Primary Business HTML Report
-> ResearchPlan
-> N Analysis Cards
-> Full Case File
-> Process Trace
```

用户必须能直接在页面上检查：

```txt
promptBundle
renderedPrompt
cleanAnswer
index
rawResponse
final raw adjudication
HTML artifact delivery status
Full Case File exports
```

ResearchPlan 区块必须显示：

```txt
Main Question
Question Type if present
Decomposition Strategy
N count
planIntegrityCheck
finalAdjudicationPromptBundle status
htmlReportPromptBundle status
sub-question overview cards
```

每张 Analysis Card 必须分离显示：

```txt
PromptBundle
Rendered Prompt
Clean Answer
Index JSON / Index Notes
Raw AI Response
```

Final Adjudication Raw 区块只展示：

```txt
rawFinalAnswerText
preferredFormat
parseStatus
parsedJsonIndex when present
final interaction prompt and raw response evidence
```

Primary Business HTML Report 区块必须显示：

```txt
status
sourceKind
fileName
fileHash
fileSizeBytes
generatedAt
failureReason / reviewReason when missing
```

Full Case File 区块必须保留 open/download Markdown 和 JSON，并显示 outline preview：

```txt
decomposition raw present
analysis raw count
subQuestion count
final raw present
HTML report export present
```

Process Trace 必须按当前主链显示：

```txt
DECOMPOSE
ANALYZE_N
BUILD_FULL_CASE_FILE
FINAL_ADJUDICATION
HTML_REPORT
EXPORT
COMPLETE
```

显式不存在或禁止展示：

```txt
PPT
Deck
Optional Presentation
旧 final summary / confidence UI
```

UI 不得展示系统生成的 confidence、系统生成的 summary，或把 fixed FinalReport schema 字段当成权威。

## AST 解析护栏

Deep Research 活跃生产源码与本地 workbench surface 必须保持 TypeScript AST 可解析。

owner inspector 必须扫描：

```txt
src/plugins/deep-research-analysis/**/*.ts
src/app/workbench-deep-research*.ts
src/lib/local-runtime/workbench*.ts
```

现役本地组装 owner 是 `src/lib/local-runtime/workbench-deep-research-handle.ts`；它经
`src/mediator/deep-research-analysis-route.ts` 启动任务，并复用唯一 attachment staging handle，
不得把业务顺序搬入 local runtime。

发现 parse diagnostics 时必须直接 FAIL。

## 验收

完整验收入口只有：

```bash
npm run ci:full
```
