# ASTRA-AGENT 同机隔离完整实现方案

本文是本事项唯一方案。施工前修订仅纠正第7—9节的依赖顺序。已获授权的本地隔离和跨仓合同修订分别按第9节准入，联通切换仍需完整交接。阶段状态见第9节。

## 1. 需求与唯一来源

需求Owner、方案所在仓为 `/Users/nexgen/Documents/ASTRA-AGENT`（A）；网站为 `/Users/nexgen/Documents/AI Paper Factory`（W）。成熟参照为 `/Users/nexgen/Documents/AGENT`（G）与 `/Users/nexgen/Documents/xuanxue-web`（X）。四仓realpath、main、origin/main、当前HEAD与dirty/untracked已在任务上下文只读绑定，HEAD不写入任务文件，不另建候选回执。

四份唯一业务来源均在W的 `docs/governance/`，本轮已逐份全文回读：`ASTRA-01-用户与前端价值蓝图.md`、`ASTRA-02-研究生产与资产交付蓝图.md`、`ASTRA-03-Skill与AGENT运行拓扑蓝图.md`、`顶级论文蓝图_AI-Paper-Factory_v1.0.md`。它们决定业务目标及最终解释；前三份业务内容v0.4、顶级论文v1.0不由工程方案改写。蓝图、工程实现与质量证据分别判断；法案不吻合时先列GAP、取得对应规范授权，不能静默改法。

四项终点：W、A分别沿X、G对应启动职责运行；端口隔离；A数据库及全部执行状态独立；W—A几乎1:1沿成熟V6链完成任务接收、完整结果接收与网站业务消费读回。端口通、session成功、本地completed不等于业务接纳。

本任务负责A隔离与两仓接缝方案。W的数据库连接、角色、schema、迁移、备份及操作全部由网站现有Codex负责，本任务不代建、不代改、不连接；网站服务配置及运行也只列精确交接。G/X只读，不修改、启停、注册设备或清任务。沿用当前Chrome及现有GPT登录，不使用干净浏览器、新profile、新实例，不复制登录资料。

`ASTRA-AGENT迭代-完整实现方案.md`只拥有S00/S01—S10研究职责及成果核验，明确排除C01、通讯、Catalog与跨仓合同；本文不修改该方案或其专业代码。C01通讯生产入口由第7节P列明原Owner及精确接收条件。A按本任务的CI-FULL授权在main施工，原生CHANGE、范围内提交首推、干净候选READY和再次推送只按第8节顺序执行。注册、真实业务任务与发布仍分别遵守相应操作授权。

## 2. 源头与法案的符合性

已回读两仓同身份冻结母本的§0、4、7—9、12、19—25、35—47、48—63、65—68、78—85。A两份法案39条、13个domain；W首次读取11条，期间网站任务增加FOUNDATION011-V1，已完整补读，当前12条、2个domain。该新法要求W资源核收后才能启动，作为网站Owner交接前置，不转移网站DB职责。lawId与Manifest、registry作只读集合比较，不是原生质量或内容执法通过。W基础法案为空不自行认定缺陷：母本§66没有固定根law数量要求。

| 来源义务 | 现役对应、符合与缺口 |
| --- | --- |
| PR-004/005、RT-027—033：网页Work、独立Agent、原运行链 | A Runtime001—008、Architecture001、GPT001/002、Browser001—006、W V6-TRANSPORT001承接；保留唯一Runtime、lease/fence、WAL、Outbox，不增模型API/执行器 |
| RT-049：继承成熟机制，不继承旧业务/数据/数据库 | 新根为空，旧复制根有1184条任务；多入口数据根及credential override尚未封闭，见D1/D3。旧命理route不恢复 |
| PR-057—059、RT-050：provider/consumer/Catalog先一致 | W task/result v3 有九条。A 规范已切至 Runtime003-V56、依赖 v3、Manifest provider v2，现有生成物与 Catalog 在未运行候选中仍为八条，须完成 P/D2 后原子启用 |
| RT-051、PR-054：无第二链、unknown不等zero | 原三表/Browser WAL/原结果与来源seal保留；隔离不改effect身份、风险授权或恢复主权 |
| ASTRA-01/02：DOCX+ZIP、Work直传R2、网站独立接纳 | W FOUNDATION006—010、A Runtime003/004承接；通讯验收到业务consumer，不下载/中转成品，不以运输证明交付 |
| 顶级论文蓝图：证据、独立核验、诚实边界 | 不缩工序、不降档、不加确定性评分门；启动/联通验收不证明论文质量或销售能力 |

明确的规范修订需求只有两项，先获用户分别明确law-amendment，不能借旧批准扩大：

- N1：A Startup002当前工作树V5→V6，supersedes V5。将本轮临时`astra:start`改回G的同名`grasseye:start`，固定4174、新根、新设备、新扩展与当前Chrome；保留Startup001、全部forbidden及证据模式。此前批准V4→V5不自动覆盖本项。
- N2：A Runtime003 V55→V56，supersedes V55。将task/result引用由v2对齐W现役v3及唯一投影；保留V6初版1、容量上限6、原运输、领域/恢复主权、全部安全禁止面，不解冻effect/Target/Outbox tombstone。

A pairing Blueprint仍写G的扩展ID，与新身份不符，须同合同局部同步。N1/N2仅同步各自现役Blueprint、spec/law引用、Manifest、原检查器与唯一生成registry；不改母本、基础法案或相邻冻结语义。

## 3. 当前实现、第一断裂和连续性

调查深度为深度，依据是跨仓handoff、存储选择与本轮反复修改。发现范围交叉取自package/配置/route注册、符号/import反查、writer/reader与SQLite只读盘点、此前同任务真实Chrome及进程观察。入口包含launcher、直接server/dist、factory默认值、enrollment、dry-run inventory、credential覆盖、extension build/pairing/WS。只在输入语义、身份、状态、副作用不变的原Owner合同处停止，不能只以“不修改”为由停止调查。

