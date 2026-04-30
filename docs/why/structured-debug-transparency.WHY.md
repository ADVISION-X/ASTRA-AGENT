# structured-debug-transparency.WHY

## 定位

本文件解释 GrassEye 为什么必须把结构化日志从基础纪律提升到实战 DEBUG 透明化。

它不新增 owner，不替代法案，不改变 Forensics Persistence 作为 persisted truth owner 的主权。

## 为什么 DEBUG 必须看到 AI 投喂和回复

- AI 调用是 phase-three 真实平台执行里的关键判断路径，只知道调用过并不能支持排障。
- 真正的 DEBUG 需要知道投喂了什么 prompt、用了什么模型、喂了哪些图片、图片大小和 hash 是什么、模型原始回复了什么、解析后变成了什么。
- 如果这些信息缺失，系统只能得到一个模糊的失败摘要，无法定位是 prompt、图像、模型、解析器还是上游准备链出了问题。

## 为什么 promptLength 不够

- promptLength 只能证明有文本长度，不能证明 prompt 内容、版本、契约和 hash。
- 没有 promptHash 和 promptDebugRef，就无法确认当前运行到底用了哪份 prompt，也无法排查提示词漂移。
- summary mode 可以收敛显示，但必须保留 full mode 或 debug bundle 的可追溯路径。

## 为什么 raw response 不能被 parser 吞掉

- parser 只代表一种解释，不代表模型原始返回的全部事实。
- 如果 raw response 被 parser 吞掉，排障时就无法确认是模型输出坏了，还是 parser 规则坏了。
- parsedJson 可以服务业务消费，但 rawResponseHash 和 rawResponseRef 必须保留为运行证明的一部分。

## 为什么 terminal display 不是 truth

- terminal 是显示通道，适合给操作者看当前发生了什么，不适合作为最终可追责的持久化真相。
- 终端文本会滚动、会丢失上下文，也不天然具备 record refs、artifact refs 和删除治理能力。
- persisted truth 必须继续流向 Forensics Persistence，由结构化记录和 refs 承担回溯责任。

## 为什么 Forensics refs 必须存在

- 没有 Forensics refs，日志只能停留在描述层，不能回连到 evidence packet、browse ledger、failed record、runtime snapshot 和 debug bundle。
- refs 是把运行证明、终端摘要、AI 输入输出和持久化记录串起来的唯一稳定接口。
- 这也是防止 terminal relay 夺取 persistence 主权的关键设计。

## 为什么 redaction 不能省

- DEBUG 需要透明，不等于可以泄漏 cookie、token、credential 或敏感会话数据。
- prompt、raw response、图像元数据可以进入结构化排障链，但任何敏感字段都必须先脱敏，再进入终端或持久化记录。
- full mode 是更深的受治理观察路径，不是跳过安全规则的借口。

## 为什么 Local AI 不可用不能杀 App Shell

- App shell liveness 和 mission readiness 是两个不同层级的问题。
- Local AI 不可用时，正确行为是阻断相关 mission，并明确给出 ownerResponsible、failureReason 和 actionableMessage，而不是把整个 app shell 当成启动失败直接退出。
- 只有把健康和 readiness 分层记录，操作者才能在不中断控制台的前提下继续诊断系统状态。

## 结论

- 结构化日志不是多打几行 console。
- 它是 phase-three 实战阶段的运行证明系统。
- DEBUG 必须知道 AI 吃了什么、吐了什么、为什么失败、谁负责、下一步怎么办。