| 已证事实、首断 | Owner/后果与处理 |
| --- | --- |
| G为`npm run grasseye:start`；X为`pnpm start`→本仓start.sh，两者独立管进程 | A startup/W网站Owner；保留对应职责，不照搬X奇门、Next、Postgres等W无消费者启动项 |
| G4173、X Web4322/API4310/奇门4312；W server默认4340；A上轮改4174 | 全链固定 Agent 4174 与 Website HTTPS 4343，禁止随机端口、端口号杀进程或跨仓signal |
| launcher限制4174和新根，直接server仍接受任意env；factory还有平台全局ASTRA默认根 | app-shell-ui/local-app-shell；绕过launcher仍可能读另一库或另建根，D1删除这些选择旁路 |
| credential文件override任意；enroll/inventory可选任意根；server URL比较允许缺配置 | Runtime；D1/D3在原库读取和外连前精确拒绝 |
| A旧`.grasseye-local`为独立inode，但含1184 tasks/3737 outbox/1013 handoff/14084 mutations；A新根Runtime三表、Browser WAL均0行且无设备文件 | 目录不同不等于业务数据隔离；旧事实不迁移、不删除，新链零生产读取 |
| 当前Chrome曾实证安装ASTRA `dmkfldicnhofmlgkoajpjbmeicgijgnl`与GrassEye `emkmbecadncngofidjgocmifhbonifgm`；A曾配对、空闲Target absent | 此前局部动态证据，不是新方案验收；A4174当前已正常停止。保留稳定key/ID，不再生成新身份 |
| W v3新增`astra_paper_research/user_dialogue`及五个参数键，其中新增两种取值类型；A Catalog/投影无此route | W provider/A工厂Owner先交接P；不得只改版本号或空函数接单 |
| A配置有五个旧external/image-token/旧站URL变量，生产代码无consumer；有效cloud变量指4340 | D5只删除本仓无消费者配置，不启旧HMAC/LNA入口，不输出秘密，不升级依赖 |

有限历史与现役相交方案已核：原停止接单方案的真实Node stop/join、迟到初始化关闭、诊断Shell保留；原扩展连接自愈沿现有pairing触发恢复，不加第二timer。当前代码已承接，直接保留；旧方案里的旧端口、主权推断不能覆盖现役法。上轮干净Chrome、简化开页、边施工边改方案与将局部改动当完整隔离均废止，现有overlay不当作通过。

已知原生CHANGE曾因既有删除文件报`UNAUTHORIZED_PRODUCTION_DELETE`，另有恢复fixture/Browser inspector失败；不是本任务扩修工厂/Browser内核或宽开授权标志的理由。与本方案相交的已有修改按批准保留；无法区分归属的对象不删除、不覆盖。最终原生检查若仍失败如实停止，不能拼接历史局部成功。

## 4. 唯一目标身份

| 对象 | ASTRA目标 |
| --- | --- |
| 网站入口 | W 原根 `npm start` 使用已构建制品并进入唯一 HTTPS 监督入口；只管网站，不启动A、不建联合启动器 |
| Agent入口 | A `npm run grasseye:start`，与G同名同生命周期、不同cwd；删除`astra:start`，不留alias |
| 地址 | W `https://127.0.0.1:4343`；A `http://127.0.0.1:4174`，不消费G4173/X4322或附属端口 |
| 运行根 | A真实仓根下唯一`.astra-local`；无平台全局fallback、根外override、复制库、symlink/hardlink共享 |
| 持久化 | 原Runtime三表、Browser原WAL、Forensics/task文件/log/owner.lock各自原Owner，同一个新运行根；不合库、不增表 |
| 扩展 | 保留现有ASTRA key/ID；pairing4174、WS4174、build/release新根。原MV3/debugger/alarms、wire/protocol不变 |
| 设备 | W给origin4174独立签发device/credential/epoch；cloud HTTPS 4343 必填且精确绑定；不复制G身份 |
| Shell界面 | 保留独立ASTRA标题及`astra-app-locale`，因cookie不按端口隔离；不借机改网站登录 |

非秘密GrassEye类型名、header、wire schema并非串数据根因，直接保留。Chrome沿G的当前浏览器Shell Tab精确复用、无窗口才恢复；不操作既存GPT Tab。生产仍由原合法job懒建自己的system Target，exact Target/Document/active generation/permit/WAL全部保留。

本轮按用户最新范围只做实例隔离：端口、数据、凭据、扩展及任务身份各归本系统。沿用原任务独占Target与现实动作防串保护；不增加误启动互斥、人工单扩展准入、扩展开关、账号调度或Chrome管理权限，不把同账号并行生产作为目标或验收门。

## 5. 删除前裁决与1+1

先审检查必要性，再审生产结构。表中保留均须删除前成立；重建不等于删除成熟内核。

| 对象、真实consumer | 裁决与删除反事实 |
| --- | --- |
| 原startup/API boundary/release/credential/SQLite验收及各域唯一inspector | 保留入口，增强原用例；删旧应用字面值/全局默认根/新profile断言。缺它会放过错进程signal/旧扩展/错库/错设备，typecheck不能替代。无新框架、checker、PASS文件 |
| `process-control/port-listener-ops/service-process/service-readiness/startup-main-support/dependency-*` | 直接保留，launcher真实调用；删除会丢归属、PID复用保护、实际收尾、内容/native依赖探针。隔离不重写这些机制 |
| `browser-application-identity.ts`和现有manifest key | 保留，Node与browser多方实际消费；删掉恢复地址/ID多源。纯静态数据，不建配置框架/registry/账号锁 |
| `default-data-dir.ts`全局目录分支，生产入口独立选择根/host/port表达式 | D1物理退休→即时AST/引用缺席→原模块重建唯一生产根校验；现有Store直接消费结果，无新path manager |
| `credential.ts`路径/地址选择片区 | D3删除任意override与可选server绑定→缺席→重建精确绑定。schema、权限分类、NOFOLLOW、原子写保留，不整文件删其它职责 |
| 上轮`open-workbench-page.mjs`简化handoff | D4删除对应函数→缺席→从当前Chrome精确Shell复用合同建设；runSpawn/resolveChrome/escape/无窗口restore提前保留，不复制历史整文件 |
| Runtime/Browser/Forensics/Outbox/worker/GPT/Child/Product | 直接保留各自唯一Owner；删掉会丢任务权威、防重、恢复/交付或专业能力。只改变入口装配，不重构内核 |
| 旧复制数据、上轮干净profile目录 | 不消费、不迁移、不删除，保留现场不授读取资格；清理无当前必要性，不为整洁删库 |
| package/popup/Blueprint/Manifest/spec | 精确相交局部修改或唯一生成；只删除旧正式入口与旧实例绑定，不统称重建，不加CLI/服务/权限 |

1+1必须证明：成熟startup/drain/自动pairing/Target/WAL/原结果交付均不下降，同时所有生产入口绑定本仓库/设备/地址、当前Chrome独立扩展身份与原任务独占Target。仅改字符串、复制旧骨架或增加平行路径均不算。已独立且有真实consumer的成熟模块按表保留，不为重构二字删除重写。

## 6. 四维映射、身份与handoff

| 需求 | 法案/施工图 | 实现/工单 | 验收终点 |
| --- | --- | --- | --- |
| 对应成熟启动 | Startup001/002、LocalShell001/003、startup Blueprint | 原launcher/helpers、D4/D5、N1 | 本仓进程/当前Chrome Shell/真实停止，不混执行ready |
| 端口与扩展 | Browser001/002/005、API boundary001及pairing Blueprint | D1消费者接入、D4原build/pairing/socket | 4174新ID鉴权；旧ID/来源拒绝；HTTPS 4343 归网站 |
| Agent数据库隔离 | Runtime002/005/006、LocalShell及V6 Blueprint | D1/D3，原Store/Forensics/Browser WAL | 实际根/inode/表与旁路反例，旧库零读取 |
| 双仓通讯 | Runtime001—004、W V6及FOUNDATION006—010 | N2/P/D2/D3原链 | 原完整结果receiving→同身份网站领域接纳 |

identity spine：A根→Shell4174→扩展/release/profile/session→W独立device/origin/control-v1→原job/request hash→accepted attempt/revision/fence→原effect/WAL→完整result hash/Outbox/terminal receipt→W领域结果。order/project/input/confirmation/authorization/Work资产引用仍由原Owner给出；Target/URL/进程不可替代这些身份。

| handoff与Owner | 合同/成功readback | 拒绝、失败、unknown/回接 |
| --- | --- | --- |
| startup→App/Chrome | 单.env.local、固定根/4174、原source fingerprint health、真实close；只开Shell | 错根/port在logger/DB/signal/外连前拒绝；foreign listener零signal；执行依赖缺失仍诊断Shell。无业务事务/lease，依据startup合同 |
| 扩展→API pairing/WS | 原GET`/api/browser-authority/pairing`、内存一次性secret/no-store、exact ASTRA ID/Origin、原认证WS | 网页/旧ID/null/file/无身份拒绝；stale先自reload；断线原链重认证，不增timer/transport；空闲Target absent |
| Runtime→W enroll | 原POST`/internal/ai-production/v6/devices/enroll`，production/request_id/token及原response；独立设备/origin4174、原子0600文件 | 缺/旧/冲突配置零请求；一次调用一个request_id，unknown不重跑随机注册。原请求ID随本次脱敏诊断可关联，由W读原请求/设备；不建注册表 |
| Runtime→W session/claim | `astra.production-control-v6` v1，原open/heartbeat/close/claim/renew/release；device/epoch/origin/version逐项一致 | 错版本/权限typed拒绝，零Provider；lease预算/fence/read-first原合同。原Browser absent的deliveryOnly边界保留，不阻合法原结果运输 |
| W task→Runtime→Catalog | `astra.website-agent-task-result` v3全部9 routes，provider唯一generator，Catalog双向相等；Agent Manifest目标v2 | 未齐阻断，不空route/手写表/alias；逐项承接required/optional/null/default、枚举/基数、材料repeatable/min_count/ordinal/关系/信任、unknown-field、canonical编码/hash，不造第二schema |
| A完整结果→W接收→领域 | stage与terminal意图同事务、原Outbox；receiving绑定原job/attempt/session/epoch/result hash，A completed；W沿原结果领域接纳 | 200/staged/SENT不等receiving；unknown读原receipt，零重做Provider。W领域拒收不撤A completed/另建job；对应W原Owner同身份读回 |
| Work→R2→网站资产 | 原Product直传/全字节读回、网站独立同版DOCX+ZIP核收 | 本方案不重跑S链、搬成品或造假文件；完整业务证明依原任务交付，不以通讯通过开放销售 |

有限分母还包括：端口空闲/本仓旧listener/foreign/PID变化；server/dist/enroll/inventory旁路；根不存在/合法空库/合法现有库/旧schema/损坏/权限/软硬链接/根外override；credential缺失/JSON/schema/旧4173/旧4322/缺cloud/新设备；artifact current/stale/缺失/重建失败；扩展禁用/合法/错ID/build/断线；正常/重复/初始化中停止；同结果重投；provider/Catalog漂移。Owner及落点为本表和D1—D5，typed失败保留原件，只由原Owner合法配置/事实恢复回原入口；无自动修库、清WAL、换身份或第二恢复状态。源结构错误无恢复动作，只停止。

## 7. 原子工单与施工纪律

共享门：每单写前重新核对规范授权、Git、目标字节及overlay归属。N1/D1/D3/D4/D5在未运行的同一候选内先施工，D3仅含代码和本地夹具验收。P只约束其真实下游N2/D2组合验收与生产切换。真正重建只限D1/D3/D4指定片区；其余保留、局部修改、删除退役和生成分别汇报。每个消费者接入由表列原Owner独立动作。

### N1/N2：两项规范决定

N1唯一Owner startup-entrypoint，位置为A功能法案Startup002 block；N2唯一Owner agent-production-runtime，位置为Runtime003 block。各自只实施第2节精确语义，保留全部其余义务；先对应明确授权，删除旧active block并原子替换下一major，同步自己的现役引用/Manifest/原检查器，唯一builder生成registry。不修改母本或别的法条，不复制历史。验收parser/active引用/投影及原禁止面；失败停对应实现，不先代码后补法。此处无生产重建或数据操作。

### D1：唯一生产根

Owner local-app-shell，A `src/lib/local-runtime/default-data-dir.ts`默认目录选择片区。删除原`getDefaultLocalDataDir/getDefaultPhase04LocalDataDir`平台全局选择实现→即时AST/引用核缺席→从“本仓唯一根”合同在现有模块重建生产根解析校验。静态identity模块与所有Store直接保留，不复制Node逻辑到browser bundle，不新增path manager。

目标符号固定为现有模块内的`resolveProductionLocalDataDir`。仓根从本模块实际位置推导，只接受源码`src/lib/local-runtime`与tsconfig声明的`dist/src/lib/local-runtime`两个布局，核根package身份和真实cwd。launcher、直接源码server、enroll及只读盘点均消费此函数。审查确认原编译启动命令的干净产物缺少必要的窗口模块和Product Skill正文；仓内无消费者。D5物理退役该命令与无消费者的源码内部别名，保留编译检查和同一有防护的源码入口。

输入是请求目录，输出为本仓真实根下唯一`.astra-local`。先核realpath和目录，拒绝旧根及根外override。两份SQLite及其`-wal/-shm`在首次logger/Store前拒绝软硬链接。各原Owner在实际打开前检查任务目录、扩展产物、Browser锁及Forensics/日志路径。材料合法同目录别名须以全部链接同目录为限。凭据祖先及文件在D3读取前按原typed分类拒绝，Shell仍依LocalAppShell001保留诊断。内部capability既有显式临时目录测试注入保留。

消费者各自的不可分割局部接入如下；只删原选择表达式，不删独立职责，各自验收同一root合同和原职责：

| 唯一Owner | 精确消费者与动作/readback |
| --- | --- |
| startup-entrypoint | `launch-grasseye.mjs`创建startup logger前调用根校验；保留完整stages/shutdown/helpers；错根零log写/DB/signal |
| app-shell-ui | `src/app/server.ts`创建handle/监听前核根及固定host/port；保留唯一HTTP及真实close；直接源码旁路同样拒越界 |
| agent-production-runtime | enrollment、credential路径及`production-runtime-storage-reconcile.ts`打开文件前接入；保留原协议/只读inventory；错根零文件读取/外连 |
| local-app-shell | `workbench-assembly.ts`默认装配接入；保留显式内部options、原logger/Browser/Forensics装配；无第二默认根 |
| forensics-persistence-capability | `src/lib/storage/file-storage.ts::{ensureDir,readIndex,replaceIndex,appendArtifact,createGrassEyeFileStorage}`仅局部补路径准入：原`forensics`、`artifacts`目录祖先、`artifacts.ndjson`和本次实际读取/写入的`<artifactRef>.bin`必须属于已核根，拒绝目录/文件symlink、文件共享hardlink后才原读写；append/read/hash/幂等与唯一索引整体保留，不重建Store |
| runtime-log-spine | `src/lib/runtime-logs/sinks.ts::{createRuntimeFileSink,segmentFiles}`及原write仅局部补路径准入：已核`runtime-logs`、实际`startup-entrypoint/agent` producer目录、writer lock和原算法枚举/本次追加的segment先核归属与链接再原读写；原单写者、容量/轮转/脱敏与完整事件保留，不建新logger/扫描器 |

后两行是“新根下仍可能链接到旧状态”的同一隔离缺口，当前静态消费者已确认，不声称现场存在此链接。各Owner直接用本文件现有fs元数据能力检查自己已经要访问的路径，不遍历无关子树、不读其它Owner私有库、不另建通用安全层。负例放入原Forensics和Runtime Log验收：分别设置隔离临时根内的目录、索引/原件或segment链接，调用真实原reader/writer，必须在旧目标读写前拒绝；正常临时根的原字节hash、原日志事件及幂等保持。只用本次临时fixture，不链接或访问G现役文件。日志路径不合法按原log-sink失败停止危险输入；Forensics局部失败沿原typed出口，均不修链接或换根。

验收增强原startup/local-shell/credential/storage用例，覆盖全部入口和有限分母；真实resolver/Store读回root/inode、三表及WAL。新库只当前schema首次建表；已有库只读schema验证，旧schema/损坏不迁移不修复。删除时取即时AST证据，功能再取consumer读回。失败保留原件，无fallback/清库/源码自动回退；合法配置恢复后沿原入口重启。

### D2：唯一通讯投影

Owner agent-production-runtime，A `docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json`、原`sync-website-agent-route-policy-projection.ts`、原`website-agent-route-policies.v1.json`及实际生产消费者`src/lib/local-runtime/production/route-policy.ts`。N2与P中的Product/Catalog就绪后承接W v3；`route-policy.ts`原位删除固化v2判断，直接消费唯一active dependency的contract identity/version核投影，不新增版本reader或第二白名单。其真实消费者`executor.ts`的import与`assertProductionTaskRoutePolicy`调用直接保留，不重建executor。保留control dependency v1及原transport/Store；退休旧投影后唯一generator产新投影，不手写schema/生成物，不降provider。

交接P按实际方向拆开。A原Product与architecture-boundary Owner先提供离线C01实现、同身份结果用例和S00接入差异，输入是已发布的W v3 route/result。旧八条生成物只作为未运行候选中的待删除对象。当前 N2 规范已对齐，接入后由原Owner在同一停机候选内集成S00的`index.ts`注册、`flow.ts`分发及原Product验收，与D2的v3投影同时生效，再验收真实9-route Catalog和同身份结果。并行研究专项明确排除该职责，S00写面由原Owner完成交接及集成，本任务不覆盖其并行改动。

D2与Product/Catalog在同一未运行候选内集成。Runtime Owner随后在原`agent-route-capability-manifest.provider.spec.json`公布v2。其authorityArtifact仍为原`catalog.ts::agentRouteCapabilityManifest`，真实routes与route_hash由Catalog生成。网站现役dependency v2要求9条真实route，原wire schema仍为`agent-route-capability-manifest.v1`、task/result各wire版本仍为1。用W原验证器核完整routes与hash。W Owner在注册前交付 HTTPS 4343 服务、允许Agent origin4174及独立设备签发配置。注册后的session/heartbeat和实际鉴权回执是验收输出。W数据库仍归网站Codex。

P 的当前实际接缝包括九条路由。W v3 的付款观察与 S01 旧结果合同保留。C01 现有 S01 补资料内部结果仍由 S01 消费，独立 user_dialogue 由原 S00 注册后调用同一 C01 Chat 流，只交冻结安全 context、客户问题和原 turn/project/input/order/context 身份，按 W 原结果合同核字段及同一身份。原 Chat 调用身份、只读恢复和唯一 complete 保留。移除 C01 向模型发送完整 task 或索要 Work 访问的旧片区。验收同时覆盖 S01 补资料与独立问答的原始接纳，拒绝错 context/hash 或跨项目回执。

W v3 对 prepare_workspace、build_evidence、compose_manuscript、prepare_delivery、archive_delivery、maintain_workspace 六个正式结果新增 next_business_action 和 public_updates。原 Product Owner 在 S00 唯一结果组装里同时承接两项。正常接续沿当前 provider 的允许结果及已核维修目的。内容补料/返工只依据原结果中未解决事项的已声明目标在 S00 选择内容方向，证据优先于稿件，缺合法方向则失败关闭。没有经核可公开的 Work 观察时返回合同允许的空动态，不从完整答复拼公开文本。保留原 stage 的研究事实、完整结果、同任务 Outbox 与 Website 领域 Owner。既有 S00 验收逐项核六路、实际否决和 C01；网站原接纳核对同一结果与合法接续。此范围是现役 v3 不可分割的 P/D2，工程阶段不得绕过或缩小。

验收比较实际authorityArtifact全部语义、生成投影与Catalog双向集合；新增五个参数键及其取值类型、材料/结果结构/unknown-field均沿原反例。原`scripts/audit/domains/agent-production-runtime/contract-inspection.ts`第126/144行的v2假设及`scripts/acceptance/agent-route-contract.acceptance.ts`第11行的v2断言同单原位对齐active dependency；必须实际导入`route-policy.ts`并经过原executor路由校验，拒绝“JSON已v3、生产consumer仍固化v2”错误实现，不能只查文件存在。全部9条有真实生产consumer才cutover，不空函数、旧业务alias。provider继续变版、工厂缺失或未列语义变化，停止本单，不能执行中改方案追版。删除仅旧固化投影/假设；不重建成熟链。生成失败停新生产，保留现场，不双读回v2。

### D3：独立凭据与注册

Owner agent-production-runtime，A `credential.ts::productionCredentialPath/assertCredentialOrigins/enrollProductionDevice`的路径/地址绑定片区。D1之后删除不受限override、可选server绑定及enroll任意根/origin分支，核缺席后同Owner按原schema重建。JSON/schema/权限分类、0700/0600、NOFOLLOW及原HTTP协议保留。目录权限必须先于POST验明，原子发布保留fsync且用独占链接拒绝覆盖已出现的目标文件，临时文件仍同目录用后删除。

`AGENT_PRODUCTION_CREDENTIAL_FILE`读取保留为拒绝检查：非空时只准规范化后等于新根唯一credential文件，返回值始终取同一规范路径；不能存在两种选择实现。数据env仅等于新根。代码只允许 W HTTPS 4343 与 Agent origin 4174，缺/旧/冲突在外连前typed失败。实现与本地夹具校验无需W在线，真实注册、session与接单须等第8节切换门。长期credential不存合同正文/hash，升级合同不重新注册。缺设备保留诊断，不读G设备。

显式注册是独立运行操作：P/D2一致及具体注册授权齐备，才原`production-runtime:cloud:enroll`一次；本次request_id固定并可随脱敏诊断关联，不新增持久请求表。合法回复验device/origin后原子落唯一文件，有凭据不覆盖。响应/写入unknown停，由W读原请求/设备，未经核实不重跑CLI另造设备。验收旧凭据/地址/路径/权限/版本反例零新生产，真实新设备session被W接纳，G文件/设备不变。无自动回退/重签。

### D4：当前Chrome及扩展绑定

startup Owner在 `open-workbench-page.mjs::openMainPage/openWorkbenchPage`片区，先删除上轮简化handoff→即时AST缺席→从“当前Chrome精确Shell复用”合同建设；提前保留runSpawn/resolveChrome/escape/无窗口restore函数，直接调用。不搬历史整文件，不保留新profile参数。4174 Shell存在精确复用，不存在才新Shell Tab，零窗口原restore；不触GPT既存Tab。声明和startup验收局部同步。

Browser Owner局部同步原manifest/build/release/profile/pairing/socket/popup身份和命令，保留稳定key/ID、原权限、自动reload/alarms及全部Target/WAL。API boundary Owner只同步旧pairing Blueprint实例ID并原正反验收，不加API或fallback。profileRef只标记扩展绑定，不虚构物理profile隔离；无consumer的profileDir/disallowDefaultProfile不恢复。

安装在当前Chrome，目录固定A`.astra-local/browser-build/extension`；已有安装不重复添加，普通启动不做安装或扩展开关。验收key→ID/实际path/build/release、旧ID/来源拒绝、stale自reload、首次及A重启自动认证、空闲Target absent；合法任务只建自己的system Target，不能认领另一任务或既存操作者Tab。失败保留登录、任务/WAL，沿原连接恢复，不移除G扩展或重建profile。

### D5：对应启动入口与配置

code-purity Owner把A package正式script改为G同名`grasseye:start`，删除`astra:start`及D1已证无消费者的`internal:app-server`、`internal:app-server:dev`。保留ASTRA package身份、版本、lock、依赖与新根gitignore。startup/Browser各自Owner同步现役提示、Blueprint和原检查器。

本机配置只删除第3节已证明无人消费的五个旧变量：`GRASSEYE_EXTERNAL_API_ENABLED/GRASSEYE_EXTERNAL_ALLOWED_ORIGINS/GRASSEYE_EXTERNAL_API_KEY/AMZMGR_AGENT_PRODUCT_IMAGE_UPLOAD_TOKEN/XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL`。保留实际ASTRA端口/cloud绑定，不输出秘密。W `.env.example`错误Agent origin4340由W Owner修成4174，本任务不落笔。

验收A/G同名命令各自cwd→本仓、env loader唯一、dependency检查仍按内容/native而非mtime、现役提示无双入口；普通启动无enrollment/安装/任务/quality副作用。删除时核旧script不存在，无生产重建对象。失败停本单，不加别名或回改G。

## 8. 切换、质量、终点和失败

施工落点容量已核：default-data-dir18行、server80行、launcher218行、credential254行、opener86行、projection generator74行；只在这些小模块承载必要校验/接线。Browser actor430行、supervisor407行、Runtime loops441行保留执行逻辑，不向其堆校验或切出新controller。最终仍受Code-Purity001的文件500行、函数75行、参数7、return8、嵌套5、复杂度16、await10及原import/export预算约束；可预见的根逻辑在原小模块内分成职责明确的私有函数，不到质检失败后才切割。

相交验收/检查器落点固定，生产/负向身份分支复用原用例并按原Owner分别改，不新增测试包装层：

| Owner | 精确现役落点（A仓内） |
| --- | --- |
| startup-entrypoint | `scripts/acceptance/startup-initialization-health.acceptance.ts`、`startup-browser-artifact-sync.acceptance.ts`；`scripts/audit/domains/startup-entrypoint/inspector.ts` |
| local-app-shell | `scripts/acceptance/local-app-shell.acceptance.ts`、`local-shell-current-runtime.dynamic.ts`；`scripts/audit/domains/local-app-shell/inspector.ts` |
| local-browser-session | `scripts/acceptance/browser-extension-build.acceptance.ts`、`browser-extension-release-identity.acceptance.ts`、`local-browser-auto-pairing.acceptance.ts`及其`local-browser-auto-pairing-support.ts`、`local-runtime-browser-authority.acceptance.ts`、`local-browser-property-model.acceptance.ts`；本域`release-boundary-inspection.ts`、`transport-inspector.ts` |
| workbench-api-boundary | `scripts/acceptance/workbench-api-boundary.acceptance.ts`、`workbench-api-boundary-fixture.ts`及现役本域inspector |
| agent-production-runtime | `scripts/acceptance/agent-route-contract.acceptance.ts`、`agent-production-runtime.acceptance.ts`、`agent-production-runtime-ledger.acceptance.ts`、`agent-production-runtime-startup-preflight.acceptance-support.ts`、`agent-production-runtime-fixtures.ts`；本域`contract-inspection.ts`、`authority-inspection.ts` |
| app-shell-ui | `scripts/acceptance/app-shell-localization.acceptance.ts`仅原标题/cookie合同；无UI重做 |
| forensics-persistence-capability | `scripts/acceptance/forensics-persistence-capability.acceptance.ts`及现有本域inspector，仅补已知存储路径隔离反例 |
| runtime-log-spine | `scripts/acceptance/runtime-log-spine-v2.acceptance.ts`及现有本域inspector，仅补原file sink路径隔离反例 |

表中的basename均继承该行首次写明目录；各域Manifest只作必要现役law引用同步，现有新身份模块已被Browser唯一ownedPaths覆盖，不新增Owner/治理文件。发现表外实际consumer先停止受影响施工，不能自行扩展冻结分母。

本轮 CI-FULL 仅验 A 的 `main`。W 的并行候选由其 Owner 处理，W 的 CHANGE 不作为 A 的 READY 前置；实际联通仍取 W 原授权、同一任务回传与领域接纳证据。

本轮原生 CHANGE 的 Browser 验收修复由 local-browser-session Owner 在原 `opaque-proof-inspection.ts::inspectEncryptedRecoveryLocator` 承担。核一次原密文解封及读回，要求 exact-call、effect、callId、Child 均按原调用或原 WAL 行取值，且仅 CONFIRMED provider effect 可读。原 `local-browser-rule-mutants.acceptance.ts` 按现役 Manifest/registry 与原 inspector 路由绑定证据，保留原反例并覆盖错行、错 Child 和丢身份。原 Browser 006 的该检查仍交原静态报告。生产 Browser/WAL、合同、Target 与设备行为保持原实现。检查或反例不成立即停本工单。

授权人追加将 ASTRA 复制继承的现役法条归到独立 V1。比较复制源 `b0227bd0d` 与当前 ASTRA `2b716a4a` 及合并工作树，两边的 39 个 lawKey 集合一致。沿原 Owner 保留各条现行义务、证据分母和检查。将本仓两份法案的条款标题、lawId、supersedesLawId 与现役依赖一并归一，V1 的 supersedesLawId 为 null。同步 13 个 Manifest、命中的现役施工图和 spec、现役检查和证据 producer 的 lawId，交唯一 `audit:build` 生成 registry。历史记录与刻意使用旧版的反例保留。跨仓 spec/业务合同版本不因本仓法条编号变化。

合并候选的 Runtime003-V56（现行 task/result v4）与 Startup002-V6 相对于 Git HEAD 已修订实质义务。按母本 §12、§39.2、§69、§72.1，先以各自合法下一 major 及其当前消费者运行原生 CHANGE，并在本地 main 记录迁移基线，其余纯编号归一可在该候选同时完成。再将最后两条按同一正文归一并跑原生 CHANGE。最终在 main 以全部 V1 的候选提交首推，完整 READY 和第二推；两步均保留原语义修订检查，单一活动 corpus 与单一 registry。无兼容机制、数据迁移或新门禁。

Architecture001 的原生失败由 architecture-boundary Owner 在原 `architecture-boundary.acceptance.ts` 修复。现役 Tombstone 文字与 HEAD 相同，网站现役 `astra.production-control-v6@1` 的 authorityArtifact 明确原 submit、确证重试及各自的原 WAL 来源。依据用户采用当前法案为独立 V1 的授权，沿原冻结检查定点同步选择器和独立 SHA-256 期望值，保留逐字保护、Target 独立摘要与原反例。通过原架构验收和全量原生质检证明。任何合法来源、法条字段、证据模式、引用、业务合同漂移或命令失败，停在对应原入口，保留工作和证据。

迁移基线 CHANGE 的普通治理测试发现五处同步缺口。原 `tests/governance/quality-contract.test.ts` 负责三类验收：将七种 Dynamic 模式和共用真实回执夹具绑定现役法号，保留同次运行、正规文件、摘要和错事实/模式拒绝。将实际 provider 正控绑定 ASTRA 仓名，保留错仓、错形和错 Owner 拒绝。将 GPT 文本变异锚到当前观察参数及空结束授权分支，保留附件四路选择器和同一 Composer 卡片的反例。GPT Owner 的原 `gpt-contract-inspection.ts::inspectGptContractDenominator` 按 AST 的属性名读取已声明键，补齐 Work 与两项 retry 的精确动作决策和预算。此工单修复证据消费者，保留现役执行与逐法分母。跑原治理测试核验所有成功与失败分支，再回原生 CHANGE。具体失败未闭合前保持原生阻断。

原 sealed inspector 在 GPT002 两种静态模式中另定位两处独立失配。原子事实投影验收复用 GPT001 已冻结的 mutation Child 合同集合，核全部 14 个 handler 与原 `intent, context`，保留七项身份、原 WAL 和零输入读回。GPT 施工图将两个现役冻结标识接回当前回答两门和轮询段落，依现役法案说明原身份、stop/body 及五次原回合 retry；保留唯一 FIFO、资格和预算，不恢复旧等待。原 inspector 保留双模式和文档锚点检查。原规格解析反例以对象字段生成非法 contractId，避免复制前仓名导致变异未生效。

现役 Owner 检查发现复制时遗留三个零 Owner 路径。退役仅含仓名的根 README 和 ASTRA 的论文蓝图重复件。论文方案继续绑定 Website 原件，同字节记录保留为迁移事实。GPT 重试方案在本轮仍用于核对两处冻结标识及原验收义务，原字节保留，由现有 GPT Manifest 精确登记该文件并重建 registry。删除按 HEAD 和本轮授权核验，复核两处原路径缺席及余下路径的唯一 Owner。

母本 §63.1 与 §63.2 分别约束 CHANGE 和 READY。原 schema 5 普通用例保留字段、现役 lawId 和域分母断言，移除末尾对真实候选重复执行的全量投影及 Owner 检查。保留陈旧投影、路径角色、删除授权和多 Owner 反例。全量投影、Owner 及角色升级继续由原 READY 入口对同一 clean commit 执行。

首推候选的原生 READY 发现 Startup001 的结果组装仍按旧版本后缀分流，导致原生回执绑定错误。Startup Owner 令现役法号、执行回执与结果路由共用明确绑定，保留独立 AST 和合同模式。启动器的静态证明核实际 canonical host/port 导入和失败关闭；固定 127.0.0.1:4174 由原启动及 Shell 用例实证，检查器只读本法封存路径。原 Startup002 Exam 在两组原用例均完成后只发一份同模式回执；Startup001 仍独立出证。PID 身份重查、重新捕获后的精确对照和退役 CWS/relay/native host 由原 Startup001 AST 核实，普通 owned/foreign listener Exam 不声明这两项。启动器直调 reload 由本域 AST 拒绝，扩展自身按 releaseBuildId 自重载仍取 Browser 原证据，不更改原执行器、共享回执 writer 或法条范围。对既有启动验收保留实际长停止、快速退场、诊断 Shell 和产物读回反例。

本地补修复核另外发现原启动 Exam 对 secret logging、pairing/socket、质检禁止项以及独立部署和 production 身份过报。保留全部现役条款及应有模式，撤掉与实际断言不相符的 claim。原条款分母仍失败关闭，逐项待实际证据；不得把作用域、同次 trace 或隔离夹具当成这些条款已经核销。

固定顺序：

1. **本地隔离施工。** 在A的main与既有停机条件下，先对齐N1与其施工图、引用及生成registry。主Codex两遍自查对齐无遗漏后，实施D1及各consumer→D3静态路径和地址校验→D4/D5。启动器的`verifyProductionDependency`只读取本仓control v1 dependency。数据根校验、固定扩展身份、Chrome开页逻辑与凭据拒绝检查可以直接建设，无需C01或网站设备。只取原本地验收与隔离夹具证据。旧 v2 生成物在 D2 被物理替换，A 不启动或提交规范与实现分离的候选。
2. **通讯集成。** 接收W已发布的v3及P中的离线产品接缝后，在同一未运行候选内核 N2、其施工图和独立规范审查的同一版本。原Product Owner集成真实S00注册和执行，Runtime Owner同步用D2唯一v3投影替换v2并公布Manifest provider v2。整个窗口不接单。原Product验收与原transport验收覆盖真实第9条入口、投影、Manifest及结果。W可并行准备服务与签发配置。
3. **候选验收与切换。** 同一候选合齐后，主Codex两遍检查实际建设，再按第9节做独立代码审计。A 按 CI-FULL 完成原生 CHANGE、范围内提交首推、干净候选完整 READY 和再次推送。并行任务未收口的工作树改动由原 Owner 处理。A 的 READY、两仓合同、W 实际服务/签发配置和独立操作授权都齐备后才注册、启动新生产并取得实际设备鉴权和同任务结果读回。无桥、双读、重复身份或导入旧数据。

drain：A旧producer已停止、原Promise/native真实退出。切换前重读新根零task/Outbox/mutation；若出现真实任务，停止空库切换，由原Owner原身份交付、drain，不清库。G/X不动，W由其Owner按原任务drain/启动；同一Mac不等同一部署单元。合同/consumer漂移停止受影响施工，保持本文冻结，不执行中追版改设计。

| 验收对象 | 既有命令/真实动作与权威readback |
| --- | --- |
| A结构/相交行为 | typecheck、原browser build/release、startup、API boundary、app-shell/local-shell、Runtime/Browser相交acceptance；只证明实际覆盖 |
| A根/设备反例 | 原隔离fixture调用真实resolver/credential/Store，覆盖正常及所有旁路、旧env/根、软硬链接/旧device/地址；不触G现役数据。仅改port而保留override的错误实现必须被拒 |
| 进程隔离 | 原process-control反例证明foreign/UID/cwd/PID变化零signal；运行授权后读A4174/W4343真实PID/cwd，重启停止只本仓；G没运行不冒充并行证据 |
| Chrome身份与任务隔离 | 当前Chrome实际ID/path/build及health，独立ID/endpoint/认证；原合法job只建自身system Target，错job/Target/Document被原合同拒绝。G只用等价原fixture/其Owner证据，本任务不启动G；不增加误开或并行生产验收 |
| W—A业务终点 | W原运营validation_only本人隔离项目的合法真实任务；追同job/request/attempt/fence/result→receiving→对应领域接纳/客户获准状态。9 routes机械双向一致不等9业务均实测，一项任务不等整厂通过 |
| W数据库readback | 只消费W Owner同身份原接收/领域读回引用，不建DB连接、不跑SQL/PG测试，不以口头“已配”替代证据 |
| 原生quality | 本轮只执行 A 原生 CHANGE、干净提交和 READY；网站并行候选另由原 Owner 验收。设计阶段不执行 |

通讯任务不是启动器synthetic job，而是启动后另获授权的真实隔离业务；不得伪造付款、哈希、成品或业务成功，涉及资金/不可逆外部动作仍需具体授权。工厂/网站尚不能签发合法任务或业务readback缺失，联通终点未完成，不降格session成功。运行观察不自动成为RELEASE Dynamic Proof，READY/RELEASE另回clean commit和全部法定分母。

重构纪律与功能质量分别验：D1/D3/D4删除→即时缺席→新建当时的工具记录可核；禁止保存旧片区到内存/临时副本机械加工、复制历史骨架、改名壳或兼容桥。保留模块提前裁决后直接用。最终diff不补造过程；缺证据报告“无法核实重构纪律”，违规报告“未满足重构要求”，不得用功能通过替代。

失败停受影响单和新生产，保留新根原件及unknown，由原Owner原链回接。禁止自动源码回退、reset/stash/搬overlay、清库和回到G身份。网站未交付时只暂停依赖其交付的动作。已获授权的独立部分照本方案完成。

## 9. 冻结与施工准入

冻结前只迭代本文，不施工、不建第二版本文件。主AI三轮依次审源头/法案、闭环Skill/删除反事实、四目标的入口/consumer/cutover；找不到剩余设计finding后，按subagent-review启动独立只读审计。审计者必须读原文，仅审计，不写代码/方案、运行服务或生产；未放行不能结束方案建设，结论不替代quality。

独立审计逐项核：四源头边界、法案冲突是否明确阻断、闭环Skill完整要求、四需求至全部consumer/工单/有限分母/readback、真删除后建设及不恢复旧骨架、当前Chrome独立扩展与原任务身份、网站DB/用户overlay保护、局部联通不冒充业务/READY/RELEASE。用户已排除误开/账号调度支线，审计不能重新加入该验收门。冻结后本文hash只存任务上下文，不自写回正文。

冻结后的执行只能按本文。发现来源、合同或consumer漂移，先停受影响施工，再单独重开设计核对变化、审查及授权；一般测试失败不授权改方向或放宽门。

N1/N2及本计划所列A施工对象已获授权。顺序修订完成审计并冻结后，本地隔离工单可施工。通讯集成等离线Product接缝，生产切换还等Manifest、网站服务与签发配置、原生质量和独立操作授权。门禁以原验收及真实读回裁定。

初版设计审计补齐了D2真实投影消费者及D1 Forensics/日志消费者。本次只审计顺序修订的依赖、授权与切换门，审查发现按原规则收口后冻结。实际建设后的独立审计逐项对照代码、施工过程证据、闭环Skill和现役法案，给出实际实现差异与缺项，不重审方案替代代码审计。用户已排除误开与账号调度。

最终按精确对象分别报告：真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成；单机隔离、Chrome配对、设备session、完整结果接收、网站接纳、原生质量与重构纪律各自如实说明。
